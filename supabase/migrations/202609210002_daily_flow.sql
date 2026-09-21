alter table public.tracks add column id uuid not null default gen_random_uuid();
alter table public.tracks add constraint tracks_id_unique unique(id);

create table private.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id),
  room_id uuid not null,
  track_id uuid not null,
  reason text not null check (char_length(reason) between 1 and 200),
  original jsonb not null,
  created_at timestamptz not null default now(),
  unique(reporter_id,track_id)
);
revoke all on private.reports from public,anon,authenticated;

create or replace function public.muzik_prepare(p_actor uuid, p_action text, p_request uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare cached jsonb; count_hits integer; max_hits integer;
begin
  if p_actor is null or not exists(select 1 from auth.users where id=p_actor) or
    p_action not in ('createRoom','joinRoom','getInvitePreview','updateNickname','reportTrack','previewTrack','registerTrack','updateTrack','deleteTrack') then
    raise exception 'INVALID_INPUT' using errcode = 'P0001';
  end if;
  if p_action not in ('createRoom','joinRoom','getInvitePreview') then perform private.check_member(p_actor,(p_payload->>'roomId')::uuid); end if;
  cached := private.replay(p_actor,p_action,p_request,p_payload);
  if cached is not null then return jsonb_build_object('replayed',true,'result',cached); end if;
  max_hits := case p_action when 'createRoom' then 5 when 'joinRoom' then 20 when 'reportTrack' then 20 when 'getInvitePreview' then 30 else 60 end;
  insert into private.rates values(p_actor,p_action,date_trunc('hour',now()),1)
    on conflict(actor,action,bucket) do update set hits=private.rates.hits+1 returning hits into count_hits;
  if count_hits > max_hits then raise exception 'RATE_LIMITED' using errcode='P0001'; end if;
  return jsonb_build_object('replayed',false,'dateKey',private.kst_day());
end;
$$;
create or replace function public.muzik_mutate(p_actor uuid,p_action text,p_request uuid,p_payload jsonb,p_metadata jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.rooms; old_track public.tracks; result jsonb; cached jsonb;
  day_key date := private.kst_day(); room_uuid uuid; code text; bytes bytea; i integer;
begin
  if p_actor is null or not exists(select 1 from auth.users where id=p_actor) then raise exception 'FORBIDDEN'; end if;
  -- 같은 요청은 외부 조회 경합이 있어도 한 번만 커밋한다.
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text||p_action||p_request::text,0));
  if p_action not in ('createRoom','joinRoom') then perform private.check_member(p_actor,(p_payload->>'roomId')::uuid); end if;
  cached := private.replay(p_actor,p_action,p_request,p_payload);
  if cached is not null then return cached; end if;
  if p_action='createRoom' then
    if char_length(btrim(p_payload->>'name')) not between 1 and 20 or char_length(btrim(p_payload->>'nickname')) not between 1 and 8 then raise exception 'INVALID_INPUT'; end if;
    loop
      code := ''; bytes := extensions.gen_random_bytes(6);
      for i in 0..5 loop code:=code||substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',get_byte(bytes,i)%32+1,1); end loop;
      begin
        insert into public.rooms(name,invite_code,created_by,member_count) values(btrim(p_payload->>'name'),code,p_actor,1) returning * into r;
        exit;
      exception when unique_violation then null;
      end;
    end loop;
    insert into public.members(room_id,user_id,nickname) values(r.id,p_actor,btrim(p_payload->>'nickname'));
    result:=jsonb_build_object('roomId',r.id,'code',r.invite_code);
  elsif p_action='joinRoom' then
    select * into r from public.rooms where invite_code=p_payload->>'code' for update;
    if not found then raise exception 'NOT_FOUND'; end if;
    if not exists(select 1 from public.members where room_id=r.id and user_id=p_actor) then
      if r.member_count >= 30 then raise exception 'ROOM_FULL'; end if;
      insert into public.members(room_id,user_id,nickname) values(r.id,p_actor,btrim(p_payload->>'nickname'));
      update public.rooms set member_count=member_count+1 where id=r.id;
      update public.rooms set revision=revision+1 where id=r.id;
    end if;
    result:=jsonb_build_object('roomId',r.id);
  elsif p_action='updateNickname' then
    room_uuid:=(p_payload->>'roomId')::uuid;
    select * into r from public.rooms where id=room_uuid for update;
    perform private.check_member(p_actor,room_uuid);
    update public.members set nickname=btrim(p_payload->>'nickname') where room_id=room_uuid and user_id=p_actor;
    update public.rooms set revision=revision+1 where id=room_uuid;
    result:=jsonb_build_object('roomId',room_uuid);
  elsif p_action='reportTrack' then
    room_uuid:=(p_payload->>'roomId')::uuid;
    perform private.check_member(p_actor,room_uuid);
    select * into old_track from public.tracks where room_id=room_uuid and id=(p_payload->>'trackId')::uuid;
    if not found or old_track.hidden then raise exception 'NOT_FOUND'; end if;
    if old_track.user_id=p_actor then raise exception 'FORBIDDEN'; end if;
    insert into private.reports(reporter_id,room_id,track_id,reason,original)
      values(p_actor,room_uuid,old_track.id,p_payload->>'reason',to_jsonb(old_track))
      on conflict(reporter_id,track_id) do nothing;
    result:=jsonb_build_object('roomId',room_uuid,'reported',true);
  elsif p_action in ('registerTrack','updateTrack','deleteTrack') then
    room_uuid:=(p_payload->>'roomId')::uuid;
    select * into r from public.rooms where id=room_uuid for update;
    perform private.check_member(p_actor,room_uuid);
    if (p_payload->>'dateKey')::date is distinct from day_key then raise exception 'TODAY_ONLY'; end if;
    select * into old_track from public.tracks where room_id=room_uuid and user_id=p_actor and date_key=day_key;
    if old_track.hidden then raise exception 'HIDDEN_TRACK'; end if;
    if p_action='registerTrack' and old_track.user_id is not null then raise exception 'ALREADY_EXISTS'; end if;
    if p_action<>'registerTrack' and old_track.user_id is null then raise exception 'NOT_FOUND'; end if;
    if p_action<>'registerTrack' and old_track.id is distinct from (p_payload->>'trackId')::uuid then raise exception 'TRACK_CHANGED'; end if;
    if p_action='deleteTrack' then
      delete from public.tracks where room_id=room_uuid and user_id=p_actor and date_key=day_key;
    else
      if p_metadata is null or p_metadata->>'videoId'<>p_payload->>'videoId' or (p_metadata->>'embeddable')::boolean is not true then raise exception 'VIDEO_UNAVAILABLE'; end if;
      if p_action='registerTrack' then
        insert into public.tracks(room_id,user_id,date_key,video_id,title,artist,comment,duration_sec)
          values(room_uuid,p_actor,day_key,p_payload->>'videoId',p_metadata->>'title',p_metadata->>'artist',p_payload->>'comment',(p_metadata->>'durationSec')::integer);
      else
        update public.tracks set video_id=p_payload->>'videoId',title=p_metadata->>'title',artist=p_metadata->>'artist',comment=p_payload->>'comment',
          duration_sec=(p_metadata->>'durationSec')::integer,updated_at=now() where room_id=room_uuid and user_id=p_actor and date_key=day_key;
      end if;
    end if;
    -- 주제는 최초 생성 후 유지하고, 빈 날도 스냅샷을 지우지 않는다.
    insert into public.days(room_id,date_key,theme_text,track_count) values(room_uuid,day_key,private.theme_for(day_key),0) on conflict do nothing;
    update public.days set track_count=(select count(*) from public.tracks where room_id=room_uuid and date_key=day_key and not hidden),
      cover_video_id=(select video_id from public.tracks where room_id=room_uuid and date_key=day_key and not hidden order by created_at,user_id limit 1)
      where room_id=room_uuid and date_key=day_key;
    update public.rooms set revision=revision+1 where id=room_uuid;
    result:=jsonb_build_object('roomId',room_uuid,'dateKey',day_key,'trackId',coalesce((select id from public.tracks where room_id=room_uuid and user_id=p_actor and date_key=day_key),old_track.id));
  else raise exception 'INVALID_INPUT';
  end if;
  insert into private.requests(actor,action,request_id,input_hash,response)
    values(p_actor,p_action,p_request,encode(extensions.digest(p_payload::text,'sha256'),'hex'),result);
  return result;
end;
$$;

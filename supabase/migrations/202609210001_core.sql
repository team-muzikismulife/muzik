create schema if not exists private;
create extension if not exists pgcrypto with schema extensions;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 20),
  invite_code text not null unique check (invite_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  created_by uuid not null references auth.users(id),
  member_count integer not null default 0 check (member_count between 0 and 30),
  revision bigint not null default 0,
  created_at timestamptz not null default now()
);
create table public.members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  nickname text not null check (char_length(nickname) between 1 and 8),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index members_user on public.members(user_id, room_id);
create table public.tracks (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  date_key date not null,
  video_id text not null,
  title text not null,
  artist text not null,
  comment text not null check (char_length(comment) <= 30),
  duration_sec integer not null check (duration_sec >= 0),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id, date_key),
  check ((not hidden and video_id ~ '^[A-Za-z0-9_-]{11}$' and char_length(title) between 1 and 200) or
    (hidden and video_id = '' and title = '' and artist = '' and comment = ''))
);
create index tracks_date on public.tracks(room_id, date_key, created_at, user_id);
create table public.days (
  room_id uuid not null references public.rooms(id) on delete cascade,
  date_key date not null,
  theme_text text not null,
  track_count integer not null check (track_count between 0 and 30),
  cover_video_id text,
  primary key (room_id, date_key)
);
create table private.requests (
  actor uuid not null, action text not null, request_id uuid not null,
  input_hash text not null, response jsonb not null, created_at timestamptz not null default now(),
  primary key (actor, action, request_id)
);
create table private.rates (
  actor uuid not null, action text not null, bucket timestamptz not null, hits integer not null,
  primary key (actor, action, bucket)
);
create table private.video_cache (
  video_id text primary key, metadata jsonb not null, expires_at timestamptz not null
);
create table private.operators (user_id uuid primary key references auth.users(id));
create table private.moderation_archive (
  id uuid primary key default gen_random_uuid(), room_id uuid not null, original jsonb not null,
  operator_id uuid not null references auth.users(id), created_at timestamptz not null default now()
);
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on public.rooms, public.members, public.tracks, public.days from public, anon, authenticated;
grant select on public.rooms, public.members, public.tracks, public.days to authenticated;
grant all on public.rooms, public.members, public.tracks, public.days to service_role;

create function private.is_member(p_room uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.members where room_id = p_room and user_id = (select auth.uid()));
$$;
revoke all on function private.is_member(uuid) from public, anon;
grant execute on function private.is_member(uuid) to authenticated;
alter table public.rooms enable row level security;
alter table public.members enable row level security;
alter table public.tracks enable row level security;
alter table public.days enable row level security;
create policy member_read on public.rooms for select to authenticated using (private.is_member(id));
create policy member_read on public.members for select to authenticated using (private.is_member(room_id));
create policy member_read on public.tracks for select to authenticated using (private.is_member(room_id));
create policy member_read on public.days for select to authenticated using (private.is_member(room_id));

create function private.kst_day(p_now timestamptz default now()) returns date language sql immutable set search_path = '' as $$
  select (p_now at time zone 'Asia/Seoul')::date;
$$;
create function private.check_member(p_actor uuid, p_room uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.members where room_id = p_room and user_id = p_actor) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
end;
$$;
create function private.theme_for(p_day date) returns text language plpgsql immutable set search_path = '' as $$
declare h bigint:=0; s text:=p_day::text; i integer;
  themes text[]:=array['비 내릴 때 듣기 좋은 노래','월요일 출근길을 깨우는 곡','추운 겨울에 듣기 좋은 따뜻한 곡','새벽 감성 최고의 한 곡','드라이브할 때 볼륨 높이는 곡','아무에게도 안 알려주고 싶었던 숨은 명곡','가사 안 들어도 좋은 곡','첫사랑이 떠오르는 노래','운동할 때 심박수 올리는 곡','샤워하면서 따라 부르는 노래','10년 뒤에도 들을 것 같은 곡','학창시절 플레이리스트에 있던 곡','콘서트로 꼭 보고 싶은 아티스트의 곡','오늘 하루를 위로해주는 노래','여행 가는 길에 듣는 곡','한여름 밤에 어울리는 노래','집중이 필요할 때 트는 곡','이 노래 하나로 입덕한 곡','요즘 제일 많이 반복 재생한 곡','기분 좋아지는 리듬의 곡','혼자 걷는 밤에 어울리는 노래','커피 한 잔과 어울리는 곡','뮤직비디오까지 완벽한 곡','살면서 처음으로 산 앨범의 타이틀곡','실연했을 때 듣는 노래','아무 생각 없이 듣기 좋은 곡','주말 아침을 여는 노래','노래방 애창곡','영화 OST 중 최애 곡','올해 발매된 곡 중 최고의 발견'];
begin
  for i in 1..length(s) loop h:=(h*31+ascii(substr(s,i,1)))%4294967296; end loop;
  return themes[(h%30)::integer+1];
end;
$$;
create function private.replay(p_actor uuid, p_action text, p_request uuid, p_payload jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare cached private.requests;
begin
  select * into cached from private.requests where actor=p_actor and action=p_action and request_id=p_request;
  if found then
    if cached.input_hash <> encode(extensions.digest(p_payload::text, 'sha256'), 'hex') then
      raise exception 'REQUEST_CONFLICT' using errcode = 'P0001';
    end if;
    return cached.response;
  end if;
  return null;
end;
$$;
create function public.muzik_prepare(p_actor uuid, p_action text, p_request uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare cached jsonb; count_hits integer; max_hits integer;
begin
  if p_actor is null or not exists(select 1 from auth.users where id=p_actor) or
    p_action not in ('createRoom','joinRoom','getInvitePreview','updateNickname','previewTrack','registerTrack','updateTrack','deleteTrack') then
    raise exception 'INVALID_INPUT' using errcode = 'P0001';
  end if;
  if p_action not in ('createRoom','joinRoom','getInvitePreview') then perform private.check_member(p_actor,(p_payload->>'roomId')::uuid); end if;
  cached := private.replay(p_actor,p_action,p_request,p_payload);
  if cached is not null then return jsonb_build_object('replayed',true,'result',cached); end if;
  max_hits := case p_action when 'createRoom' then 5 when 'joinRoom' then 20 when 'getInvitePreview' then 30 else 60 end;
  insert into private.rates values(p_actor,p_action,date_trunc('hour',now()),1)
    on conflict(actor,action,bucket) do update set hits=private.rates.hits+1 returning hits into count_hits;
  if count_hits > max_hits then raise exception 'RATE_LIMITED' using errcode='P0001'; end if;
  return jsonb_build_object('replayed',false,'dateKey',private.kst_day());
end;
$$;
create function public.muzik_replay(p_actor uuid,p_action text,p_request uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_action not in ('createRoom','joinRoom') then perform private.check_member(p_actor,(p_payload->>'roomId')::uuid); end if;
  return private.replay(p_actor,p_action,p_request,p_payload);
end;
$$;
create function public.muzik_invite_preview(p_actor uuid,p_code text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.rooms; joined boolean;
begin
  select * into r from public.rooms where invite_code=p_code;
  if not found then raise exception 'NOT_FOUND'; end if;
  joined:=exists(select 1 from public.members where room_id=r.id and user_id=p_actor);
  return jsonb_build_object('name',r.name,'isMember',joined,'isFull',r.member_count>=30,'roomId',case when joined then r.id else null end);
end;
$$;
create function public.muzik_cache_get(p_video text) returns jsonb language sql security definer set search_path = '' as $$
  select metadata from private.video_cache where video_id=p_video and expires_at>now();
$$;
create function public.muzik_cache_put(p_video text,p_metadata jsonb) returns void language sql security definer set search_path = '' as $$
  insert into private.video_cache values(p_video,p_metadata,now()+interval '1 day')
    on conflict(video_id) do update set metadata=excluded.metadata,expires_at=excluded.expires_at;
$$;

create function public.muzik_mutate(p_actor uuid,p_action text,p_request uuid,p_payload jsonb,p_metadata jsonb default null)
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
  elsif p_action in ('registerTrack','updateTrack','deleteTrack') then
    room_uuid:=(p_payload->>'roomId')::uuid;
    select * into r from public.rooms where id=room_uuid for update;
    perform private.check_member(p_actor,room_uuid);
    if p_action<>'registerTrack' and (p_payload->>'dateKey')::date<>day_key then raise exception 'TODAY_ONLY'; end if;
    select * into old_track from public.tracks where room_id=room_uuid and user_id=p_actor and date_key=day_key;
    if old_track.hidden then raise exception 'HIDDEN_TRACK'; end if;
    if p_action='registerTrack' and old_track.user_id is not null then raise exception 'ALREADY_EXISTS'; end if;
    if p_action<>'registerTrack' and old_track.user_id is null then raise exception 'NOT_FOUND'; end if;
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
    result:=jsonb_build_object('roomId',room_uuid,'dateKey',day_key);
  else raise exception 'INVALID_INPUT';
  end if;
  insert into private.requests(actor,action,request_id,input_hash,response)
    values(p_actor,p_action,p_request,encode(extensions.digest(p_payload::text,'sha256'),'hex'),result);
  return result;
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_member(uuid) to authenticated;
revoke all on function public.muzik_prepare(uuid,text,uuid,jsonb),public.muzik_replay(uuid,text,uuid,jsonb),
  public.muzik_mutate(uuid,text,uuid,jsonb,jsonb),public.muzik_cache_get(text),public.muzik_cache_put(text,jsonb),public.muzik_invite_preview(uuid,text) from public,anon,authenticated;
grant execute on function public.muzik_prepare(uuid,text,uuid,jsonb),public.muzik_replay(uuid,text,uuid,jsonb),
  public.muzik_mutate(uuid,text,uuid,jsonb,jsonb),public.muzik_cache_get(text),public.muzik_cache_put(text,jsonb),public.muzik_invite_preview(uuid,text) to service_role;
alter publication supabase_realtime add table public.rooms;

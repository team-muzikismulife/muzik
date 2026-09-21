-- Keep behavioral metrics distinct; existing rows are retained, not reclassified.
alter table private.daily_events drop constraint daily_events_kind_check;
alter table private.daily_events add constraint daily_events_kind_check check(kind in ('visit','install_open','install_request','install_accepted','standalone'));

create or replace function public.muzik_operate(p_actor uuid,p_action text,p_request uuid,p_payload jsonb,p_metadata jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; cached jsonb; report private.reports; t public.tracks; room_uuid uuid;
begin
  perform private.check_action(p_actor,p_action,p_payload);
  if p_action='getCapabilities' then return jsonb_build_object('operator',exists(select 1 from private.operators where user_id=p_actor)); end if;
  if p_action='getOperations' then
    return jsonb_build_object(
      'reports',coalesce((select jsonb_agg(x) from (select id,room_id,track_id,reason,original,created_at from private.reports where status='open' order by created_at,id limit 50) x),'[]'::jsonb),
      'feedback',coalesce((select jsonb_agg(x) from (select id,room_id,message,created_at from private.feedback where resolved_at is null order by created_at,id limit 50) x),'[]'::jsonb),
      'metrics',coalesce((select jsonb_agg(x) from (select day_key,kind,count(*) as users from private.daily_events e where day_key>=private.kst_day()-6 and not exists(select 1 from private.operators o where o.user_id=e.actor) group by day_key,kind order by day_key desc,kind) x),'[]'::jsonb));
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text||p_action||p_request::text,0));
  cached:=private.replay(p_actor,p_action,p_request,p_payload);
  if cached is not null then return cached; end if;
  if p_action='sendFeedback' then
    if char_length(p_payload->>'message') not between 1 and 1000 then raise exception 'INVALID_INPUT'; end if;
    insert into private.feedback(actor,room_id,message) values(p_actor,(p_payload->>'roomId')::uuid,p_payload->>'message');
    result:=jsonb_build_object('received',true);
  elsif p_action='recordEvent' then
    insert into private.daily_events values(p_actor,private.kst_day(),p_payload->>'kind') on conflict do nothing;
    result:=jsonb_build_object('recorded',true,'dateKey',private.kst_day());
  elsif p_action='resolveFeedback' then
    if char_length(p_payload->>'note') not between 1 and 200 then raise exception 'INVALID_INPUT'; end if;
    update private.feedback set resolved_at=now(),resolved_by=p_actor,resolution=p_payload->>'note'
      where id=(p_payload->>'feedbackId')::uuid and resolved_at is null;
    if not found then raise exception 'NOT_FOUND'; end if;
    result:=jsonb_build_object('resolved',true);
  elsif p_action='resolveReport' then
    if p_payload->>'decision' not in ('hide','dismiss') or char_length(p_payload->>'note') not between 1 and 200 then raise exception 'INVALID_INPUT'; end if;
    select * into report from private.reports where id=(p_payload->>'reportId')::uuid;
    if not found then raise exception 'NOT_FOUND'; end if;
    -- Lock the room first, matching ordinary track mutation order.
    perform 1 from public.rooms where id=report.room_id for update;
    select * into report from private.reports where id=report.id for update;
    if report.status<>'open' then raise exception 'NOT_FOUND'; end if;
    if p_payload->>'decision'='hide' then
      select * into t from public.tracks where id=report.track_id and room_id=report.room_id for update;
      if t.id is not null and not t.hidden then
        insert into private.moderation_archive(room_id,original,operator_id) values(t.room_id,to_jsonb(t),p_actor);
        update public.tracks set hidden=true,video_id='',title='',artist='',comment='',duration_sec=0,updated_at=now() where id=t.id;
        update public.days set track_count=(select count(*) from public.tracks where room_id=t.room_id and date_key=t.date_key and not hidden),
          cover_video_id=(select video_id from public.tracks where room_id=t.room_id and date_key=t.date_key and not hidden order by created_at,user_id limit 1)
          where room_id=t.room_id and date_key=t.date_key;
        update public.rooms set revision=revision+1 where id=t.room_id;
      end if;
      update private.reports set status='hidden',resolved_by=p_actor,resolved_at=now(),resolution=p_payload->>'note' where track_id=report.track_id and status='open';
    else
      update private.reports set status='dismissed',resolved_by=p_actor,resolved_at=now(),resolution=p_payload->>'note' where id=report.id;
    end if;
    result:=jsonb_build_object('resolved',true);
  elsif p_action='refreshMeta' then
    room_uuid:=(p_payload->>'roomId')::uuid;
    perform 1 from public.rooms where id=room_uuid for update;
    select * into t from public.tracks where id=(p_payload->>'trackId')::uuid and room_id=room_uuid;
    if not found or t.hidden then raise exception 'NOT_FOUND'; end if;
    if p_metadata is null or p_metadata->>'videoId'<>t.video_id or (p_metadata->>'embeddable')::boolean is not true then raise exception 'TRACK_CHANGED'; end if;
    update public.tracks set title=p_metadata->>'title',artist=p_metadata->>'artist',duration_sec=(p_metadata->>'durationSec')::integer,updated_at=now() where id=t.id;
    update public.rooms set revision=revision+1 where id=room_uuid;
    result:=jsonb_build_object('refreshed',true);
  else raise exception 'INVALID_INPUT';
  end if;
  insert into private.requests(actor,action,request_id,input_hash,response) values(p_actor,p_action,p_request,encode(extensions.digest(p_payload::text,'sha256'),'hex'),result);
  return result;
end;
$$;

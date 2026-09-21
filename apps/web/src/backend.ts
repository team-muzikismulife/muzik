import { createClient } from "@supabase/supabase-js";
import type { Action, Video } from "../../../packages/domain/index";
import { CommandError } from "../../../packages/domain/index";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
export const supabase =
  url && key && /^https?:\/\//.test(url)
    ? createClient(url, key, {
        auth: {
          flowType: "pkce",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;
export interface Room {
  id: string;
  name: string;
  invite_code: string;
  member_count: number;
  revision: number;
}
export interface Member {
  user_id: string;
  nickname: string;
  joined_at: string;
}
export interface Track {
  id: string;
  user_id: string;
  date_key: string;
  video_id: string;
  title: string;
  artist: string;
  comment: string;
  hidden: boolean;
  created_at: string;
}
export interface Day {
  date_key: string;
  theme_text: string;
  track_count: number;
  cover_video_id: string | null;
}
export async function command<
  T = { roomId: string; code?: string; dateKey?: string; trackId?: string },
>(
  action: Action,
  payload: Record<string, string>,
  requestId: string,
): Promise<T> {
  if (!supabase) throw new Error("서비스 연결 준비 중이에요.");
  if (!navigator.onLine)
    throw new Error("오프라인이에요. 연결 후 다시 시도해 주세요.");
  const { data, error } = await supabase.functions.invoke("muzik", {
    body: { action, payload, requestId },
  });
  if (error) {
    let code: unknown = "UNAVAILABLE";
    try {
      code =
        error.context?.status === 401
          ? "UNAUTHENTICATED"
          : (await error.context.json()).code;
    } catch {
      /* 응답이 없으면 입력을 보존한다. */
    }
    throw new CommandError(code);
  }
  return data as T;
}
export async function loadTeams(): Promise<Room[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("rooms")
    .select("id,name,invite_code,member_count,revision")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("팀 목록을 불러오지 못했어요.");
  return data;
}
export async function loadRoom(id: string, date: string) {
  if (!supabase) throw new Error("서비스 연결 준비 중이에요.");
  const [room, members, tracks, days] = await Promise.all([
    supabase
      .from("rooms")
      .select("id,name,invite_code,member_count,revision")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("members")
      .select("user_id,nickname,joined_at")
      .eq("room_id", id)
      .order("joined_at")
      .limit(30),
    supabase
      .from("tracks")
      .select(
        "id,user_id,date_key,video_id,title,artist,comment,hidden,created_at",
      )
      .eq("room_id", id)
      .eq("date_key", date)
      .order("created_at")
      .order("user_id")
      .limit(30),
    supabase
      .from("days")
      .select("date_key,theme_text,track_count,cover_video_id")
      .eq("room_id", id)
      .lte("date_key", date)
      .order("date_key", { ascending: false })
      .limit(14),
  ]);
  if ([room, members, tracks, days].some((r) => r.error))
    throw new Error("팀의 음악을 불러오지 못했어요.");
  if (!room.data)
    throw new Error("팀을 찾을 수 없거나 아직 참여하지 않은 계정이에요.");
  return {
    room: room.data as Room,
    members: members.data as Member[],
    tracks: tracks.data as Track[],
    days: days.data as Day[],
  };
}
export type { Video };

export async function loadTeamSummaries(uid: string, date: string) {
  const teams = await loadTeams();
  if (!supabase || !teams.length)
    return teams.map((team) => ({ ...team, todayStatus: "아직 등록 전" }));
  const { data, error } = await supabase
    .from("tracks")
    .select("room_id,hidden")
    .eq("user_id", uid)
    .eq("date_key", date)
    .in(
      "room_id",
      teams.map((t) => t.id),
    );
  if (error) throw new Error("오늘 참여 상태를 불러오지 못했어요.");
  return teams.map((team) => {
    const track = data.find((t) => t.room_id === team.id);
    return {
      ...team,
      todayStatus: track
        ? track.hidden
          ? "내 곡 숨김 처리됨"
          : "오늘 등록 완료"
        : "아직 등록 전",
    };
  });
}
export async function loadDays(room: string, before?: string): Promise<Day[]> {
  if (!supabase) throw new Error("서비스 연결 준비 중이에요.");
  let query = supabase
    .from("days")
    .select("date_key,theme_text,track_count,cover_video_id")
    .eq("room_id", room)
    .order("date_key", { ascending: false })
    .limit(14);
  if (before) query = query.lt("date_key", before);
  const { data, error } = await query;
  if (error) throw new Error("지난 기록을 불러오지 못했어요.");
  return data;
}

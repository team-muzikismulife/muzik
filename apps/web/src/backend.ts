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
  T = { roomId: string; code?: string; dateKey?: string },
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
      code = (await error.context.json()).code;
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
        "user_id,date_key,video_id,title,artist,comment,hidden,created_at",
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

export const LIMITS = {
  roomName: 20,
  nickname: 8,
  comment: 30,
  members: 30,
} as const;
export { themeFor } from "./themes.ts";
export { CommandError, ERROR_MESSAGES, errorCode } from "./errors.ts";
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
export const INVITE_CODE = /^[A-HJ-NP-Z2-9]{6}$/;
export type Action =
  | "createRoom"
  | "joinRoom"
  | "getInvitePreview"
  | "updateNickname"
  | "reportTrack"
  | "previewTrack"
  | "registerTrack"
  | "updateTrack"
  | "deleteTrack";
export interface Video {
  videoId: string;
  title: string;
  artist: string;
  durationSec: number;
  embeddable: boolean;
}
export function todayKey(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function extractVideoId(input: string): string | null {
  const raw = input.trim();
  if (VIDEO_ID.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const host = url.hostname.replace(/^www\.|^m\./, "");
    const id =
      host === "youtu.be"
        ? url.pathname.slice(1).split("/")[0]
        : ["youtube.com", "music.youtube.com"].includes(host)
          ? url.searchParams.get("v") ||
            url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)$/)?.[1]
          : null;
    return id && VIDEO_ID.test(id) ? id : null;
  } catch {
    return null;
  }
}
export function safeReturnPath(value: string | null): string {
  if (!value || value.length > 512 || /[\\\u0000-\u001f]/.test(value))
    return "/";
  try {
    const url = new URL(value, "https://muzik.invalid");
    if (url.origin !== "https://muzik.invalid" || !value.startsWith("/"))
      return "/";
    return /^\/(?:$|room\/(?:create|join)$|r\/[A-HJ-NP-Z2-9]{6}$|room\/[0-9a-f-]{36}(?:\/playlist\/\d{4}-\d{2}-\d{2}|\/track\/(?:new|edit)|\/members|\/history)?$)/i.test(
      url.pathname,
    )
      ? url.pathname + url.search
      : "/";
  } catch {
    return "/";
  }
}
export function validatePayload(
  action: string,
  value: unknown,
): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("입력값을 확인해 주세요.");
  const rules: Record<string, Record<string, (v: string) => boolean>> = {
    createRoom: {
      name: (v) => v.length >= 1 && v.length <= 20,
      nickname: (v) => v.length >= 1 && v.length <= 8,
    },
    joinRoom: {
      code: (v) => INVITE_CODE.test(v),
      nickname: (v) => v.length >= 1 && v.length <= 8,
    },
    getInvitePreview: { code: (v) => INVITE_CODE.test(v) },
    updateNickname: {
      roomId: (v) => UUID.test(v),
      nickname: (v) => v.length >= 1 && v.length <= 8,
    },
    previewTrack: {
      roomId: (v) => UUID.test(v),
      videoId: (v) => VIDEO_ID.test(v),
    },
    registerTrack: {
      dateKey: validDate,
      roomId: (v) => UUID.test(v),
      videoId: (v) => VIDEO_ID.test(v),
      comment: (v) => v.length <= 30,
    },
    updateTrack: {
      trackId: (v) => UUID.test(v),
      roomId: (v) => UUID.test(v),
      videoId: (v) => VIDEO_ID.test(v),
      comment: (v) => v.length <= 30,
      dateKey: validDate,
    },
    deleteTrack: {
      roomId: (v) => UUID.test(v),
      dateKey: validDate,
      trackId: (v) => UUID.test(v),
    },
    reportTrack: {
      roomId: (v) => UUID.test(v),
      trackId: (v) => UUID.test(v),
      reason: (v) => v.length >= 1 && v.length <= 200,
    },
  };
  const schema = Object.hasOwn(rules, action) ? rules[action] : undefined;
  if (!schema || Object.keys(value).length !== Object.keys(schema).length)
    throw new Error("입력값을 확인해 주세요.");
  const result: Record<string, string> = {};
  for (const [key, check] of Object.entries(schema)) {
    const item = (value as Record<string, unknown>)[key];
    if (typeof item !== "string" || !check(item.trim()))
      throw new Error("입력값을 확인해 주세요.");
    result[key] = item.trim();
  }
  return result;
}

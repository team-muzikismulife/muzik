import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import {
  UUID,
  validatePayload,
  type Video,
} from "../../../packages/domain/index.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publicClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
export const messages: Record<string, string> = {
  FORBIDDEN: "이 팀에 참여한 계정인지 확인해 주세요.",
  NOT_FOUND: "팀 또는 곡을 찾을 수 없어요.",
  ROOM_FULL: "팀 정원 30명이 모두 찼어요.",
  TODAY_ONLY: "오늘 등록한 내 곡만 변경할 수 있어요.",
  HIDDEN_TRACK: "운영자가 숨긴 곡은 변경할 수 없어요.",
  ALREADY_EXISTS: "오늘은 이미 곡을 등록했어요.",
  REQUEST_CONFLICT: "요청 내용이 바뀌었어요. 다시 시도해 주세요.",
  RATE_LIMITED: "요청이 많아요. 잠시 후 다시 시도해 주세요.",
  VIDEO_UNAVAILABLE: "재생 가능한 공개 영상을 확인해 주세요.",
  UNAVAILABLE: "연결이 원활하지 않아요. 입력은 유지되니 다시 시도해 주세요.",
  INVALID_INPUT: "입력값을 확인해 주세요.",
  UNAUTHENTICATED: "Google 로그인이 필요해요.",
};
export function fail(code: string): never {
  throw new Error(code);
}
export async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await service.rpc(name, args);
  if (error)
    fail(
      messages[error.message]
        ? error.message
        : ["22P02", "23514", "23502"].includes(error.code)
          ? "INVALID_INPUT"
          : "UNAVAILABLE",
    );
  return data;
}
export function createHandler(options: {
  origins: string[];
  loadVideo: (videoId: string, request: Request) => Promise<Video>;
}) {
  return async (request: Request) => {
    const origin = request.headers.get("Origin");
    const allowed = origin && options.origins.includes(origin);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
    };
    if (allowed) headers["Access-Control-Allow-Origin"] = origin!;
    headers["Access-Control-Allow-Headers"] =
      "authorization,apikey,content-type,x-client-info";
    headers["Access-Control-Allow-Methods"] = "POST,OPTIONS";
    if (request.method === "OPTIONS")
      return new Response(null, { status: allowed ? 204 : 403, headers });
    try {
      if (request.method !== "POST" || (origin && !allowed)) fail("FORBIDDEN");
      if (Number(request.headers.get("content-length") || 0) > 8192)
        fail("INVALID_INPUT");
      const token = request.headers
        .get("Authorization")
        ?.replace(/^Bearer /i, "");
      if (!token) fail("UNAUTHENTICATED");
      const {
        data: { user },
        error,
      } = await publicClient.auth.getUser(token);
      if (
        error ||
        !user ||
        user.is_anonymous ||
        !user.app_metadata?.providers?.includes("google")
      )
        fail("UNAUTHENTICATED");
      const raw = await request.text();
      if (raw.length > 8192) fail("INVALID_INPUT");
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        fail("INVALID_INPUT");
      }
      if (
        !body ||
        Object.keys(body).sort().join(",") !== "action,payload,requestId" ||
        !UUID.test(body.requestId)
      )
        fail("INVALID_INPUT");
      let payload;
      try {
        payload = validatePayload(body.action, body.payload);
      } catch {
        fail("INVALID_INPUT");
      }
      const args = {
        p_actor: user!.id,
        p_action: body.action,
        p_request: body.requestId,
        p_payload: payload!,
      };
      const prepared = await rpc("muzik_prepare", args);
      if (prepared.replayed)
        return new Response(JSON.stringify(prepared.result), { headers });
      if (body.action === "getInvitePreview")
        return new Response(
          JSON.stringify(
            await rpc("muzik_invite_preview", {
              p_actor: user!.id,
              p_code: payload!.code,
            }),
          ),
          { headers },
        );
      let metadata = null;
      if (
        ["previewTrack", "registerTrack", "updateTrack"].includes(body.action)
      ) {
        try {
          metadata = await options.loadVideo(payload!.videoId, request);
        } catch (error) {
          // 외부 조회 중 같은 요청이 먼저 커밋되었으면 성공 결과를 복원한다.
          const cached = await rpc("muzik_replay", args);
          if (cached) return new Response(JSON.stringify(cached), { headers });
          throw error;
        }
      }
      const result =
        body.action === "previewTrack"
          ? metadata
          : await rpc("muzik_mutate", { ...args, p_metadata: metadata });
      return new Response(JSON.stringify(result), { headers });
    } catch (error) {
      const code =
        error instanceof Error && messages[error.message]
          ? error.message
          : "UNAVAILABLE";
      const status =
        code === "UNAUTHENTICATED"
          ? 401
          : code === "FORBIDDEN"
            ? 403
            : code === "UNAVAILABLE"
              ? 503
              : code === "RATE_LIMITED"
                ? 429
                : 400;
      return new Response(JSON.stringify({ code, message: messages[code] }), {
        status,
        headers,
      });
    }
  };
}

import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import {
  UUID,
  ERROR_MESSAGES,
  errorCode,
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
export const messages = ERROR_MESSAGES;
export function fail(code: string): never {
  throw new Error(code);
}
export async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await service.rpc(name, args);
  if (error)
    fail(
      Object.hasOwn(messages, error.message)
        ? error.message
        : ["22P02", "23514", "23502"].includes(error.code)
          ? "INVALID_INPUT"
          : "UNAVAILABLE",
    );
  return data;
}
export function createHandler(options: {
  origins: string[];
  loadVideo: (
    videoId: string,
    request: Request,
    refresh?: boolean,
  ) => Promise<Video>;
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
        [
          "previewTrack",
          "registerTrack",
          "updateTrack",
          "refreshMeta",
        ].includes(body.action)
      ) {
        try {
          metadata = await options.loadVideo(
            body.action === "refreshMeta" ? prepared.videoId : payload!.videoId,
            request,
            body.action === "refreshMeta",
          );
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
          : await rpc(
              [
                "getCapabilities",
                "getOperations",
                "resolveReport",
                "sendFeedback",
                "resolveFeedback",
                "recordEvent",
                "refreshMeta",
              ].includes(body.action)
                ? "muzik_operate"
                : "muzik_mutate",
              { ...args, p_metadata: metadata },
            );
      return new Response(JSON.stringify(result), { headers });
    } catch (error) {
      const code = errorCode(error instanceof Error ? error.message : null);
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

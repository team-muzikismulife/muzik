import {
  createHandler,
  fail,
} from "../../supabase/functions/_shared/handler.ts";
const url = Deno.env.get("SUPABASE_URL") || "";
if (
  !/^http:\/\/(?:kong:8000|localhost:54321|127\.0\.0\.1:54321)$/.test(url) ||
  Deno.env.get("DENO_DEPLOYMENT_ID")
)
  throw new Error("로컬 Supabase 전용 테스트 진입점");
Deno.serve(
  createHandler({
    origins: [
      "https://127.0.0.1:4174",
      "http://127.0.0.1:4173",
      "http://localhost:4173",
      "http://127.0.0.1:5173",
      "http://localhost:5173",
    ],
    loadVideo: async (videoId, request) => {
      if (
        request.headers.get("x-muzik-test-video-fail") === "1" ||
        videoId === "FAIL_______"
      )
        fail("UNAVAILABLE");
      return {
        videoId,
        title: "검증용 음악",
        artist: "MUZIK 테스트",
        durationSec: 180,
        embeddable: true,
      };
    },
  }),
);

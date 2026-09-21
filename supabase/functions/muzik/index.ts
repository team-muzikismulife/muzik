import { createHandler } from "../_shared/handler.ts";
import { loadVideo } from "../_shared/youtube.ts";
Deno.serve(
  createHandler({
    loadVideo,
    origins: (Deno.env.get("WEB_ORIGINS") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  }),
);

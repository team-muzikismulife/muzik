import type { Video } from "../../../packages/domain/index.ts";
import { fail, rpc } from "./handler.ts";
export async function loadVideo(
  videoId: string,
  _request: Request,
): Promise<Video> {
  const cached = await rpc("muzik_cache_get", { p_video: videoId });
  if (cached) return cached as Video;
  const key = Deno.env.get("YOUTUBE_API_KEY");
  if (!key) fail("UNAVAILABLE");
  let response: Response;
  try {
    response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,status,contentDetails&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(key)}`,
      { signal: AbortSignal.timeout(7000) },
    );
  } catch {
    fail("UNAVAILABLE");
  }
  if (!response!.ok) fail("UNAVAILABLE");
  const item = (await response!.json()).items?.[0];
  if (
    !item ||
    !item.status?.embeddable ||
    item.status?.privacyStatus !== "public" ||
    item.contentDetails?.regionRestriction
  )
    fail("VIDEO_UNAVAILABLE");
  const duration = String(item.contentDetails?.duration ?? "").match(
    /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/,
  );
  if (!duration) fail("VIDEO_UNAVAILABLE");
  const metadata = {
    videoId,
    title: String(item.snippet.title).slice(0, 200),
    artist: String(item.snippet.channelTitle).slice(0, 200),
    durationSec:
      Number(duration[1] || 0) * 3600 +
      Number(duration[2] || 0) * 60 +
      Number(duration[3] || 0),
    embeddable: true,
  };
  await rpc("muzik_cache_put", { p_video: videoId, p_metadata: metadata });
  return metadata;
}

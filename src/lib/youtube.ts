/**
 * 유튜브 링크 파싱 유틸.
 * 지원: watch?v=, youtu.be/, shorts/, embed/, music.youtube.com (+ si, feature 등 잡다한 파라미터)
 * 메타데이터는 쿼터 없는 oEmbed 우선 사용 (기획서: 곡명/채널명/썸네일 자동 추출).
 */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function extractVideoId(input: string): string | null {
  const raw = input.trim();
  if (VIDEO_ID.test(raw)) return raw; // ID 자체를 붙여넣은 경우

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\.|^m\./, '');

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return VIDEO_ID.test(id) ? id : null;
  }

  if (host === 'youtube.com' || host === 'music.youtube.com') {
    const v = url.searchParams.get('v');
    if (v && VIDEO_ID.test(v)) return v;

    const m = url.pathname.match(/^\/(shorts|embed|live)\/([A-Za-z0-9_-]{11})/);
    if (m) return m[2];
  }

  return null;
}

export interface VideoMeta {
  videoId: string;
  title: string;
  author: string; // 채널명(가수명 대용)
}

/**
 * 썸네일 URL은 **videoId에서 파생한다. 저장하지 않는다.**
 * (유튜브연동설계 §1 "videoId만이 영구 원본")
 * 별도 필드로 저장하면 videoId와 어긋날 수 있고, 실제로 어긋났었다.
 *
 * 유튜브 썸네일 규격 (2026-07 실측):
 * | 파일              | 크기      | 비율        | 가용성        |
 * | maxresdefault    | 1280×720 | 16:9 깨끗   | **404 잦음**  |
 * | sddefault        |  640×480 | 4:3 레터박스 | 대체로 있음    |
 * | hqdefault        |  480×360 | 4:3 레터박스 | 항상 있음      |
 * | mqdefault        |  320×180 | 16:9 깨끗   | 항상 있음      |
 *
 * 레터박스(위아래 검은 띠) 소스는 **16:9 컨테이너에 cover로 넣으면 띠가 정확히 잘린다** —
 * 480×360에서 16:9 콘텐츠 높이는 270이고 띠가 위아래 45px씩인데, 이게 딱 크롭되는 양이다.
 * 그래서 YoutubeArt는 항상 16:9 박스 안에 그린다 → 세 해상도를 모두 안전하게 쓸 수 있다.
 */
export const THUMB_CHAIN = ['maxresdefault', 'sddefault', 'mqdefault'] as const;
export type ThumbQuality = (typeof THUMB_CHAIN)[number];

export function thumbnailUrl(videoId: string, quality: ThumbQuality = 'maxresdefault'): string {
  return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
}

/** maxresdefault가 404 대신 120×90 회색 플레이스홀더를 200으로 주는 경우가 있다 */
export const PLACEHOLDER_MAX_WIDTH = 320;

/**
 * 유튜브 핸드오프 재생 URL — 무인증·무쿼터 임시 재생목록(watch_videos).
 * 열면 TLGG… 임시 리스트로 리다이렉트되어 유튜브(앱/웹)에서 순서대로 연속 재생됨.
 * 비공식 엔드포인트(2026-03 동작 확인) → 실패 시 첫 곡 단독 재생으로 폴백할 것.
 * 최대 50개 제한.
 */
export function buildWatchVideosUrl(videoIds: string[]): string {
  return `https://www.youtube.com/watch_videos?video_ids=${videoIds.slice(0, 50).join(',')}`;
}

/**
 * 곡 메타데이터 — oEmbed (쿼터 0, 인증 불필요).
 * 썸네일은 반환하지 않는다. videoId에서 파생하므로 저장·전달할 이유가 없다.
 */
export async function fetchVideoMeta(videoId: string): Promise<VideoMeta> {
  const res = await fetch(
    `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
  );
  // 404 = 비공개·삭제된 영상 (유튜브연동설계 §5 unavailable 판정 근거)
  if (!res.ok) throw new Error(`oEmbed 실패: ${res.status}`);
  const data = (await res.json()) as { title: string; author_name: string };
  return { videoId, title: data.title, author: data.author_name };
}

/**
 * iTunes Search API — 곡명/가수 **텍스트 보정 전용** (무키·무쿼터).
 *
 * ⚠️ 앨범아트(artworkUrl)는 가져오지 않는다. 썸네일은 videoId에서 파생하는 것이 유일 원본이다
 * (CLAUDE.md 핵심결정 8 — "따로 저장하면 videoId와 어긋난다. 실제로 어긋났었다").
 * iTunes 아트를 별도 저장/표시하면 그 어긋남을 되부른다. 여기서는 trackName/artistName만 읽어
 * 편집 필드의 초기값을 다듬는 데만 쓴다. videoId·재생·썸네일은 전부 유튜브 원본 그대로 둔다.
 *
 * best-effort: 실패·무결과·네트워크 오류·비카탈로그 영상이면 null → 휴리스틱(parseTitle) 값 유지.
 */
export interface ItunesTrack {
  title: string;
  artist: string;
}

export async function searchTrack(query: string): Promise<ItunesTrack | null> {
  const q = query.trim();
  if (!q) return null;
  try {
    const url =
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}` +
      `&media=music&entity=song&limit=1&country=KR`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: { trackName?: string; artistName?: string }[];
    };
    const hit = data.results?.[0];
    if (!hit?.trackName || !hit?.artistName) return null;
    return { title: hit.trackName, artist: hit.artistName };
  } catch {
    return null; // 네트워크 실패 등은 조용히 폴백한다 (등록을 막지 않는다)
  }
}

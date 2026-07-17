/**
 * Firestore 데이터 모델 — 정본은 docs/백엔드설계.md §2
 *
 * 대원칙 (유튜브연동설계 §1): **videoId만이 영구 원본. 나머지는 전부 캐시다.**
 * 그래서 썸네일 URL은 필드로 두지 않는다 — videoId에서 파생한다(`src/lib/youtube.ts`).
 * 저장하면 videoId와 어긋날 수 있고, 실제로 어긋났었다(목업의 곡 제목과 배경 이미지 불일치).
 */

export interface Room {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: number;
  createdBy: string;
  memberCount: number;
}

export interface Member {
  uid: string;
  nickname: string;
  joinedAt: number;
  /** 서버가 닉네임 해시로 확정 — 기기 간 같은 색을 보장한다 (colors.avatarPalette와 같은 규칙) */
  photoColor: string;
}

/** 문서 ID = `${uid}_${dateKey}` → 하루 1곡 강제 (설계 결정 #2) */
export interface Track {
  /** 유일한 영구 원본. 썸네일·재생 URL이 전부 여기서 파생된다 */
  videoId: string;
  /** 아래 메타는 등록 시점의 스냅샷(캐시) — 30일 경과 시 refreshMeta로 갱신 */
  title: string;
  artist: string; // 채널명
  comment: string; // ≤ 30자
  uid: string;
  nickname: string;
  dateKey: string; // 'YYYY-MM-DD' (KST, 자정 컷)
  order: number; // 서버 epoch — 재생 순서
  createdAt: number;
  /** videos.list 검증 결과 — false면 인앱 미리듣기에서 스킵하고 "유튜브 전용" 배지 */
  embeddable: boolean;
  durationSec: number;
  metaRefreshedAt: number;
  /** oEmbed 404(삭제된 영상) — "재생 불가" 표시 + 핸드오프 URL에서 제외 */
  unavailable?: boolean;
}

/**
 * 날짜별 집계 — 날짜 탭·과거 목록의 데이터 소스.
 * Firestore가 distinct를 못 해서 "존재하는 dateKey 목록"을 뽑을 수 없기 때문에 필요하다.
 */
export interface Day {
  dateKey: string;
  trackCount: number;
  /** 대표 이미지도 videoId로 저장한다 — URL을 저장하면 어긋날 수 있다 */
  coverVideoId: string;
  /** 그날 첫 곡이 올라온 순간의 미션 스냅샷. 이후 덮어쓰지 않는다 (구현계획서 §2) */
  themeText: string;
  updatedAt: number;
}

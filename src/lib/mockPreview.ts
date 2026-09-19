import { todayKey } from './date';
import { themeFor } from './themes';
import type { Day, Member, Room, Track } from '@/types/models';

/**
 * 목업 프리뷰 — 로그인·실데이터 없이 화면을 보여주기 위한 가짜 방.
 *
 * 배포된 웹 데모의 첫인상을 위해 존재한다. 익명 로그인이 막히거나 팀이 하나도 없어도
 * "빈 화면"이 아니라 살아 있는 팀 홈이 보여야 하기 때문.
 *
 * ⚠️ `EXPO_PUBLIC_MOCK_PREVIEW`가 켜져 있을 때만 동작한다. 실서비스 빌드에선 꺼둔다.
 * ⚠️ videoId는 **실제 영상의 실제 메타**여야 한다 (CLAUDE.md 설계 결정 #8) —
 *    썸네일이 videoId에서 파생되므로, 가짜 videoId를 쓰면 제목과 이미지가 어긋난다.
 */

const MOCK_FLAG_VALUES = new Set(['1', 'true', 'yes']);

export function isMockPreviewEnabled(): boolean {
  const flag = process.env.EXPO_PUBLIC_MOCK_PREVIEW?.trim().toLowerCase();
  return MOCK_FLAG_VALUES.has(flag ?? '');
}

export const MOCK_ROOM_ID = 'mock-preview-room';
const MOCK_INVITE_CODE = 'MOCK12';
/** 고정 epoch — 렌더할 때마다 값이 흔들리면 스냅샷 비교가 무의미해진다 */
const MOCK_EPOCH = 1_800_000_000_000;

/**
 * 목업에서 '나'의 uid — 실제 로그인이 됐다면 그 uid를 쓴다(내 곡 수정 동선을 보여주려고).
 *
 * 모듈 전역에 담아두지 않는다. 그러면 "어느 화면을 먼저 열었는지"에 따라 값이 달라진다 —
 * 팀 목록을 거치지 않고 방으로 바로 들어오면 세션 uid가 바인딩되지 않아,
 * 내 곡인데도 `isMine`이 false가 되어 수정·삭제 메뉴가 사라진다.
 */
const DEFAULT_MOCK_SELF_UID = 'mock-you';

export function isMockRoomId(roomId: string): boolean {
  return isMockPreviewEnabled() && roomId === MOCK_ROOM_ID;
}

/** 오늘 기준 상대 날짜의 dateKey (0 = 오늘, -1 = 어제) */
function relativeDateKey(offset: number): string {
  const [y, m, d] = todayKey().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
}

const DAY_OFFSETS = [0, -1, -2, -3, -4];

function mockMembers(selfUid: string): Member[] {
  return [
    { uid: selfUid, nickname: '승완', joinedAt: MOCK_EPOCH, photoColor: '#7C5CFF' },
    { uid: 'mock-boggu', nickname: '보규', joinedAt: MOCK_EPOCH + 1, photoColor: '#38BDF8' },
    { uid: 'mock-gyoho', nickname: '규호', joinedAt: MOCK_EPOCH + 2, photoColor: '#4ADE80' },
    { uid: 'mock-sooyun', nickname: '수윤', joinedAt: MOCK_EPOCH + 3, photoColor: '#E60076' },
  ];
}

/** 목업 트랙 한 건 — 공통 필드를 채운다 */
function track(
  t: Pick<Track, 'videoId' | 'title' | 'artist' | 'comment' | 'uid' | 'nickname' | 'dateKey' | 'order'>,
): Track {
  return { ...t, createdAt: MOCK_EPOCH + t.order, embeddable: true, durationSec: 210, metaRefreshedAt: MOCK_EPOCH };
}

function mockTracksByDate(selfUid: string): Record<string, Track[]> {
  const [today, d1, d2, d3, d4] = DAY_OFFSETS.map(relativeDateKey);
  const self = selfUid;

  return {
    [today]: [
      track({ videoId: 'OPf0YbXqDm0', title: 'Uptown Funk', artist: 'Mark Ronson', comment: '출근길 텐션 올리는 곡', uid: self, nickname: '승완', dateKey: today, order: 1 }),
      track({ videoId: 'CevxZvSJLk8', title: 'Roar', artist: 'Katy Perry', comment: '월요일을 밀어붙이는 느낌', uid: 'mock-gyoho', nickname: '규호', dateKey: today, order: 2 }),
    ],
    [d1]: [
      track({ videoId: 'kJQP7kiw5Fk', title: 'Despacito', artist: 'Luis Fonsi', comment: '늦여름 저녁에 잘 맞음', uid: self, nickname: '승완', dateKey: d1, order: 1 }),
      track({ videoId: '9bZkp7q19f0', title: 'Gangnam Style', artist: 'PSY', comment: '다 같이 웃기 좋은 곡', uid: 'mock-boggu', nickname: '보규', dateKey: d1, order: 2 }),
      track({ videoId: 'RgKAFK5djSk', title: 'See You Again', artist: 'Wiz Khalifa', comment: '하루 마무리용', uid: 'mock-gyoho', nickname: '규호', dateKey: d1, order: 3 }),
    ],
    [d2]: [
      track({ videoId: 'fJ9rUzIMcZQ', title: 'Bohemian Rhapsody', artist: 'Queen', comment: '길게 들어도 안 질림', uid: 'mock-boggu', nickname: '보규', dateKey: d2, order: 1 }),
      track({ videoId: 'Zi_XLOBDo_Y', title: 'Billie Jean', artist: 'Michael Jackson', comment: '베이스라인이 너무 좋음', uid: 'mock-sooyun', nickname: '수윤', dateKey: d2, order: 2 }),
    ],
    [d3]: [
      track({ videoId: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', artist: 'Rick Astley', comment: '기분 전환용 클래식', uid: self, nickname: '승완', dateKey: d3, order: 1 }),
      track({ videoId: 'hT_nvWreIhg', title: 'Counting Stars', artist: 'OneRepublic', comment: '밤 산책에 어울림', uid: 'mock-gyoho', nickname: '규호', dateKey: d3, order: 2 }),
    ],
    [d4]: [
      track({ videoId: 'JGwWNGJdvx8', title: 'Shape of You', artist: 'Ed Sheeran', comment: '가볍게 틀어두기 좋음', uid: 'mock-sooyun', nickname: '수윤', dateKey: d4, order: 1 }),
    ],
  };
}

export interface MockRoomState {
  room: Room;
  members: Member[];
  days: Day[];
  tracks: Track[];
}

/** 방 홈이 쓰는 목업 상태 — `dateKey`에 해당하는 트랙만 tracks로 준다 */
export function getMockRoomState(dateKey: string, uid?: string | null): MockRoomState {
  const selfUid = uid ?? DEFAULT_MOCK_SELF_UID;
  const members = mockMembers(selfUid);
  const byDate = mockTracksByDate(selfUid);

  return {
    room: {
      id: MOCK_ROOM_ID,
      name: '목업 테스트 팀',
      inviteCode: MOCK_INVITE_CODE,
      createdAt: MOCK_EPOCH,
      createdBy: selfUid,
      memberCount: members.length,
    },
    members,
    days: DAY_OFFSETS.map((offset) => {
      const key = relativeDateKey(offset);
      const tracks = byDate[key] ?? [];
      return {
        dateKey: key,
        trackCount: tracks.length,
        coverVideoId: tracks[0]?.videoId ?? 'dQw4w9WgXcQ',
        themeText: themeFor(key),
        updatedAt: MOCK_EPOCH + Math.abs(offset) * 100_000,
      };
    }),
    tracks: byDate[dateKey] ?? [],
  };
}

/** 특정 날짜의 목업 트랙 — 날짜별 상세·공동 플리가 쓴다 */
export function getMockTracks(dateKey: string, uid?: string | null): Track[] {
  return mockTracksByDate(uid ?? DEFAULT_MOCK_SELF_UID)[dateKey] ?? [];
}

/** 목업 방의 전체 곡 (등록 순) — 공동 플리 미리보기용 */
export function getMockAllTracks(uid?: string | null): Track[] {
  const byDate = mockTracksByDate(uid ?? DEFAULT_MOCK_SELF_UID);
  return DAY_OFFSETS.map(relativeDateKey).flatMap((key) => byDate[key] ?? []);
}

export interface MockTeamSummary {
  id: string;
  name: string;
  memberCount: number;
  members: { uid: string; nickname: string; photoColor: string }[];
}

/** 팀 목록에 끼워 넣을 목업 팀 카드 */
export function getMockTeamSummary(uid?: string | null): MockTeamSummary {
  const members = mockMembers(uid ?? DEFAULT_MOCK_SELF_UID);
  return {
    id: MOCK_ROOM_ID,
    name: '목업 테스트 팀',
    memberCount: members.length,
    members: members.map(({ uid: u, nickname, photoColor }) => ({ uid: u, nickname, photoColor })),
  };
}

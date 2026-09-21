import { todayKey } from './date';
import { themeFor } from './themes';
import { isMockPreviewEnabled } from './mockPreview';
import type { TeamSummary } from './db';
import type { Day, Member, Room, Track } from '@/types/models';

export { isMockPreviewEnabled };
export const MOCK_ROOM_ID = 'mock-preview-room';

const MOCK_INVITE_CODE = 'MOCK12';
const BASE_TIME = 1_800_000_000_000;
let previewUid = 'mock-you';

export function isMockRoomId(roomId: string): boolean {
  return isMockPreviewEnabled() && roomId === MOCK_ROOM_ID;
}

export function getMockTeamSummary(uid: string | null): TeamSummary {
  rememberPreviewUid(uid);

  return {
    id: MOCK_ROOM_ID,
    name: '목업 테스트 팀',
    memberCount: mockMembers().length,
    members: mockMembers().map(({ uid: memberUid, nickname, photoColor }) => ({
      uid: memberUid,
      nickname,
      photoColor,
    })),
  };
}

export function getMockRoomState(dateKey: string): {
  room: Room;
  members: Member[];
  days: Day[];
  tracks: Track[];
} {
  const members = mockMembers();
  const tracks = mockTracksByDate()[dateKey] ?? [];

  return {
    room: {
      id: MOCK_ROOM_ID,
      name: '목업 테스트 팀',
      inviteCode: MOCK_INVITE_CODE,
      createdAt: BASE_TIME,
      createdBy: previewUid,
      memberCount: members.length,
    },
    members,
    days: mockDays(),
    tracks,
  };
}

function rememberPreviewUid(uid: string | null) {
  if (uid) previewUid = uid;
}

function mockMembers(): Member[] {
  return [
    { uid: previewUid, nickname: '승완', joinedAt: BASE_TIME, photoColor: '#7C5CFF' },
    { uid: 'mock-boggu', nickname: '보규', joinedAt: BASE_TIME + 1, photoColor: '#38BDF8' },
    { uid: 'mock-gyoho', nickname: '규호', joinedAt: BASE_TIME + 2, photoColor: '#4ADE80' },
    { uid: 'mock-sooyun', nickname: '수윤', joinedAt: BASE_TIME + 3, photoColor: '#E60076' },
  ];
}

function offsetDateKey(offsetDays: number): string {
  const [year, month, day] = todayKey().split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offsetDays));
  return date.toISOString().slice(0, 10);
}

function mockDays(): Day[] {
  return [0, -1, -2, -3, -4].map((offset) => {
    const dateKey = offsetDateKey(offset);
    const tracks = mockTracksByDate()[dateKey] ?? [];

    return {
      dateKey,
      trackCount: tracks.length,
      coverVideoId: tracks[0]?.videoId ?? 'dQw4w9WgXcQ',
      themeText: themeFor(dateKey),
      updatedAt: BASE_TIME + Math.abs(offset) * 100_000,
    };
  });
}

function mockTracksByDate(): Record<string, Track[]> {
  const dateKeys = [0, -1, -2, -3, -4].map(offsetDateKey);
  const [today, yesterday, twoDaysAgo, threeDaysAgo, fourDaysAgo] = dateKeys;

  return {
    [today]: [
      track({
        videoId: 'OPf0YbXqDm0',
        title: 'Uptown Funk',
        artist: 'Mark Ronson',
        comment: '출근길 텐션 올리는 곡',
        uid: previewUid,
        nickname: '승완',
        dateKey: today,
        order: 1,
      }),
      track({
        videoId: 'CevxZvSJLk8',
        title: 'Roar',
        artist: 'Katy Perry',
        comment: '월요일을 밀어붙이는 느낌',
        uid: 'mock-gyoho',
        nickname: '규호',
        dateKey: today,
        order: 2,
      }),
    ],
    [yesterday]: [
      track({
        videoId: 'kJQP7kiw5Fk',
        title: 'Despacito',
        artist: 'Luis Fonsi',
        comment: '늦여름 저녁에 잘 맞음',
        uid: previewUid,
        nickname: '승완',
        dateKey: yesterday,
        order: 1,
      }),
      track({
        videoId: '9bZkp7q19f0',
        title: 'Gangnam Style',
        artist: 'PSY',
        comment: '다 같이 웃기 좋은 곡',
        uid: 'mock-boggu',
        nickname: '보규',
        dateKey: yesterday,
        order: 2,
      }),
      track({
        videoId: 'RgKAFK5djSk',
        title: 'See You Again',
        artist: 'Wiz Khalifa',
        comment: '하루 마무리용',
        uid: 'mock-gyoho',
        nickname: '규호',
        dateKey: yesterday,
        order: 3,
      }),
    ],
    [twoDaysAgo]: [
      track({
        videoId: 'fJ9rUzIMcZQ',
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        comment: '길게 들어도 안 질림',
        uid: 'mock-boggu',
        nickname: '보규',
        dateKey: twoDaysAgo,
        order: 1,
      }),
      track({
        videoId: 'Zi_XLOBDo_Y',
        title: 'Billie Jean',
        artist: 'Michael Jackson',
        comment: '베이스라인이 너무 좋음',
        uid: 'mock-sooyun',
        nickname: '수윤',
        dateKey: twoDaysAgo,
        order: 2,
      }),
    ],
    [threeDaysAgo]: [
      track({
        videoId: 'dQw4w9WgXcQ',
        title: 'Never Gonna Give You Up',
        artist: 'Rick Astley',
        comment: '기분 전환용 클래식',
        uid: previewUid,
        nickname: '승완',
        dateKey: threeDaysAgo,
        order: 1,
      }),
      track({
        videoId: 'hT_nvWreIhg',
        title: 'Counting Stars',
        artist: 'OneRepublic',
        comment: '밤 산책에 어울림',
        uid: 'mock-gyoho',
        nickname: '규호',
        dateKey: threeDaysAgo,
        order: 2,
      }),
    ],
    [fourDaysAgo]: [
      track({
        videoId: 'JGwWNGJdvx8',
        title: 'Shape of You',
        artist: 'Ed Sheeran',
        comment: '가볍게 틀어두기 좋음',
        uid: 'mock-sooyun',
        nickname: '수윤',
        dateKey: fourDaysAgo,
        order: 1,
      }),
    ],
  };
}

function track(input: {
  videoId: string;
  title: string;
  artist: string;
  comment: string;
  uid: string;
  nickname: string;
  dateKey: string;
  order: number;
}): Track {
  return {
    ...input,
    createdAt: BASE_TIME + input.order,
    embeddable: true,
    durationSec: 210,
    metaRefreshedAt: BASE_TIME,
  };
}

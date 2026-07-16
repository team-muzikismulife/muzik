import { create } from 'zustand';
import { todayKey } from '@/lib/date';
import type { Track } from '@/types/models';

/**
 * 트랙 store (M2-a) — Firebase가 아직 없어 로컬이 "가짜 백엔드" 역할을 한다.
 * registerTrack이 여기에 upsert하고(=쓰기), 홈이 여기를 구독한다(=실시간 반영).
 * M2-b에서 onSnapshot(tracks) 구독으로 교체되면 이 파일은 사라진다 (docs/곡등록설계.md §8).
 *
 * 키 = `${roomId}/${uid}_${dateKey}` — **Firestore 경로를 그대로 흉내낸다**.
 * 실제 스키마에서 tracks는 `rooms/{roomId}/tracks/{uid}_{dateKey}`라 roomId가 **경로에** 있고
 * 문서 필드에는 없다(백엔드설계.md §2). 로컬 store엔 경로가 없으니 키가 그 역할을 대신해야 한다.
 * roomId를 빼면 방 A의 곡이 방 B 홈에 보이고, 방 A에 올렸다는 이유로 방 B 등록이 막힌다.
 * (그래서 `Track`에 roomId 필드를 더하지 않는다 — 스키마가 어긋나고 M2-b 교체가 지저분해진다.)
 *
 * "이미 올렸는가"를 이 키의 존재로 판정하므로 서버의 create-only와 같은 분기가 된다(설계 결정 #2).
 */
export const trackDocId = (roomId: string, uid: string, dateKey: string) =>
  `${roomId}/${uid}_${dateKey}`;

/**
 * 데모 시드 — 팀원 두 명의 오늘 곡. M1에서 실제 members/tracks 구독으로 대체된다.
 * **store 상태가 아니라 읽기 시점에 합쳐지는 표시용 목업이다** — MOCK_MEMBERS가 방과 무관한
 * 전역 목업이므로 시드도 모든 방에서 같게 보이는 게 맞다. store에는 실제 등록만 담긴다.
 * 목업도 **실제 videoId의 실제 메타**여야 한다 (CLAUDE.md 설계 결정 #8) — 지어내지 말 것.
 */
const SEED: Track[] = [
  {
    videoId: 'pM86f0NAsCY', // 백예린 '1-4-3' Lyric Video
    title: '1-4-3',
    artist: 'Yerin Baek',
    comment: '1-4-3의 의미는 I LOVE YOU',
    uid: 'u1',
    nickname: '보규',
    dateKey: todayKey(),
    order: 1,
    createdAt: Date.now(),
    embeddable: true,
    durationSec: 218,
    metaRefreshedAt: Date.now(),
  },
  {
    videoId: 'JaIMSzE5yLA', // 실리카겔 'NO PAIN' M/V
    title: 'NO PAIN',
    artist: 'Silica Gel 실리카겔',
    comment: '',
    uid: 'u3',
    nickname: '규호',
    dateKey: todayKey(),
    order: 2,
    createdAt: Date.now(),
    embeddable: true,
    durationSec: 254,
    metaRefreshedAt: Date.now(),
  },
];

interface TrackStore {
  /** key = `${roomId}/${uid}_${dateKey}` — 실제 등록만 담는다(시드는 tracksForDate가 합친다) */
  byId: Record<string, Track>;
  upsert: (roomId: string, track: Track) => void;
  /** 이 방에 오늘 이미 올렸는가 — 하루 1곡 낙관 차단·재진입 분기에 쓴다 */
  has: (roomId: string, uid: string, dateKey: string) => boolean;
}

export const useTrackStore = create<TrackStore>((set, get) => ({
  byId: {},
  upsert: (roomId, track) =>
    set((s) => ({ byId: { ...s.byId, [trackDocId(roomId, track.uid, track.dateKey)]: track } })),
  has: (roomId, uid, dateKey) => trackDocId(roomId, uid, dateKey) in get().byId,
}));

/**
 * 특정 방·날짜의 곡들 — order 순 (홈·플레이리스트 셀렉터).
 * byId를 구독하고 이 함수로 파생한다 — 셀렉터가 매번 새 배열을 만들지 않도록.
 *
 * **roomId로 반드시 걸러야 한다.** Firestore였다면 `rooms/{roomId}/tracks` 경로가 이 일을
 * 공짜로 해줬을 것을, 로컬 store에선 키 접두사로 대신한다.
 */
export function tracksForDate(
  byId: Record<string, Track>,
  roomId: string,
  dateKey: string,
): Track[] {
  const registered = Object.entries(byId)
    .filter(([key]) => key.startsWith(`${roomId}/`))
    .map(([, track]) => track)
    .filter((t) => t.dateKey === dateKey);

  return [...SEED.filter((t) => t.dateKey === dateKey), ...registered].sort(
    (a, b) => a.order - b.order,
  );
}

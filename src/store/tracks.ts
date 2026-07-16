import { create } from 'zustand';
import { todayKey } from '@/lib/date';
import type { Track } from '@/types/models';

/**
 * 트랙 store (M2-a) — Firebase가 아직 없어 로컬이 "가짜 백엔드" 역할을 한다.
 * registerTrack이 여기에 upsert하고(=쓰기), 홈이 여기를 구독한다(=실시간 반영).
 * M2-b에서 onSnapshot(tracks) 구독으로 교체되면 이 파일은 사라진다 (docs/곡등록설계.md §8).
 *
 * 키 = `${uid}_${dateKey}` — Firestore 문서 ID 규칙과 동일하다(하루 1곡, 설계 결정 #2).
 * "이미 올렸는가"를 이 키의 존재로 판정하므로 서버의 create-only와 같은 분기가 된다.
 */
export const trackDocId = (uid: string, dateKey: string) => `${uid}_${dateKey}`;

/**
 * 데모 시드 — 팀원 두 명의 오늘 곡. M1에서 실제 members/tracks 구독으로 대체된다.
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
  /** key = `${uid}_${dateKey}` */
  byId: Record<string, Track>;
  upsert: (track: Track) => void;
  /** 오늘 이미 올렸는가 — 하루 1곡 낙관 차단·재진입 분기에 쓴다 */
  has: (uid: string, dateKey: string) => boolean;
}

export const useTrackStore = create<TrackStore>((set, get) => ({
  byId: Object.fromEntries(SEED.map((t) => [trackDocId(t.uid, t.dateKey), t])),
  upsert: (track) =>
    set((s) => ({ byId: { ...s.byId, [trackDocId(track.uid, track.dateKey)]: track } })),
  has: (uid, dateKey) => trackDocId(uid, dateKey) in get().byId,
}));

/**
 * 특정 날짜의 곡들 — order 순 (홈·플레이리스트 셀렉터).
 * byId를 구독하고 이 함수로 파생한다 — 셀렉터가 매번 새 배열을 만들지 않도록.
 */
export function tracksForDate(byId: Record<string, Track>, dateKey: string): Track[] {
  return Object.values(byId)
    .filter((t) => t.dateKey === dateKey)
    .sort((a, b) => a.order - b.order);
}

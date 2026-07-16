import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { todayKey } from './date';
import type { VideoMeta } from './youtube';
import { RegisterTrackInput, type CreateRoomInput, type JoinRoomInput } from '@/schemas';
import { useTrackStore } from '@/store/tracks';
import type { Track } from '@/types/models';

/**
 * 쓰기 레이어 (docs/frontend.md § Data Fetching)
 * 쓰기는 전부 Cloud Functions callable을 경유한다. 컴포넌트에서 httpsCallable을 직접 부르지 않는다.
 *
 * 에러는 여기서 삼키지 않는다 — 화면이 `toMessage(e)`로 문구를 만들고 다음 행동을 준다.
 */

export interface CreateRoomResult {
  roomId: string;
  inviteCode: string;
}

/** 팀 개설 → roomId + 6자리 초대 코드 (백엔드설계.md §3) */
export async function createRoom(input: CreateRoomInput): Promise<CreateRoomResult> {
  const call = httpsCallable<CreateRoomInput, CreateRoomResult>(functions, 'createRoom');
  const { data } = await call(input);
  return data;
}

export interface JoinRoomResult {
  roomId: string;
}

/** 초대 코드로 입장 → roomId (백엔드설계.md §3) */
export async function joinRoom(input: JoinRoomInput): Promise<JoinRoomResult> {
  const call = httpsCallable<JoinRoomInput, JoinRoomResult>(functions, 'joinRoom');
  const { data } = await call(input);
  return data;
}

/**
 * M2-a 임시 정체성·메타 — 서버가 없어 클라가 넘긴다.
 * M2-b에서 Functions가 세션(uid)·members(nickname)로 확정하고 videos.list로 메타를 채우면
 * 이 인자는 통째로 사라진다 (docs/곡등록설계.md §8). 그래서 계약(RegisterTrackInput)과 분리해 둔다.
 */
interface RegisterTrackLocal {
  meta: VideoMeta;
  uid: string;
  nickname: string;
}

/** codeOf(errors.ts)가 읽는 code — Functions의 'functions/already-exists'와 같은 분기로 흡수된다 */
function alreadyExistsError(): Error {
  return Object.assign(new Error('already-exists'), { code: 'already-exists' });
}

/**
 * 곡 등록 (docs/곡등록설계.md §3).
 *
 * **M2-a**: Firebase 전 단계라 로컬 track store에 기록한다. 이 함수가 유일한 교체 지점이다 —
 * M2-b에서 `httpsCallable(functions, 'registerTrack')` + 서버 dateKey 확정 + videos.list 5규칙으로
 * 바뀌고, 화면·폼·에러 처리는 손대지 않는다.
 */
export async function registerTrack(
  input: RegisterTrackInput,
  local: RegisterTrackLocal,
): Promise<Track> {
  // 계약 재검증 — 클라·Functions가 같은 스키마를 공유한다(roomId 포함 검증)
  const { roomId, videoId, comment } = RegisterTrackInput.parse(input);

  // M2-a: 클라 시각. M2-b에선 **서버 시각**이 유일 기준이다(시계 조작 방지, §3)
  const dateKey = todayKey();
  const store = useTrackStore.getState();

  // 하루 1곡 낙관 차단 — **방 단위**다. M2-b에선 rooms/{roomId}/tracks 경로가 이 격리를 준다
  if (store.has(roomId, local.uid, dateKey)) throw alreadyExistsError();

  const now = Date.now();
  const track: Track = {
    videoId,
    title: local.meta.title,
    artist: local.meta.author, // 채널명 = 아티스트 대용
    comment,
    uid: local.uid,
    nickname: local.nickname,
    dateKey,
    order: now, // M2-b: 서버 epoch — 재생 순서
    createdAt: now,
    // oEmbed로는 임베드 가능 여부를 알 수 없다 → 낙관 저장, 미리듣기 onError가 방어한다(§8)
    embeddable: true,
    // videos.list(M2-b) 전이라 아직 모른다
    durationSec: 0,
    metaRefreshedAt: now,
  };
  store.upsert(roomId, track);
  return track;
}

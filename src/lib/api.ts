import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import type { CreateRoomInput } from '@/schemas';

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

import { randomInt } from 'node:crypto';
import { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } from '../../src/schemas';

/**
 * 초대 코드 생성 — 6자, 혼동문자(I·O·0·1) 제외 32자셋 (백엔드설계.md §3)
 * 자셋·길이는 클라이언트 검증(InviteCodeSchema)과 **같은 상수를 공유**한다.
 *
 * `Math.random()`이 아니라 `randomInt()`를 쓴다. 코드는 방에 들어오는 유일한 열쇠라,
 * 예측 가능한 난수면 남의 방을 열 수 있다.
 */
export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

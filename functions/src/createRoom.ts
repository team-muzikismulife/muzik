import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { CreateRoomInput } from '../../src/schemas';
import { avatarColor } from '../../src/lib/avatar';
import { generateInviteCode } from './inviteCode';

/**
 * createRoom — 팀 개설 (백엔드설계.md §3)
 *
 * 초대 코드의 유일성은 `invites/{code}` 문서의 **존재 여부**가 보장한다.
 * 트랜잭션 안에서 읽고 → 없을 때만 만든다. 두 사람이 같은 코드를 동시에 뽑아도
 * 한쪽만 커밋되고 다른 쪽은 재시도한다.
 */

/** 코드 충돌 재시도 한도. 32^6 ≈ 10억 조합이라 실제로는 1회에 끝난다 */
const MAX_ATTEMPTS = 5;

interface CreateRoomResult {
  roomId: string;
  inviteCode: string;
}

export const createRoom = onCall<unknown, Promise<CreateRoomResult>>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('permission-denied', '로그인이 필요해요.');
  }

  // 검증은 클라이언트와 같은 zod 스키마로 한다 — 규칙이 갈라지지 않게
  const parsed = CreateRoomInput.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError(
      'invalid-argument',
      parsed.error.issues[0]?.message ?? '입력을 확인해 주세요.',
    );
  }
  const { name, nickname } = parsed.data;

  const db = getFirestore();
  const now = Date.now(); // 서버 시각이 유일한 기준 (백엔드설계.md §6)

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const inviteCode = generateInviteCode();
    const roomRef = db.collection('rooms').doc();
    const inviteRef = db.collection('invites').doc(inviteCode);

    try {
      await db.runTransaction(async (tx) => {
        const existing = await tx.get(inviteRef);
        if (existing.exists) {
          // 이미 쓰이는 코드 → 이 트랜잭션을 버리고 새 코드로 재시도
          throw new CodeCollision();
        }

        tx.create(inviteRef, { roomId: roomRef.id });
        tx.create(roomRef, {
          name,
          inviteCode,
          createdAt: now,
          createdBy: uid,
          memberCount: 1,
        });
        // uid는 문서 ID와 중복이지만 collectionGroup 쿼리에 필요하다 (온보딩구현계획.md 결정 1)
        tx.create(roomRef.collection('members').doc(uid), {
          uid,
          nickname,
          joinedAt: now,
          photoColor: avatarColor(nickname),
        });
      });

      return { roomId: roomRef.id, inviteCode };
    } catch (e) {
      if (e instanceof CodeCollision) continue;
      throw e;
    }
  }

  throw new HttpsError('resource-exhausted', '초대 코드를 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
});

/** 코드 충돌 — 에러가 아니라 재시도 신호다 */
class CodeCollision extends Error {}

import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { JoinRoomInput } from '../../src/schemas';
import { avatarColor } from '../../src/lib/avatar';

/**
 * joinRoom — 초대 코드로 팀 입장 (백엔드설계.md §3)
 *
 * 멱등하다: 이미 멤버인 사람이 다시 들어와도 memberCount는 그대로다.
 * 그래서 재입장·중복 탭·딥링크 두 번 열기가 정원을 갉아먹지 않는다.
 * 판정은 트랜잭션 안에서 members 문서를 읽고 분기한다 — 무조건 increment하면 재입장마다 정원이 차오른다.
 */

/** 팀 정원 (백엔드설계.md §3) */
const MAX_MEMBERS = 30;

interface JoinRoomResult {
  roomId: string;
}

export const joinRoom = onCall<unknown, Promise<JoinRoomResult>>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('permission-denied', '로그인이 필요해요.');
  }

  // 검증은 클라이언트와 같은 zod 스키마로 — 규칙이 갈라지지 않게
  const parsed = JoinRoomInput.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError(
      'invalid-argument',
      parsed.error.issues[0]?.message ?? '입력을 확인해 주세요.',
    );
  }
  const { code, nickname } = parsed.data;

  const db = getFirestore();
  const now = Date.now();

  // 코드 → roomId 역참조. 트랜잭션 밖에서 먼저 걸러 없는 코드는 빨리 끝낸다.
  const inviteSnap = await db.collection('invites').doc(code).get();
  if (!inviteSnap.exists) {
    throw new HttpsError('not-found', '없는 초대 코드예요. 다시 확인해 주세요.');
  }
  const { roomId } = inviteSnap.data() as { roomId: string };

  const roomRef = db.collection('rooms').doc(roomId);
  const memberRef = roomRef.collection('members').doc(uid);

  await db.runTransaction(async (tx) => {
    const [roomSnap, memberSnap] = await Promise.all([tx.get(roomRef), tx.get(memberRef)]);

    // invites는 있는데 방이 지워진 경우 (댕글링) — 없는 코드와 같게 취급
    if (!roomSnap.exists) {
      throw new HttpsError('not-found', '없는 초대 코드예요. 다시 확인해 주세요.');
    }

    if (memberSnap.exists) {
      // 재입장 — 닉네임만 갱신하고 정원은 건드리지 않는다 (멱등)
      tx.update(memberRef, { nickname, photoColor: avatarColor(nickname) });
      return;
    }

    const memberCount = (roomSnap.data() as { memberCount: number }).memberCount;
    if (memberCount >= MAX_MEMBERS) {
      throw new HttpsError('failed-precondition', `이 팀은 정원이 가득 찼어요. (최대 ${MAX_MEMBERS}명)`);
    }

    // uid는 문서 ID와 중복이지만 collectionGroup 조회에 필요하다 (온보딩구현계획.md 결정 1)
    tx.create(memberRef, {
      uid,
      nickname,
      joinedAt: now,
      photoColor: avatarColor(nickname),
    });
    tx.update(roomRef, { memberCount: memberCount + 1 });
  });

  return { roomId };
});

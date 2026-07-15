import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { JoinRoomInput, MAX_MEMBERS } from '../../src/schemas';
import { avatarColor } from '../../src/lib/avatar';

/**
 * joinRoom — 초대 코드로 팀 입장 (백엔드설계.md §3)
 *
 * 코드 → `invites/{code}` get → roomId. 정원(30) 검증과 memberCount 증가는 **트랜잭션 안에서**
 * 한다. 두 사람이 동시에 마지막 자리에 들어오는 경합을 트랜잭션이 직렬화한다(§6).
 *
 * **재입장은 멱등이다.** 이미 멤버면 닉네임만 갱신하고 memberCount는 건드리지 않는다 —
 * 안 그러면 딥링크를 두 번 열 때마다 인원수가 부풀어 오른다.
 */

interface JoinRoomResult {
  roomId: string;
}

export const joinRoom = onCall<unknown, Promise<JoinRoomResult>>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('permission-denied', '로그인이 필요해요.');
  }

  const parsed = JoinRoomInput.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError(
      'invalid-argument',
      parsed.error.issues[0]?.message ?? '입력을 확인해 주세요.',
    );
  }
  const { code, nickname } = parsed.data;

  const db = getFirestore();
  const inviteRef = db.collection('invites').doc(code);

  // 코드 → roomId. 트랜잭션 밖에서 먼저 읽어도 되는 건, invites는 생성 후 불변이기 때문이다.
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) {
    throw new HttpsError('not-found', '없는 초대 코드예요. 다시 확인해 주세요.');
  }
  const roomId = inviteSnap.data()!.roomId as string;

  const roomRef = db.collection('rooms').doc(roomId);
  const memberRef = roomRef.collection('members').doc(uid);
  const now = Date.now(); // 서버 시각이 유일한 기준 (백엔드설계.md §6)

  await db.runTransaction(async (tx) => {
    const [roomSnap, memberSnap] = await Promise.all([tx.get(roomRef), tx.get(memberRef)]);

    if (!roomSnap.exists) {
      // 코드는 있는데 방이 없다 — 방 삭제 기능이 생기면 나올 수 있는 상태
      throw new HttpsError('not-found', '사라진 팀이에요.');
    }

    // 이미 멤버 → 닉네임만 갱신, 인원수는 그대로 (멱등)
    if (memberSnap.exists) {
      tx.update(memberRef, { nickname, photoColor: avatarColor(nickname) });
      return;
    }

    const memberCount = (roomSnap.data()!.memberCount as number) ?? 0;
    if (memberCount >= MAX_MEMBERS) {
      throw new HttpsError('failed-precondition', `이 팀은 정원이 가득 찼어요. (최대 ${MAX_MEMBERS}명)`);
    }

    // uid는 문서 ID와 중복이지만 collectionGroup 쿼리에 필요하다 (온보딩구현계획.md 결정 1)
    tx.create(memberRef, {
      uid,
      nickname,
      joinedAt: now,
      photoColor: avatarColor(nickname),
    });
    tx.update(roomRef, { memberCount: FieldValue.increment(1) });
  });

  return { roomId };
});

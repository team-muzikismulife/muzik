import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { JoinRoomInput, MAX_MEMBERS } from '../../src/schemas';
import { avatarColor } from '../../src/lib/avatar';
import { callableOptions, mutate, parse, rateLimit, RequestId, uidOf } from './core';

export const joinRoom = onCall(callableOptions, async request => {
  const uid = uidOf(request);
  const input = parse(JoinRoomInput.extend({ requestId: RequestId }).strict(), request.data);
  await rateLimit(request, 'joinRoom', 40);
  const db = getFirestore();
  return mutate(uid, 'joinRoom', input, async tx => {
    const invite = await tx.get(db.doc(`invites/${input.code}`));
    if (!invite.exists) throw new HttpsError('not-found', '초대 코드를 다시 확인해 주세요.');
    const roomId = invite.data()!.roomId as string;
    const roomRef = db.doc(`rooms/${roomId}`);
    const memberRef = roomRef.collection('members').doc(uid);
    const [room, member] = await Promise.all([tx.get(roomRef), tx.get(memberRef)]);
    if (!room.exists) throw new HttpsError('not-found', '사라진 팀이에요.');
    if (member.exists) {
      tx.update(memberRef, { nickname: input.nickname, photoColor: avatarColor(input.nickname) });
    } else {
      const count = room.data()!.memberCount as number;
      if (count >= MAX_MEMBERS) throw new HttpsError('failed-precondition', '정원이 가득 찼어요. 대표에게 새 팀 코드를 요청해 주세요.');
      const now = Date.now();
      tx.create(memberRef, { uid, nickname: input.nickname, joinedAt: now, photoColor: avatarColor(input.nickname) });
      tx.update(roomRef, { memberCount: count + 1 });
      tx.create(db.collection('events').doc(), { name: 'team_joined', uid, roomId, at: now });
    }
    return { roomId };
  });
});

import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { CreateRoomInput } from '../../src/schemas';
import { avatarColor } from '../../src/lib/avatar';
import { generateInviteCode } from './inviteCode';
import { callableOptions, mutate, parse, rateLimit, RequestId, uidOf } from './core';

export const createRoom = onCall(callableOptions, async request => {
  const uid = uidOf(request);
  const input = parse(CreateRoomInput.extend({ requestId: RequestId }).strict(), request.data);
  await rateLimit(request, 'createRoom', 5);
  const db = getFirestore();
  for (let attempt = 0; attempt < 5; attempt++) {
    const inviteCode = generateInviteCode();
    const room = db.collection('rooms').doc();
    try {
      return await mutate(uid, 'createRoom', input, async tx => {
        const invite = db.doc(`invites/${inviteCode}`);
        if ((await tx.get(invite)).exists) throw new Error('code-collision');
        const now = Date.now();
        tx.create(invite, { roomId: room.id });
        tx.create(room, { name: input.name, inviteCode, createdAt: now, createdBy: uid, memberCount: 1 });
        tx.create(room.collection('members').doc(uid), { uid, nickname: input.nickname, joinedAt: now, photoColor: avatarColor(input.nickname) });
        tx.create(db.collection('events').doc(), { name: 'team_created', uid, roomId: room.id, at: now });
        return { roomId: room.id, inviteCode };
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'code-collision') continue;
      throw error;
    }
  }
  throw new HttpsError('resource-exhausted', '초대 코드 생성에 실패했어요. 다시 시도해 주세요.');
});

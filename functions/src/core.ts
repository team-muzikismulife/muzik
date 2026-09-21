import { createHash } from 'node:crypto';
import { getFirestore, Timestamp, type Transaction } from 'firebase-admin/firestore';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { todayKey } from '../../src/lib/date';
import { DocumentIdSchema, RequestIdSchema } from '../../src/schemas';

export const emulator = process.env.FUNCTIONS_EMULATOR === 'true';
export const callableOptions = { enforceAppCheck: !emulator };
export const Id = DocumentIdSchema;
export const RequestId = RequestIdSchema;
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new HttpsError('invalid-argument', result.error.issues[0]?.message ?? '입력을 확인해 주세요.');
  return result.data;
}
export function uidOf(request: CallableRequest): string {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요해요.');
  return request.auth.uid;
}
export function requireAdmin(request: CallableRequest): string {
  const uid = uidOf(request);
  if (request.auth?.token.admin !== true) throw new HttpsError('permission-denied', '운영자만 확인할 수 있어요.');
  return uid;
}
export async function member(tx: Transaction, roomId: string, uid: string) {
  const snap = await tx.get(getFirestore().doc(`rooms/${roomId}/members/${uid}`));
  if (!snap.exists) throw new HttpsError('permission-denied', '초대 코드로 팀에 먼저 참여해 주세요.');
  return snap.data()!;
}
// 실패한 초대 코드 추측도 한도에 포함한다. IP 원문은 저장하지 않는다.
export async function rateLimit(request: CallableRequest, action: string, maximum = 60) {
  const uid = uidOf(request);
  const day = todayKey();
  const keys = [{ key: hash(`${uid}:${action}:${day}`), max: maximum }];
  if (action === 'createRoom' || action === 'joinRoom') {
    keys.push({ key: hash(`${request.rawRequest.ip ?? 'unknown'}:${action}:${day}`), max: action === 'createRoom' ? 20 : 150 });
  }
  const db = getFirestore();
  await db.runTransaction(async tx => {
    const config = await tx.get(db.doc('config/app'));
    if (config.data()?.writesDisabled === true && !['reviewQueue', 'moderateTrack', 'submitFeedback', 'reportTrack', 'recordVisit'].includes(action)) {
      throw new HttpsError('unavailable', '잠시 점검 중이에요. 의견 보내기는 계속 이용할 수 있어요.');
    }
    const refs = keys.map(k => db.doc(`rateLimits/${k.key}`));
    const snaps = await Promise.all(refs.map(r => tx.get(r)));
    snaps.forEach((snap, i) => {
      const count = snap.data()?.count ?? 0;
      if (count >= keys[i].max) throw new HttpsError('resource-exhausted', '오늘의 이용 한도에 도달했어요. 내일 다시 시도해 주세요.');
      tx.set(refs[i], { count: count + 1, expiresAt: Timestamp.fromMillis(Date.now() + 2 * 86400000) });
    });
  });
}
function mutationRef(uid: string, action: string, requestId: string) {
  return getFirestore().doc(`requests/${hash(`${uid}:${action}:${requestId}`)}`);
}

// 성공 기록만 재생한다. 다른 입력에 같은 요청 ID를 재사용할 수 없다.
export async function replayMutation<T>(tx: Transaction, uid: string, action: string, input: { requestId: string }): Promise<{ found: false } | { found: true; result: T }> {
  const previous = await tx.get(mutationRef(uid, action, input.requestId));
  if (!previous.exists) return { found: false };
  if (previous.data()!.digest !== hash(JSON.stringify(input))) {
    throw new HttpsError('invalid-argument', '재시도 입력이 달라졌어요.');
  }
  return { found: true, result: previous.data()!.result as T };
}

export async function mutate<T>(uid: string, action: string, input: { requestId: string }, work: (tx: Transaction) => Promise<T>): Promise<T> {
  const db = getFirestore();
  const ref = mutationRef(uid, action, input.requestId);
  const digest = hash(JSON.stringify(input));
  return db.runTransaction(async tx => {
    const previous = await replayMutation<T>(tx, uid, action, input);
    if (previous.found) return previous.result;
    const result = await work(tx);
    tx.create(ref, { digest, result, createdAt: Date.now() });
    return result;
  });
}

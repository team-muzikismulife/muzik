import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { todayKey } from '../../src/lib/date';
import { callableOptions, hash, Id, member, mutate, parse, rateLimit, RequestId, requireAdmin, uidOf } from './core';
import { readDay, writeDay } from './tracks';
import type { Track } from '../../src/types/models';

export const reportTrack = onCall(callableOptions, async request => {
  const uid = uidOf(request);
  const input = parse(z.object({ roomId: Id, trackId: Id, reason: z.enum(['inappropriate', 'copyright', 'other']), requestId: RequestId }).strict(), request.data);
  await rateLimit(request, 'reportTrack', 20);
  return mutate(uid, 'reportTrack', input, async tx => {
    const db = getFirestore();
    await member(tx, input.roomId, uid);
    const track = await tx.get(db.doc(`rooms/${input.roomId}/tracks/${input.trackId}`));
    if (!track.exists) throw new HttpsError('not-found', '곡을 찾을 수 없어요.');
    const ref = db.doc(`reports/${hash(`${uid}:${input.roomId}:${input.trackId}`)}`);
    const previous = await tx.get(ref);
    if (!previous.exists) tx.create(ref, { roomId: input.roomId, trackId: input.trackId, reason: input.reason, reportedBy: uid, status: 'open', createdAt: Date.now() });
    return { ok: true };
  });
});
export const submitFeedback = onCall(callableOptions, async request => {
  const uid = uidOf(request);
  const input = parse(z.object({ message: z.string().trim().min(1).max(500), requestId: RequestId }).strict(), request.data);
  await rateLimit(request, 'submitFeedback', 10);
  return mutate(uid, 'submitFeedback', input, async tx => {
    tx.create(getFirestore().collection('feedback').doc(), { message: input.message, uid, status: 'open', createdAt: Date.now() });
    return { ok: true };
  });
});
export const recordVisit = onCall(callableOptions, async request => {
  const uid = uidOf(request);
  parse(z.object({}).strict(), request.data);
  await rateLimit(request, 'recordVisit', 60);
  const db = getFirestore();
  const ref = db.doc(`events/${hash(`${uid}:visit:${todayKey()}`)}`);
  await db.runTransaction(async tx => {
    if (!(await tx.get(ref)).exists) tx.create(ref, { name: 'visit', uid, at: Date.now() });
  });
  return { ok: true };
});
export const reviewQueue = onCall(callableOptions, async request => {
  requireAdmin(request);
  const input = parse(z.object({ kind: z.enum(['reports', 'feedback', 'events']) }).strict(), request.data);
  await rateLimit(request, 'reviewQueue', 100);
  const docs = await getFirestore().collection(input.kind).orderBy(input.kind === 'events' ? 'at' : 'createdAt', 'desc').limit(100).get();
  const items = await Promise.all(docs.docs.map(async d => {
    const data = d.data();
    if (input.kind !== 'reports') return { id: d.id, ...data };
    const track = await getFirestore().doc(`rooms/${data.roomId}/tracks/${data.trackId}`).get();
    return { id: d.id, ...data, title: track.data()?.title ?? '', comment: track.data()?.comment ?? '', videoId: track.data()?.videoId ?? '' };
  }));
  return { items };
});
export const moderateTrack = onCall(callableOptions, async request => {
  const uid = requireAdmin(request);
  const input = parse(z.object({ reportId: Id, action: z.enum(['hide', 'dismiss']), requestId: RequestId }).strict(), request.data);
  await rateLimit(request, 'moderateTrack', 100);
  return mutate(uid, 'moderateTrack', input, async tx => {
    const db = getFirestore();
    const reportRef = db.doc(`reports/${input.reportId}`);
    const report = await tx.get(reportRef);
    if (!report.exists) throw new HttpsError('not-found', '신고를 찾을 수 없어요.');
    const { roomId, trackId } = report.data() as { roomId: string; trackId: string };
    const trackRef = db.doc(`rooms/${roomId}/tracks/${trackId}`);
    const trackSnap = await tx.get(trackRef);
    const track = trackSnap.data() as Track | undefined;
    const day = track ? await readDay(tx, roomId, track.dateKey) : undefined;
    if (input.action === 'hide' && track && !track.hidden && day) {
      tx.set(db.doc(`moderationArchive/${hash(`${roomId}:${trackId}`)}`), { track, roomId, trackId, hiddenBy: uid, hiddenAt: Date.now() });
      const tombstone: Track = { ...track, title: '', artist: '', comment: '', videoId: '', hidden: true, unavailable: true, embeddable: false, durationSec: 0 };
      tx.set(trackRef, tombstone);
      writeDay(tx, day, track.dateKey, day.tracks.filter(t => t.id !== trackId));
    }
    tx.update(reportRef, { status: input.action === 'hide' ? 'hidden' : 'dismissed', reviewedBy: uid, reviewedAt: Date.now() });
    return { ok: true };
  });
});

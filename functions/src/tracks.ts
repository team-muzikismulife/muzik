import { getFirestore, type Transaction } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { DateKeySchema, VideoIdSchema, RegisterTrackInput } from '../../src/schemas';
import { todayKey } from '../../src/lib/date';
import { themeFor } from '../../src/lib/themes';
import type { Track } from '../../src/types/models';
import { callableOptions, Id, member, mutate, parse, rateLimit, replayMutation, RequestId, uidOf } from './core';
import { videoMetadata, videoOptions, type VideoMetadata } from './youtube';

const RoomRequest = z.object({ roomId: Id, requestId: RequestId }).strict();
const TrackRequest = RegisterTrackInput.extend({ requestId: RequestId }).strict();

export async function readDay(tx: Transaction, roomId: string, dateKey: string) {
  const db = getFirestore();
  const ref = db.doc(`rooms/${roomId}/days/${dateKey}`);
  const [day, tracks] = await Promise.all([tx.get(ref), tx.get(db.collection(`rooms/${roomId}/tracks`).where('dateKey', '==', dateKey))]);
  return { ref, themeText: day.data()?.themeText as string | undefined, tracks: tracks.docs.map(d => ({ id: d.id, ...d.data() as Track })) };
}
export function writeDay(tx: Transaction, day: Awaited<ReturnType<typeof readDay>>, dateKey: string, tracks: Track[]) {
  const visible = tracks.filter(t => !t.hidden).sort((a, b) => a.order - b.order || a.uid.localeCompare(b.uid));
  if (!visible.length) { tx.delete(day.ref); return; }
  tx.set(day.ref, { dateKey, trackCount: visible.length, coverVideoId: visible[0].videoId, themeText: day.themeText ?? themeFor(dateKey), updatedAt: Date.now() });
}

function saveTrack(action: 'registerTrack' | 'updateTrack') {
  return onCall({ ...callableOptions, ...videoOptions }, async request => {
    const uid = uidOf(request);
    const input = parse(TrackRequest, request.data);
    const db = getFirestore();
    const replay = () => db.runTransaction(async tx => {
      await member(tx, input.roomId, uid);
      return replayMutation<{ dateKey: string; trackId: string }>(tx, uid, action, input);
    });
    const previous = await replay();
    if (previous.found) return previous.result;
    await rateLimit(request, action, 40);
    let meta: VideoMetadata;
    try {
      meta = await videoMetadata(input.videoId);
    } catch (error) {
      // 외부 조회 중 같은 요청의 다른 호출이 커밋했을 수도 있다.
      const committed = await replay();
      if (committed.found) return committed.result;
      throw error;
    }
    return mutate(uid, action, input, async tx => {
      const dateKey = todayKey();
      const memberData = await member(tx, input.roomId, uid);
      const trackRef = db.doc(`rooms/${input.roomId}/tracks/${uid}_${dateKey}`);
      const progressRef = db.doc(`rooms/${input.roomId}/progress/${uid}`);
      const [day, previous, progress] = await Promise.all([readDay(tx, input.roomId, dateKey), tx.get(trackRef), tx.get(progressRef)]);
      if (action === 'registerTrack' && previous.exists) throw new HttpsError('already-exists', '오늘은 이미 곡을 올렸어요.');
      if (action === 'updateTrack' && !previous.exists) throw new HttpsError('not-found', '오늘 등록한 곡이 없어요.');
      if (previous.data()?.hidden) throw new HttpsError('permission-denied', '운영 검토 중인 곡이에요.');
      const now = Date.now();
      const track: Track = { ...meta, videoId: input.videoId, comment: input.comment, uid, nickname: memberData.nickname as string, dateKey, createdAt: previous.data()?.createdAt ?? now, order: previous.data()?.order ?? now };
      tx.set(trackRef, track);
      writeDay(tx, day, dateKey, [...day.tracks.filter(t => t.uid !== uid), track]);
      if (action === 'registerTrack') {
        const firstDate = progress.data()?.firstDate as string | undefined;
        const nextDay = firstDate && todayKey(new Date(`${firstDate}T15:00:00Z`));
        if (!firstDate || (dateKey === nextDay && !progress.data()?.returned)) {
          tx.create(db.collection('events').doc(), { name: firstDate ? 'next_day_registered' : 'first_registered', uid, roomId: input.roomId, at: now });
        }
        tx.set(progressRef, { firstDate: firstDate ?? dateKey, returned: Boolean(progress.data()?.returned || dateKey === nextDay) });
      }
      return { dateKey, trackId: trackRef.id };
    });
  });
}
export const registerTrack = saveTrack('registerTrack');
export const updateTrack = saveTrack('updateTrack');
export const deleteTrack = onCall(callableOptions, async request => {
  const uid = uidOf(request);
  const input = parse(RoomRequest, request.data);
  await rateLimit(request, 'deleteTrack');
  return mutate(uid, 'deleteTrack', input, async tx => {
    const dateKey = todayKey();
    await member(tx, input.roomId, uid);
    const day = await readDay(tx, input.roomId, dateKey);
    const target = day.tracks.find(t => t.uid === uid);
    if (target?.hidden) throw new HttpsError('permission-denied', '운영 검토 중인 곡이에요.');
    tx.delete(getFirestore().doc(`rooms/${input.roomId}/tracks/${uid}_${dateKey}`));
    writeDay(tx, day, dateKey, day.tracks.filter(t => t.uid !== uid));
    return { ok: true };
  });
});
export const previewTrack = onCall({ ...callableOptions, ...videoOptions }, async request => {
  const uid = uidOf(request);
  const input = parse(z.object({ roomId: Id, videoId: VideoIdSchema }).strict(), request.data);
  await rateLimit(request, 'previewTrack', 60);
  await getFirestore().runTransaction(tx => member(tx, input.roomId, uid));
  return { videoId: input.videoId, ...await videoMetadata(input.videoId) };
});
export const refreshMeta = onCall({ ...callableOptions, ...videoOptions }, async request => {
  const uid = uidOf(request);
  const input = parse(z.object({ roomId: Id, dateKey: DateKeySchema }).strict(), request.data);
  await rateLimit(request, 'refreshMeta', 20);
  const db = getFirestore();
  await db.runTransaction(tx => member(tx, input.roomId, uid));
  const tracks = await db.collection(`rooms/${input.roomId}/tracks`).where('dateKey', '==', input.dateKey).limit(30).get();
  let refreshed = 0;
  for (const snap of tracks.docs) {
    const old = snap.data() as Track;
    if (old.hidden || Date.now() - old.metaRefreshedAt < 30 * 86400000) continue;
    let meta: Partial<Track>;
    try { meta = await videoMetadata(old.videoId); }
    catch (error) {
      if (!(error instanceof HttpsError) || error.code !== 'invalid-argument') throw error;
      meta = { title: '', artist: '', unavailable: true, embeddable: false, durationSec: 0, metaRefreshedAt: Date.now() };
    }
    await db.runTransaction(async tx => {
      await member(tx, input.roomId, uid);
      const fresh = await tx.get(snap.ref);
      if (fresh.exists && !fresh.data()!.hidden && fresh.data()!.videoId === old.videoId) tx.update(snap.ref, meta);
    });
    refreshed++;
  }
  return { refreshed };
});

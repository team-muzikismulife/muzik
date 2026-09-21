import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc } from 'firebase/firestore';
import { inspectRoom, readOptions, readRoomSnapshot } from './legacy-preflight.mjs';

// 이 파일만 fixture를 쓴다. 운영 사전검사 스크립트에는 쓰기 경로가 없다.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const admin = require('firebase-admin');
const { todayKey } = require('../functions/lib/src/lib/date.js');
const adminApp = admin.initializeApp({ projectId: 'demo-muzik' });
const db = adminApp.firestore();
const apps = [];
let checks = 0;
const pass = label => { checks++; console.log(`PASS legacy: ${label}`); };
async function user() {
  const app = initializeApp({ apiKey: 'demo-api-key', projectId: 'demo-muzik', appId: '1:0:web:0' }, randomUUID());
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const { user } = await signInAnonymously(auth);
  const client = getFirestore(app);
  connectFirestoreEmulator(client, '127.0.0.1', 8080);
  return { uid: user.uid, token: () => user.getIdToken(true), db: client };
}
async function call(user, name, data, expected) {
  const response = await fetch(`http://127.0.0.1:5001/demo-muzik/asia-northeast3/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.token()}` },
    body: JSON.stringify({ data: { ...data, requestId: randomUUID() } }),
  });
  const body = await response.json();
  if (expected) { assert.equal(body.error?.status, expected); return; }
  assert.equal(body.error, undefined, JSON.stringify(body));
  return body.result;
}

try {
  assert.throws(() => readOptions([], {}));
  assert.throws(() => readOptions(['--project', 'muzik-42b60', '--room', 'room'], {}));
  assert.throws(() => readOptions(['--project', 'demo-muzik', '--room', 'room'], { FIRESTORE_EMULATOR_HOST: 'external:8080' }));
  assert.throws(() => readOptions(['--input', 'file.json', '--allow-live-read'], {}));
  readOptions(['--project', 'demo-muzik', '--room', 'room'], process.env);
  pass('기본 운영 연결/전체 조회/외부 에뮬레이터 호스트 차단');
  const [a, b, operator] = await Promise.all([user(), user(), user()]);
  const roomId = `legacy_${randomUUID()}`;
  const root = db.doc(`rooms/${roomId}`);
  const now = Date.now();
  const today = todayKey();
  const yesterday = todayKey(new Date(now - 86400000));
  const code = randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase().replace(/[01IO]/g, 'A');
  const track = key => ({ uid: a.uid, nickname: '옛이름', dateKey: key, videoId: 'dQw4w9WgXcQ', title: '기존 곡 제목', artist: '기존 가수', comment: '기존 코멘트', order: now - 1000, createdAt: now - 1000, embeddable: true, durationSec: 0, metaRefreshedAt: now, legacyUrl: 'https://example.invalid/private-original' });
  const batch = db.batch();
  batch.set(root, { name: '기존 팀', inviteCode: code, createdBy: a.uid, createdAt: now - 86400000, memberCount: 1 });
  batch.set(db.doc(`invites/${code}`), { roomId });
  batch.set(root.collection('members').doc(a.uid), { uid: a.uid, nickname: '옛이름', joinedAt: now - 86400000, photoColor: '#000000' });
  for (const key of [today, yesterday]) {
    batch.set(root.collection('tracks').doc(`${a.uid}_${key}`), track(key));
    batch.set(root.collection('days').doc(key), { dateKey: key, trackCount: 1, coverVideoId: 'dQw4w9WgXcQ', themeText: `기존 미션 ${key}`, updatedAt: now - 1000 });
  }
  await batch.commit();
  const before = await readRoomSnapshot(db, roomId);
  const report = inspectRoom(before);
  assert.equal(report.ready, true);
  assert(report.issues.some(issue => issue.code === 'SPARK_METADATA_UNVERIFIED'));
  assert(report.issues.some(issue => issue.code === 'LEGACY_PROGRESS_MISSING'));
  assert(!JSON.stringify(report).includes('기존 코멘트'));
  assert.deepEqual(await readRoomSnapshot(db, roomId), before);
  pass('정상 Spark 문서 조회/검사는 원본 불변, 메타·측정 경고 및 원문 비노출');

  const broken = structuredClone(before);
  broken.room.memberCount = 29;
  broken.members[0].data.uid = 'wrong';
  broken.members[0].data.nickname = '';
  delete broken.members[0].data.joinedAt;
  broken.tracks[0].data.dateKey = '2026-02-30';
  delete broken.tracks[0].data.order;
  delete broken.tracks[0].data.metaRefreshedAt;
  broken.days[0].data.trackCount = 99;
  delete broken.days[0].data.themeText;
  broken.invite.roomId = 'wrong';
  const issues = inspectRoom(broken).issues.map(issue => issue.code);
  for (const code of ['MEMBER_COUNT', 'MEMBER_UID', 'MEMBER_NICKNAME', 'MEMBER_JOINED_AT', 'TRACK_IDENTITY', 'TRACK_ORDER_TIME', 'METADATA_INCOMPLETE', 'DAY_AGGREGATE', 'DAY_THEME_MISSING', 'INVITE_MAPPING', 'DAY_MISSING']) assert(issues.includes(code), code);
  assert.equal(inspectRoom({ ...before, truncated: true }).ready, false);
  pass('인원/UID/닉네임/날짜/order/메타/집계/미션/초대 및 불완전 조회 탐지');

  assert.equal((await getDoc(doc(a.db, `rooms/${roomId}/tracks/${a.uid}_${yesterday}`))).data().comment, '기존 코멘트');
  await call(b, 'joinRoom', { code, nickname: '신규' });
  await call(a, 'joinRoom', { code, nickname: '새이름' });
  assert.equal((await root.get()).data().memberCount, 2);
  const previousTrack = before.tracks.find(entry => entry.id.endsWith(yesterday));
  assert.deepEqual((await root.collection('tracks').doc(previousTrack.id).get()).data(), previousTrack.data);
  await call(a, 'registerTrack', { roomId, videoId: 'kJQP7kiw5Fk', comment: '중복' }, 'ALREADY_EXISTS');
  pass('기존 사용자 읽기·재입장/신규 가입 및 당일 기존 곡 중복 방지');

  await call(a, 'updateTrack', { roomId, videoId: 'kJQP7kiw5Fk', comment: '수정 코멘트' });
  const updated = (await root.collection('tracks').doc(`${a.uid}_${today}`).get()).data();
  assert.equal(updated.createdAt, track(today).createdAt);
  assert.equal(updated.order, track(today).order);
  assert.equal(updated.nickname, '새이름');
  assert.equal((await root.collection('days').doc(today).get()).data().themeText, `기존 미션 ${today}`);
  assert.deepEqual((await root.collection('tracks').doc(previousTrack.id).get()).data(), previousTrack.data);
  pass('당일 수정 시 순서/생성시각/미션/과거 원본 보존');

  await call(a, 'reportTrack', { roomId, trackId: previousTrack.id, reason: 'other' });
  await admin.auth().setCustomUserClaims(operator.uid, { admin: true });
  const reports = await db.collection('reports').where('roomId', '==', roomId).get();
  await call(operator, 'moderateTrack', { reportId: reports.docs[0].id, action: 'hide' });
  const hidden = (await root.collection('tracks').doc(previousTrack.id).get()).data();
  assert.equal(hidden.hidden, true);
  assert.equal(hidden.legacyUrl, undefined);
  assert.equal(hidden.videoId, '');
  assert.equal((await root.collection('days').doc(yesterday).get()).exists, false);
  const archive = await db.collection('moderationArchive').where('roomId', '==', roomId).get();
  assert.deepEqual(archive.docs[0].data().track, previousTrack.data);
  await assert.rejects(getDoc(doc(a.db, `moderationArchive/${archive.docs[0].id}`)));
  assert.equal(inspectRoom(await readRoomSnapshot(db, roomId)).ready, true);
  const leaky = structuredClone(await readRoomSnapshot(db, roomId));
  leaky.tracks.find(entry => entry.data.hidden).data.legacyUrl = 'private';
  leaky.archives = [];
  const leakIssues = inspectRoom(leaky).issues.map(issue => issue.code);
  assert(leakIssues.includes('HIDDEN_PUBLIC_PAYLOAD'));
  assert(leakIssues.includes('HIDDEN_ARCHIVE_MISSING'));
  pass('과거 신고 숨김: 공개 추가필드 제거·비공개 원본 보존·집계 제외·누출 사전탐지');
  console.log(`완료: legacy ${checks}개 검사. 운영 DB 조회/수정 없음.`);
} finally {
  await Promise.all(apps.map(deleteApp));
  await adminApp.delete();
}

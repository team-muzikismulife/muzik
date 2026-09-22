import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const expoRequire = createRequire(new URL('../../../legacy/expo/package.json', import.meta.url));
const { initializeApp, deleteApp } = expoRequire('firebase/app');
const { getAuth, connectAuthEmulator, signInAnonymously } = expoRequire('firebase/auth');
const { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, collectionGroup, query, where, getDocs } = expoRequire('firebase/firestore');
import { validateEnv } from '../../../legacy/expo/scripts/validate-env.mjs';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const require = createRequire(new URL('../../../legacy/firebase/functions/package.json', import.meta.url));
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'demo-muzik' });
const db = admin.firestore();
const { todayKey } = require('./lib/expo/src/lib/date.js');
const apps = [];
let checks = 0;
const pass = label => { checks++; console.log(`PASS ${label}`); };
async function user() {
  const app = initializeApp({ apiKey: 'demo-api-key', projectId: 'demo-muzik', appId: '1:0:web:0' }, randomUUID());
  apps.push(app);
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const cred = await signInAnonymously(auth);
  const firestore = getFirestore(app); connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
  return { uid: cred.user.uid, token: () => cred.user.getIdToken(true), db: firestore };
}
async function call(user, name, data, expected) {
  const res = await fetch(`http://127.0.0.1:5001/demo-muzik/asia-northeast3/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${await user.token()}` } : {}) }, body: JSON.stringify({ data }) });
  const body = await res.json();
  if (expected) { assert.equal(body.error?.status, expected, JSON.stringify(body)); return; }
  assert.equal(body.error, undefined, JSON.stringify(body));
  return body.result;
}
const rid = () => randomUUID();
try {
  assert.throws(() => validateEnv({}, 'production'), /누락/);
  assert.throws(() => validateEnv({ EXPO_PUBLIC_USE_EMULATOR: 'true' }, 'production'), /이전/);
  validateEnv({}, 'demo'); pass('빌드 모드 누락/혼용 거부');
  assert.equal(todayKey(new Date('2026-09-20T14:59:59Z')), '2026-09-20');
  assert.equal(todayKey(new Date('2026-09-20T15:00:00Z')), '2026-09-21'); pass('서버 KST 자정 경계');
  const [a,b,c] = await Promise.all([user(),user(),user()]);
  await call(null, 'createRoom', { name: '팀', nickname: '가', requestId: rid() }, 'UNAUTHENTICATED'); pass('비로그인 거부');
  const create = { name: '서버 회귀 팀', nickname: '대표', requestId: rid() };
  const team = await call(a, 'createRoom', create);
  assert.deepEqual(await call(a, 'createRoom', create), team); pass('팀 생성 재시도 멱등');
  await call(a, 'createRoom', { ...create, name: '변조' }, 'INVALID_ARGUMENT'); pass('같은 요청 ID 입력변조 거부');
  const roomId = team.roomId;
  await assert.rejects(getDoc(doc(c.db, `rooms/${roomId}`))); pass('비멤버 방 읽기 거부');
  await assert.rejects(setDoc(doc(c.db, `rooms/${roomId}/members/${c.uid}`), { uid: c.uid, nickname: '침입' })); pass('초대 없는 멤버 직접 생성 거부');
  await call(c, 'registerTrack', { roomId, videoId: 'dQw4w9WgXcQ', comment: '', requestId: rid() }, 'PERMISSION_DENIED'); pass('비멤버 등록 거부');
  await call(b, 'joinRoom', { code: team.inviteCode, nickname: '멤버', requestId: rid() });
  await call(b, 'joinRoom', { code: team.inviteCode, nickname: '멤버', requestId: rid() });
  assert.equal((await db.doc(`rooms/${roomId}`).get()).data().memberCount, 2); pass('반복 가입 인원수 유지');
  assert.equal((await getDocs(query(collectionGroup(b.db, 'members'), where('uid','==', b.uid)))).size, 1); pass('본인 팀 복원 쿼리 허용');
  const input = { roomId, videoId: 'dQw4w9WgXcQ', comment: '첫 곡', requestId: rid() };
  await call(a, 'registerTrack', {...input, comment:'가'.repeat(31)}, 'INVALID_ARGUMENT'); pass('30자 코멘트 제한');
  await call(a, 'registerTrack', { ...input, dateKey: '2000-01-01' }, 'INVALID_ARGUMENT');
  await call(a, 'registerTrack', { ...input, uid: b.uid }, 'INVALID_ARGUMENT'); pass('클라이언트 날짜/UID 위조 거부');
  const [one,two] = await Promise.all([call(a,'registerTrack',input),call(a,'registerTrack',input)]);
  assert.deepEqual(one,two); pass('동일 등록 동시 요청 멱등');
  const today = one.dateKey;
  const videoFailure = db.doc(`testVideoFailures/${input.videoId}`);
  const storedTrackRef = db.doc(`rooms/${roomId}/tracks/${a.uid}_${today}`);
  const storedDayRef = db.doc(`rooms/${roomId}/days/${today}`);
  const eventCount = async () => (await db.collection('events').where('roomId', '==', roomId).get()).size;
  for (const action of ['registerTrack', 'updateTrack']) {
    const savedInput = action === 'registerTrack' ? input : { ...input, comment: '수정 성공', requestId: rid() };
    const savedResult = action === 'registerTrack' ? one : await call(a, action, savedInput);
    const before = { track: (await storedTrackRef.get()).data(), day: (await storedDayRef.get()).data(), events: await eventCount() };
    const callsBefore = (await videoFailure.get()).data().calls;
    for (const failure of ['unavailable', 'invalid-argument', 'resource-exhausted']) {
      await videoFailure.set({ failure }, { merge: true });
      assert.deepEqual(await call(a, action, savedInput), savedResult);
      await call(a, action, { ...savedInput, comment: '변조' }, 'INVALID_ARGUMENT');
      assert.equal((await videoFailure.get()).data().calls, callsBefore);
    }
    assert.deepEqual({ track: (await storedTrackRef.get()).data(), day: (await storedDayRef.get()).data(), events: await eventCount() }, before);
    pass(`${action}: API 장애/삭제/쿼터 중 성공 재생, 입력변조 거부, API/집계/이벤트 중복0`);
    await call(a, action, { ...savedInput, requestId: rid() }, 'RESOURCE_EXHAUSTED');
    assert.equal((await videoFailure.get()).data().calls, callsBefore + 1);
    pass(`${action}: 새 요청ID는 영상 API 오류 전달`);
    await videoFailure.set({ failure: null }, { merge: true });
  }
  await call(a,'registerTrack',{...input,requestId:rid()},'ALREADY_EXISTS'); pass('하루 한 곡 강제');
  await call(b,'registerTrack',{...input,videoId:'kJQP7kiw5Fk',requestId:rid()});
  const dayRef = db.doc(`rooms/${roomId}/days/${today}`);
  assert.equal((await dayRef.get()).data().trackCount, 2); pass('서로 다른 멤버 집계');
  await assert.rejects(setDoc(doc(b.db,`rooms/${roomId}/tracks/${a.uid}_${today}`),{comment:'변조'},{merge:true}));
  await assert.rejects(setDoc(doc(a.db,`rooms/${roomId}/tracks/${a.uid}_2000-01-01`),{comment:'과거변조'})); pass('타인/과거 직접 쓰기 거부');
  await call(a,'updateTrack',{...input,videoId:'9bZkp7q19f0',requestId:rid()});
  assert.equal((await dayRef.get()).data().coverVideoId,'9bZkp7q19f0'); pass('수정 커버 일관성');
  await call(a,'deleteTrack',{roomId,requestId:rid()});
  assert.equal((await dayRef.get()).data().coverVideoId,'kJQP7kiw5Fk'); pass('삭제 커버 원자적 재지정');
  const races = await Promise.allSettled([call(a,'registerTrack',{...input,requestId:rid()}),call(a,'registerTrack',{...input,requestId:rid()})]);
  assert.equal(races.filter(r=>r.status==='fulfilled').length,1); pass('다른 요청ID의 동시등록 중 하나만 성공');
  await call(a,'deleteTrack',{roomId,requestId:rid()});
  const bTrack = db.doc(`rooms/${roomId}/tracks/${b.uid}_${today}`);
  await bTrack.update({metaRefreshedAt:0,title:'오래된 메타'});
  await call(a,'refreshMeta',{roomId,dateKey:today});
  assert.equal((await bTrack.get()).data().title,'에뮬레이터 검증용 곡'); pass('30일 경과 메타 서버 갱신');
  await call(a,'reportTrack',{roomId,trackId:`${b.uid}_${today}`,reason:'other',requestId:rid()});
  await call(a,'reviewQueue',{kind:'reports'},'PERMISSION_DENIED');
  await assert.rejects(setDoc(doc(a.db,`rooms/${roomId}/members/${a.uid}`),{admin:true},{merge:true})); pass('일반 멤버 운영 권한 상승 차단');
  await admin.auth().setCustomUserClaims(c.uid,{admin:true});
  const reports = await call(c,'reviewQueue',{kind:'reports'});
  const report = reports.items.find(r => r.roomId === roomId);
  await call(c,'moderateTrack',{reportId:report.id,action:'hide',requestId:rid()});
  const hidden = (await getDoc(doc(a.db,`rooms/${roomId}/tracks/${b.uid}_${today}`))).data();
  assert.equal(hidden.videoId,''); assert.equal(hidden.comment,''); assert.equal(hidden.hidden,true);
  assert.equal((await dayRef.get()).exists,false);
  await call(b,'registerTrack',{...input,requestId:rid()},'ALREADY_EXISTS'); pass('운영 숨김 원문 제거/집계/일일 슬롯 유지');
  await assert.rejects(getDocs(collectionGroup(a.db,'moderationArchive'))); pass('운영 원문 접근 거부');
  await call(a,'submitFeedback',{message:'테스트 의견',requestId:rid()});
  await call(a,'recordVisit',{}); await call(a,'recordVisit',{}); pass('피드백/최소 방문 이벤트 접수');
  const yesterday = todayKey(new Date(Date.now() - 86400000));
  await db.doc(`rooms/${roomId}/progress/${a.uid}`).set({firstDate:yesterday,returned:false});
  await call(a,'registerTrack',{...input,requestId:rid()});
  const events = await db.collection('events').where('uid','==',a.uid).get();
  assert.equal(events.docs.filter(d=>d.data().name==='next_day_registered' && d.data().roomId===roomId).length,1);
  assert(events.docs.every(d=> !('comment' in d.data()) && !('videoId' in d.data()) && !('nickname' in d.data()))); pass('익일 등록 이벤트/원문 최소수집');
  await db.doc('config/app').set({writesDisabled:true});
  await call(a,'updateTrack',{...input,requestId:rid()},'UNAVAILABLE');
  await db.doc('config/app').set({writesDisabled:false}); pass('운영 쓰기 중지 스위치');
  await db.doc(`rooms/${roomId}`).update({memberCount:29});
  const [d,e] = await Promise.all([user(),user()]);
  const joins = await Promise.allSettled([call(d,'joinRoom',{code:team.inviteCode,nickname:'끝1',requestId:rid()}),call(e,'joinRoom',{code:team.inviteCode,nickname:'끝2',requestId:rid()})]);
  assert.equal(joins.filter(j=>j.status==='fulfilled').length,1);
  assert.equal((await db.doc(`rooms/${roomId}`).get()).data().memberCount,30); pass('마지막 자리 동시 가입 정원30 강제');
  console.log(`완료: ${checks}개 검사. 서버/Firestore 에뮬레이터 사용, YouTube는 명시적 fixture.`);
} finally {
  await Promise.all(apps.map(deleteApp));
  await admin.app().delete();
}

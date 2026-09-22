import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

const MAX_DOCUMENTS = 1000;
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const videoPattern = /^[A-Za-z0-9_-]{11}$/;
const finiteTime = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const text = value => typeof value === 'string' && value.trim().length > 0;
function dateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// 입력값/닉네임/코멘트 원문은 보고서에 넣지 않는다. 문서 경로도 민감정보로 취급한다.
export function inspectRoom(snapshot) {
  const { roomId, room, members = [], tracks = [], days = [], progress = [], archives = [], invite } = snapshot;
  const issues = [];
  const add = (severity, code, path) => issues.push({ severity, code, path });
  const root = `rooms/${roomId}`;
  if (snapshot.truncated) add('blocker', 'SCAN_TRUNCATED', root);
  if (!room) {
    add('blocker', 'ROOM_MISSING', root);
    return { roomId, ready: false, issues };
  }
  if (!text(room.name) || !idPattern.test(room.createdBy ?? '') || !finiteTime(room.createdAt)) add('blocker', 'ROOM_FIELDS', root);
  if (!Number.isInteger(room.memberCount) || room.memberCount !== members.length || room.memberCount > 30) add('blocker', 'MEMBER_COUNT', root);
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(room.inviteCode ?? '') || invite?.roomId !== roomId) add('blocker', 'INVITE_MAPPING', root);
  const byMember = new Map(members.map(doc => [doc.id, doc.data]));
  for (const { id, data } of members) {
    const path = `${root}/members/${id}`;
    if (!idPattern.test(id) || data.uid !== id) add('blocker', 'MEMBER_UID', path);
    if (!text(data.nickname) || data.nickname.trim().length > 8) add('blocker', 'MEMBER_NICKNAME', path);
    if (!finiteTime(data.joinedAt)) add('blocker', 'MEMBER_JOINED_AT', path);
  }
  const byDay = new Map(days.map(doc => [doc.id, doc.data]));
  const grouped = new Map();
  const slots = new Set();
  const tombstoneFields = new Set(['uid', 'nickname', 'dateKey', 'order', 'createdAt', 'metaRefreshedAt', 'title', 'artist', 'comment', 'videoId', 'hidden', 'unavailable', 'embeddable', 'durationSec']);
  for (const { id, data } of tracks) {
    const path = `${root}/tracks/${id}`;
    const slot = `${data.uid}_${data.dateKey}`;
    if (!idPattern.test(data.uid ?? '') || !dateKey(data.dateKey) || id !== slot || slots.has(slot)) add('blocker', 'TRACK_IDENTITY', path);
    slots.add(slot);
    if (!finiteTime(data.order) || !finiteTime(data.createdAt)) add('blocker', 'TRACK_ORDER_TIME', path);
    if (!text(data.nickname) || typeof data.comment !== 'string' || data.comment.length > 30) add('blocker', 'TRACK_TEXT', path);
    if (!byMember.has(data.uid)) add('warning', 'DEPARTED_MEMBER_TRACK', path);
    if (data.hidden === true) {
      if (['title', 'artist', 'comment', 'videoId'].some(key => data[key] !== '') || Object.keys(data).some(key => !tombstoneFields.has(key))) add('blocker', 'HIDDEN_PUBLIC_PAYLOAD', path);
      if (!archives.some(doc => doc.data.trackId === id && doc.data.roomId === roomId)) add('warning', 'HIDDEN_ARCHIVE_MISSING', path);
    } else {
      if (!videoPattern.test(data.videoId ?? '') && data.unavailable !== true) add('blocker', 'TRACK_VIDEO_ID', path);
      if (typeof data.title !== 'string' || typeof data.artist !== 'string') add('blocker', 'TRACK_METADATA_TEXT', path);
      if (!finiteTime(data.metaRefreshedAt) || typeof data.embeddable !== 'boolean' || !finiteTime(data.durationSec)) add('warning', 'METADATA_INCOMPLETE', path);
      if (data.durationSec === 0 && data.unavailable !== true) add('warning', 'SPARK_METADATA_UNVERIFIED', path);
      const list = grouped.get(data.dateKey) ?? [];
      list.push(data);
      grouped.set(data.dateKey, list);
    }
  }
  for (const { id, data } of days) {
    const path = `${root}/days/${id}`;
    if (!dateKey(id) || data.dateKey !== id || !finiteTime(data.updatedAt)) add('blocker', 'DAY_FIELDS', path);
    if (!text(data.themeText)) add('blocker', 'DAY_THEME_MISSING', path);
    const visible = grouped.get(id) ?? [];
    const first = [...visible].sort((a, b) => a.order - b.order || String(a.uid).localeCompare(String(b.uid)))[0];
    if (data.trackCount !== visible.length || !first || data.coverVideoId !== first.videoId) add('blocker', 'DAY_AGGREGATE', path);
  }
  for (const key of grouped.keys()) {
    if (!byDay.has(key)) add('blocker', 'DAY_MISSING', `${root}/days/${key}`);
  }
  for (const uid of new Set(tracks.map(doc => doc.data.uid))) {
    if (!progress.some(doc => doc.id === uid)) add('warning', 'LEGACY_PROGRESS_MISSING', `${root}/progress/${uid}`);
  }
  return { roomId, ready: !issues.some(issue => issue.severity === 'blocker'), counts: { members: members.length, tracks: tracks.length, days: days.length }, issues };
}

export function readOptions(args, env = process.env) {
  const { values } = parseArgs({ args, options: {
    input: { type: 'string' }, project: { type: 'string' }, room: { type: 'string' },
    'allow-live-read': { type: 'boolean', default: false },
  } });
  if (values.input) {
    if (values.project || values.room || values['allow-live-read']) throw new Error('파일 입력과 DB 조회 옵션은 함께 사용할 수 없습니다.');
    return values;
  }
  if (!values.project || !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(values.project) || !idPattern.test(values.room ?? '')) throw new Error('명시적인 --project 및 --room 하나가 필요합니다.');
  const host = env.FIRESTORE_EMULATOR_HOST;
  if (host) {
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || !values.project.startsWith('demo-')) throw new Error('에뮬레이터는 loopback/demo 프로젝트만 허용합니다.');
  } else if (!values['allow-live-read'] || values.project.startsWith('demo-')) {
    throw new Error('운영 조회는 별도 승인 후 --allow-live-read가 필요합니다. 자동 연결하지 않습니다.');
  }
  return values;
}

// 의도적으로 get/limit/where만 사용한다. 전체 rooms 나열이나 쓰기/복구 모드는 없다.
export async function readRoomSnapshot(db, roomId) {
  const root = db.doc(`rooms/${roomId}`);
  const roomDoc = await root.get();
  const room = roomDoc.data();
  const collections = {};
  let truncated = false;
  for (const name of ['members', 'tracks', 'days', 'progress']) {
    const result = await root.collection(name).limit(MAX_DOCUMENTS + 1).get();
    truncated ||= result.size > MAX_DOCUMENTS;
    collections[name] = result.docs.slice(0, MAX_DOCUMENTS).map(doc => ({ id: doc.id, data: doc.data() }));
  }
  const archive = await db.collection('moderationArchive').where('roomId', '==', roomId).limit(MAX_DOCUMENTS + 1).get();
  truncated ||= archive.size > MAX_DOCUMENTS;
  const invite = /^[A-HJ-NP-Z2-9]{6}$/.test(room?.inviteCode ?? '') ? (await db.doc(`invites/${room.inviteCode}`).get()).data() : undefined;
  return { roomId, room, ...collections, invite, archives: archive.docs.slice(0, MAX_DOCUMENTS).map(doc => ({ id: doc.id, data: doc.data() })), truncated };
}

async function main() {
  const options = readOptions(process.argv.slice(2));
  let app;
  try {
    let snapshot;
    if (options.input) snapshot = JSON.parse(await readFile(options.input, 'utf8'));
    else {
      const require = createRequire(new URL('../../firebase/functions/package.json', import.meta.url));
      const admin = require('firebase-admin');
      app = admin.initializeApp({ projectId: options.project });
      snapshot = await readRoomSnapshot(app.firestore(), options.room);
    }
    const report = inspectRoom(snapshot);
    console.log(JSON.stringify(report, null, 2));
    if (!report.ready) process.exitCode = 2;
  } finally { await app?.delete(); }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { avatarColor } from './avatar';
import { todayKey } from './date';
import { themeFor } from './themes';
import { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } from '@/schemas';
import type { CreateRoomInput, JoinRoomInput } from '@/schemas';
import type { Track } from '@/types/models';

/**
 * 쓰기 레이어 — ⚠️ **데모(Spark) 버전: 클라이언트 직접 Firestore 쓰기.**
 *
 * 팀 정본은 이게 아니라 Cloud Functions callable이다(feature/17). Spark에선 Functions를
 * 배포할 수 없어, 데모를 위해 여기서 직접 트랜잭션을 돈다. 불변식은 firestore.rules(데모판)가 강제한다.
 * Blaze를 켜면 이 파일을 feature/17의 httpsCallable 버전으로 되돌린다.
 *
 * 서버 코드가 아니라 dateKey·초대코드 생성이 클라에서 일어난다(저하 모드). 데모엔 수용 가능.
 */

/** 코드에 쓸 수 없는 에러가 아니라 재시도 신호 */
class CodeCollision extends Error {}

/** 지정 코드로 코드 하나 던지는 에러 — errors.ts의 toMessage가 code로 매핑한다 */
function coded(code: string): Error & { code: string } {
  const e = new Error(code) as Error & { code: string };
  e.code = code;
  return e;
}

/** 초대 코드 생성 — 혼동문자 제외 32자셋. 브라우저 CSPRNG 사용 */
function generateInviteCode(): string {
  const buf = new Uint32Array(INVITE_CODE_LENGTH);
  crypto.getRandomValues(buf);
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    code += INVITE_CODE_ALPHABET[buf[i] % INVITE_CODE_ALPHABET.length];
  }
  return code;
}

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw coded('permission-denied');
  return uid;
}

const MAX_ATTEMPTS = 5;
const MAX_MEMBERS = 30;

export interface CreateRoomResult {
  roomId: string;
  inviteCode: string;
}

/**
 * 팀 개설 — 클라 트랜잭션. 초대 코드 유일성은 invites/{code} create-if-absent로 보장.
 * (Functions 버전 functions/src/createRoom.ts와 같은 로직을 클라로 옮긴 것)
 */
export async function createRoom({ name, nickname }: CreateRoomInput): Promise<CreateRoomResult> {
  const uid = requireUid();
  const now = Date.now();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const inviteCode = generateInviteCode();
    const roomRef = doc(collection(db, 'rooms'));
    const inviteRef = doc(db, 'invites', inviteCode);

    try {
      await runTransaction(db, async (tx) => {
        const existing = await tx.get(inviteRef);
        if (existing.exists()) throw new CodeCollision();

        tx.set(inviteRef, { roomId: roomRef.id });
        tx.set(roomRef, { name, inviteCode, createdAt: now, createdBy: uid, memberCount: 1 });
        tx.set(doc(roomRef, 'members', uid), {
          uid,
          nickname,
          joinedAt: now,
          photoColor: avatarColor(nickname),
        });
      });
      return { roomId: roomRef.id, inviteCode };
    } catch (e) {
      if (e instanceof CodeCollision) continue;
      throw e;
    }
  }
  throw coded('resource-exhausted');
}

export interface JoinRoomResult {
  roomId: string;
}

/**
 * 초대 코드로 입장 — 멱등(이미 멤버면 닉네임만 갱신), 정원 30.
 * (Functions 버전 functions/src/joinRoom.ts와 같은 로직)
 */
export async function joinRoom({ code, nickname }: JoinRoomInput): Promise<JoinRoomResult> {
  const uid = requireUid();
  const now = Date.now();

  const inviteSnap = await getDoc(doc(db, 'invites', code));
  if (!inviteSnap.exists()) throw coded('not-found');
  const { roomId } = inviteSnap.data() as { roomId: string };

  const roomRef = doc(db, 'rooms', roomId);
  const memberRef = doc(roomRef, 'members', uid);

  await runTransaction(db, async (tx) => {
    const [roomSnap, memberSnap] = await Promise.all([tx.get(roomRef), tx.get(memberRef)]);
    if (!roomSnap.exists()) throw coded('not-found');

    if (memberSnap.exists()) {
      // 재입장 — 닉네임만 갱신, 정원 안 건드림 (멱등)
      tx.update(memberRef, { nickname, photoColor: avatarColor(nickname) });
      return;
    }

    const memberCount = (roomSnap.data() as { memberCount: number }).memberCount;
    if (memberCount >= MAX_MEMBERS) throw coded('failed-precondition');

    tx.set(memberRef, { uid, nickname, joinedAt: now, photoColor: avatarColor(nickname) });
    tx.update(roomRef, { memberCount: memberCount + 1 });
  });

  return { roomId };
}

export interface RegisterTrackInput {
  roomId: string;
  videoId: string;
  comment: string;
  /** 이 팀에서 내 닉네임 (members 문서 값) — 트랙에 비정규화 저장 */
  nickname: string;
  /** oEmbed로 클라가 미리 받은 메타 (저하 모드 — 서버 videos.list 검증 없음) */
  title: string;
  artist: string;
}

/**
 * 곡 등록 — 클라 트랜잭션 (하루 1곡 + days 집계).
 *
 * ⚠️ 데모(저하 모드): dateKey는 클라 시각, 메타는 oEmbed(제목·채널명)만.
 * 서버 시각 dateKey·videos.list 검증(비공개·지역·라이브)은 Blaze/Functions에서만 된다.
 * 하루 1곡은 문서 ID `{uid}_{dateKey}` + 트랜잭션 존재확인으로 강제.
 */
export async function registerTrack({
  roomId,
  videoId,
  comment,
  nickname,
  title,
  artist,
}: RegisterTrackInput): Promise<void> {
  const uid = requireUid();
  const now = Date.now();
  const dateKey = todayKey();

  const trackRef = doc(db, 'rooms', roomId, 'tracks', `${uid}_${dateKey}`);
  const dayRef = doc(db, 'rooms', roomId, 'days', dateKey);

  await runTransaction(db, async (tx) => {
    // 트랜잭션은 읽기를 전부 쓰기보다 먼저 해야 한다
    const [trackSnap, daySnap] = await Promise.all([tx.get(trackRef), tx.get(dayRef)]);

    // 하루 1곡: 이미 있으면 에러가 아니라 '수정하기' 분기 (errors.ts isAlreadyRegistered)
    if (trackSnap.exists()) throw coded('already-exists');

    const track: Track = {
      videoId,
      title,
      artist,
      comment,
      uid,
      nickname,
      dateKey,
      order: now,
      createdAt: now,
      embeddable: true, // oEmbed로는 알 수 없다 — 낙관 저장, 미리듣기 onError가 방어
      durationSec: 0,
      metaRefreshedAt: now,
    };
    tx.set(trackRef, track);

    if (daySnap.exists()) {
      tx.update(dayRef, { trackCount: (daySnap.data().trackCount ?? 0) + 1, updatedAt: now });
    } else {
      // 그날 첫 곡: 미션·커버를 스냅샷으로 기록 (이후 덮어쓰지 않음)
      tx.set(dayRef, {
        dateKey,
        trackCount: 1,
        coverVideoId: videoId,
        themeText: themeFor(dateKey),
        updatedAt: now,
      });
    }
  });
}

export interface UpdateTrackInput {
  roomId: string;
  videoId: string;
  comment: string;
  title: string;
  artist: string;
}

/**
 * 곡 수정 — 클라 트랜잭션. **당일 본인 곡만**(문서 ID가 `{uid}_{오늘}`이라 지난 날짜는 애초에 대상이 아님).
 * videoId가 바뀌고 그 곡이 그날 커버였다면 `days.coverVideoId`도 따라가 댕글링을 막는다.
 */
export async function updateTrack({
  roomId,
  videoId,
  comment,
  title,
  artist,
}: UpdateTrackInput): Promise<void> {
  const uid = requireUid();
  const now = Date.now();
  const dateKey = todayKey();

  const trackRef = doc(db, 'rooms', roomId, 'tracks', `${uid}_${dateKey}`);
  const dayRef = doc(db, 'rooms', roomId, 'days', dateKey);

  await runTransaction(db, async (tx) => {
    const [trackSnap, daySnap] = await Promise.all([tx.get(trackRef), tx.get(dayRef)]);
    if (!trackSnap.exists()) throw coded('not-found'); // 오늘 곡이 없다 (수정 대상 없음)
    const old = trackSnap.data() as Track;

    // videoId·메타·코멘트만 갱신. uid·nickname·dateKey·order·createdAt은 보존한다.
    tx.update(trackRef, { videoId, title, artist, comment, metaRefreshedAt: now });

    const day = daySnap.exists() ? (daySnap.data() as { coverVideoId?: string }) : null;
    if (day && day.coverVideoId === old.videoId && old.videoId !== videoId) {
      tx.update(dayRef, { coverVideoId: videoId, updatedAt: now });
    }
  });
}

/**
 * 곡 삭제 — 클라 트랜잭션. 당일 본인 곡만.
 * trackCount-1, **0이 되면 days 문서를 삭제**(안 하면 빈 날짜 탭이 영원히 남는다).
 * 삭제한 곡이 커버였고 남은 곡이 있으면 order 최소 곡으로 **커버 재지정**(트랜잭션 밖 쿼리 — tx는 쿼리 불가).
 */
export async function deleteTrack(roomId: string): Promise<void> {
  const uid = requireUid();
  const now = Date.now();
  const dateKey = todayKey();

  const trackRef = doc(db, 'rooms', roomId, 'tracks', `${uid}_${dateKey}`);
  const dayRef = doc(db, 'rooms', roomId, 'days', dateKey);

  let reassignCover = false;

  await runTransaction(db, async (tx) => {
    const [trackSnap, daySnap] = await Promise.all([tx.get(trackRef), tx.get(dayRef)]);
    if (!trackSnap.exists()) throw coded('not-found');
    const removed = trackSnap.data() as Track;
    tx.delete(trackRef);

    if (daySnap.exists()) {
      const day = daySnap.data() as { trackCount?: number; coverVideoId?: string };
      const count = (day.trackCount ?? 1) - 1;
      if (count <= 0) {
        tx.delete(dayRef); // 곡 0개 → 빈 날짜 탭이 남지 않게 집계 문서째 제거
      } else {
        tx.update(dayRef, { trackCount: count, updatedAt: now });
        if (day.coverVideoId === removed.videoId) reassignCover = true;
      }
    }
  });

  // 커버였던 곡을 지웠으면 남은 곡 중 order 최소를 새 커버로 (트랜잭션 커밋 후이므로 삭제가 반영돼 있다).
  // 삭제 자체는 이미 성공했으므로, 재지정 실패가 삭제 실패로 보이지 않게 조용히 넘긴다
  // (실패해도 days.coverVideoId는 삭제된 videoId일 뿐 — 썸네일은 폴백 체인이 방어한다).
  if (reassignCover) {
    try {
      const rest = await getDocs(
        query(
          collection(db, 'rooms', roomId, 'tracks'),
          where('dateKey', '==', dateKey),
          orderBy('order', 'asc'),
          limit(1),
        ),
      );
      const first = rest.docs[0]?.data() as Track | undefined;
      if (first) await updateDoc(dayRef, { coverVideoId: first.videoId, updatedAt: Date.now() });
    } catch {
      // 커버 재지정 실패는 무시 (삭제는 이미 커밋됨)
    }
  }
}

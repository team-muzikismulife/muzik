import assert from "node:assert/strict";
import { clients, invoke, requireWeb } from "../fixtures/local-supabase.ts";
import { todayKey, themeFor } from "../../packages/domain/index.ts";
const { Client } = requireWeb("pg");
const { settings, admin, anonymous, user } = clients();
const db = new Client({ connectionString: settings.DB_URL });
await db.connect();
let checks = 0;
const pass = (name: string) => {
  checks++;
  console.log(`PASS DB/Edge ${name}`);
};
const [a, b, c] = await Promise.all([user(), user(), user()]);
async function ok(
  actor: any,
  action: string,
  payload: Record<string, unknown>,
  id?: string,
  outage = false,
) {
  const result = await invoke(
    settings,
    actor.session,
    action,
    payload,
    id,
    outage,
  );
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}
async function denied(
  actor: any,
  action: string,
  payload: Record<string, unknown>,
  code: string,
  id?: string,
  outage = false,
) {
  const result = await invoke(
    settings,
    actor?.session,
    action,
    payload,
    id,
    outage,
  );
  assert(result.status >= 400);
  if (typeof result.body.code === "string")
    assert.equal(result.body.code, code);
}
try {
  await denied(
    null,
    "createRoom",
    { name: "거부", nickname: "거부" },
    "UNAUTHENTICATED",
  );
  const emailUser = await user(false);
  await emailUser.client.auth.updateUser({
    data: { providers: ["google"], admin: true },
  });
  await denied(
    emailUser,
    "createRoom",
    { name: "거부", nickname: "거부" },
    "UNAUTHENTICATED",
  );
  pass("로그인·서버 Google claim 검증, 사용자 metadata 위조 차단");
  const createId = crypto.randomUUID();
  const created = await ok(
    a,
    "createRoom",
    { name: "핵심 흐름", nickname: "대표" },
    createId,
  );
  assert.deepEqual(
    await ok(
      a,
      "createRoom",
      { name: "핵심 흐름", nickname: "대표" },
      createId,
    ),
    created,
  );
  await denied(
    a,
    "createRoom",
    { name: "변조", nickname: "대표" },
    "REQUEST_CONFLICT",
    createId,
  );
  pass("팀 생성 재시도 멱등·입력 변조 거부");
  const roomId = created.roomId;
  const code = created.code;
  assert.equal(
    (await c.client.from("rooms").select("*").eq("id", roomId)).data.length,
    0,
  );
  assert.equal(
    (await c.client.from("members").select("*").eq("room_id", roomId)).data
      .length,
    0,
  );
  assert((await anonymous.from("rooms").select("*")).error);
  pass("비멤버·비로그인 읽기 차단");
  for (const client of [a.client, c.client, anonymous]) {
    assert(
      (
        await client
          .from("rooms")
          .insert({ name: "우회", invite_code: "ABCDEF", created_by: a.id })
      ).error,
    );
    assert(
      (
        await client
          .from("members")
          .insert({ room_id: roomId, user_id: c.id, nickname: "우회" })
      ).error,
    );
    assert((await client.from("tracks").delete().eq("room_id", roomId)).error);
    assert(
      (
        await client.rpc("muzik_mutate", {
          p_actor: a.id,
          p_action: "joinRoom",
          p_request: crypto.randomUUID(),
          p_payload: { code, nickname: "우회" },
          p_metadata: null,
        })
      ).error,
    );
    assert(
      (
        await client.rpc("muzik_prepare", {
          p_actor: a.id,
          p_action: "createRoom",
          p_request: crypto.randomUUID(),
          p_payload: { name: "우회", nickname: "우회" },
        })
      ).error,
    );
    assert(
      (await client.rpc("muzik_cache_get", { p_video: "dQw4w9WgXcQ" })).error,
    );
    assert(
      (await client.schema("private").from("operators").select("*")).error,
    );
  }
  pass("클라이언트 테이블 쓰기·RPC·private 우회 차단");
  const preview = await ok(b, "getInvitePreview", { code });
  assert.deepEqual(Object.keys(preview).sort(), [
    "isFull",
    "isMember",
    "name",
    "roomId",
  ]);
  assert.equal(preview.isMember, false);
  assert.equal(preview.roomId, null);
  await denied(b, "getInvitePreview", { code: "BAD" }, "INVALID_INPUT");
  pass("로그인 초대 미리보기 최소 필드·코드 검증");
  await ok(b, "joinRoom", { code, nickname: "참여자" });
  await ok(a, "joinRoom", { code, nickname: "덮어쓰지마" });
  assert.equal(
    (
      await a.client
        .from("members")
        .select("nickname")
        .eq("room_id", roomId)
        .eq("user_id", a.id)
    ).data[0].nickname,
    "대표",
  );
  assert.equal((await ok(a, "getInvitePreview", { code })).roomId, roomId);
  pass("가입·기존 멤버 재참여 no-op");
  await ok(b, "updateNickname", { roomId, nickname: "새이름" });
  await denied(c, "updateNickname", { roomId, nickname: "침입" }, "FORBIDDEN");
  await denied(
    b,
    "updateNickname",
    { roomId, nickname: "침입", userId: a.id },
    "INVALID_INPUT",
  );
  await denied(
    b,
    "updateNickname",
    { roomId, nickname: "너무긴닉네임입니다" },
    "INVALID_INPUT",
  );
  pass("본인 팀 닉네임 변경·타인 입력 차단");
  const payload = {
    roomId,
    dateKey: todayKey(),
    videoId: "dQw4w9WgXcQ",
    comment: "첫 추천",
  };
  const requestId = crypto.randomUUID();
  const race = await Promise.all([
    ok(a, "registerTrack", payload, requestId),
    ok(a, "registerTrack", payload, requestId),
  ]);
  assert.deepEqual(race[0], race[1]);
  assert.equal(race[0].dateKey, todayKey());
  assert.deepEqual(
    await ok(a, "registerTrack", payload, requestId, true),
    race[0],
  );
  await denied(
    a,
    "registerTrack",
    { ...payload, comment: "변조" },
    "REQUEST_CONFLICT",
    requestId,
    true,
  );
  await denied(
    a,
    "registerTrack",
    payload,
    "UNAVAILABLE",
    crypto.randomUUID(),
    true,
  );
  await denied(a, "registerTrack", payload, "ALREADY_EXISTS");
  pass("동일 요청 동시 등록·성공 응답 유실/외부 장애 재시도·하루 한 곡");
  await denied(c, "registerTrack", payload, "FORBIDDEN");
  await denied(
    b,
    "registerTrack",
    { ...payload, comment: "가".repeat(31) },
    "INVALID_INPUT",
  );
  await denied(
    b,
    "registerTrack",
    { ...payload, userId: a.id },
    "INVALID_INPUT",
  );
  pass("비멤버·30자·UID 위조 차단");
  const bRaces = await Promise.all([
    invoke(settings, b.session, "registerTrack", {
      ...payload,
      comment: "두 번째",
    }),
    invoke(settings, b.session, "registerTrack", {
      ...payload,
      comment: "세 번째",
    }),
  ]);
  assert.equal(bRaces.filter((x) => x.status === 200).length, 1);
  pass("다른 요청ID 동시 등록 유니크");
  const day = await a.client
    .from("days")
    .select("*")
    .eq("room_id", roomId)
    .single();
  assert.equal(day.data.track_count, 2);
  assert.equal(day.data.theme_text, themeFor(todayKey()));
  const before = (
    await a.client
      .from("tracks")
      .select("*")
      .eq("room_id", roomId)
      .eq("user_id", a.id)
  ).data[0];
  const updateId = crypto.randomUUID();
  const update = {
    ...payload,
    comment: "수정",
    dateKey: todayKey(),
    trackId: before.id,
  };
  await ok(a, "updateTrack", update, updateId);
  await ok(a, "updateTrack", update, updateId, true);
  assert.equal(
    (
      await a.client
        .from("tracks")
        .select("created_at")
        .eq("room_id", roomId)
        .eq("user_id", a.id)
    ).data[0].created_at,
    before.created_at,
  );
  await denied(
    a,
    "updateTrack",
    { ...update, dateKey: "2020-01-01" },
    "TODAY_ONLY",
  );
  await denied(
    a,
    "deleteTrack",
    { roomId, dateKey: "2020-01-01", trackId: before.id },
    "TODAY_ONLY",
  );
  pass("수정 멱등·생성순서 보존·지난 날짜 거부");
  const bTrackId = bRaces.find((x) => x.status === 200)!.body.trackId;
  await denied(
    b,
    "updateTrack",
    { ...update, trackId: before.id },
    "TRACK_CHANGED",
  );
  const reportId = crypto.randomUUID();
  await ok(
    b,
    "reportTrack",
    { roomId, trackId: before.id, reason: "부적절한 내용" },
    reportId,
  );
  await ok(
    b,
    "reportTrack",
    { roomId, trackId: before.id, reason: "부적절한 내용" },
    reportId,
  );
  await ok(b, "reportTrack", {
    roomId,
    trackId: before.id,
    reason: "다시 신고",
  });
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from private.reports where reporter_id=$1 and track_id=$2",
        [b.id, before.id],
      )
    ).rows[0].n,
    1,
  );
  await denied(
    a,
    "reportTrack",
    { roomId, trackId: before.id, reason: "본인" },
    "FORBIDDEN",
  );
  await denied(
    c,
    "reportTrack",
    { roomId, trackId: before.id, reason: "비회원" },
    "FORBIDDEN",
  );
  assert((await b.client.schema("private").from("reports").select("*")).error);
  pass("신고 접수 멱등·중복 방지·비공개·본인/비회원 거부");
  await ok(b, "deleteTrack", {
    roomId,
    dateKey: todayKey(),
    trackId: bTrackId,
  });
  const replacement = await ok(b, "registerTrack", payload);
  assert.notEqual(replacement.trackId, bTrackId);
  await denied(
    b,
    "deleteTrack",
    { roomId, dateKey: todayKey(), trackId: bTrackId },
    "TRACK_CHANGED",
  );
  await denied(
    b,
    "updateTrack",
    { ...update, trackId: bTrackId },
    "TRACK_CHANGED",
  );
  await ok(b, "deleteTrack", {
    roomId,
    dateKey: todayKey(),
    trackId: replacement.trackId,
  });
  pass("삭제 후 재등록 고유 ID·이전 수정/삭제 요청 거부");
  assert.equal(
    (
      await a.client
        .from("days")
        .select("track_count")
        .eq("room_id", roomId)
        .single()
    ).data.track_count,
    1,
  );
  pass("삭제 집계 일치");
  await db.query(
    "update public.tracks set hidden=true,video_id='',title='',artist='',comment='' where room_id=$1 and user_id=$2",
    [roomId, a.id],
  );
  await denied(a, "updateTrack", update, "HIDDEN_TRACK");
  await denied(
    a,
    "deleteTrack",
    { roomId, dateKey: todayKey(), trackId: before.id },
    "HIDDEN_TRACK",
  );
  pass("운영 숨김 슬롯 수정·삭제 금지");
  const kst = await db.query(
    "select private.kst_day('2026-09-21T14:59:59Z')::text a,private.kst_day('2026-09-21T15:00:00Z')::text b",
  );
  assert.equal(kst.rows[0].a, "2026-09-21");
  assert.equal(kst.rows[0].b, "2026-09-22");
  pass("DB 서버 KST 자정 경계");
  const full = await ok(a, "createRoom", {
    name: "정원 경합",
    nickname: "대표",
  });
  const guests = await Promise.all(Array.from({ length: 31 }, () => user()));
  const joins = await Promise.all(
    guests.map((g) =>
      invoke(settings, g.session, "joinRoom", {
        code: full.code,
        nickname: "멤버",
      }),
    ),
  );
  assert.equal(joins.filter((x) => x.status === 200).length, 29);
  assert.equal(joins.filter((x) => x.body.code === "ROOM_FULL").length, 2);
  assert.equal(
    (
      await a.client
        .from("rooms")
        .select("member_count")
        .eq("id", full.roomId)
        .single()
    ).data.member_count,
    30,
  );
  assert.equal(
    (await ok(c, "getInvitePreview", { code: full.code })).isFull,
    true,
  );
  pass("동시 정원30·미리보기 정원 상태");
  for (let i = 0; i < 30; i++)
    await invoke(settings, c.session, "getInvitePreview", { code: "ZZZZZZ" });
  await denied(c, "getInvitePreview", { code }, "RATE_LIMITED");
  pass("초대 조회 요청 제한");
  console.log(
    `완료: Supabase 실제 로컬 DB/Edge ${checks}개 그룹. Google·YouTube는 테스트 fixture, 운영 연결 없음.`,
  );
} finally {
  await db.end();
  await Promise.all([
    a.client.auth.signOut(),
    b.client.auth.signOut(),
    c.client.auth.signOut(),
  ]);
}

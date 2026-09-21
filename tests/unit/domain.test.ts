import { describe, it, expect } from "vitest";
import {
  extractVideoId,
  safeReturnPath,
  todayKey,
  validDate,
  validatePayload,
  errorCode,
  CommandError,
} from "../../packages/domain/index";
describe("순수 공용 계약", () => {
  it("알 수 없는 오류는 입력 오류로 오인하지 않는다", () => {
    expect(errorCode("database disconnected")).toBe("UNAVAILABLE");
    expect(errorCode("toString")).toBe("UNAVAILABLE");
    expect(new CommandError("TODAY_ONLY").code).toBe("TODAY_ONLY");
    expect(() => validatePayload("__proto__", {})).toThrow();
  });
  it("KST 자정", () => {
    expect(todayKey(new Date("2026-09-21T14:59:59Z"))).toBe("2026-09-21");
    expect(todayKey(new Date("2026-09-21T15:00:00Z"))).toBe("2026-09-22");
  });
  it("실제 달력 날짜", () => {
    expect(validDate("2024-02-29")).toBe(true);
    expect(validDate("2026-02-29")).toBe(false);
    expect(validDate("%FF")).toBe(false);
  });
  it("YouTube 호스트·프로토콜·영상 ID", () => {
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ?x=%FF")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(
      extractVideoId("https://youtube.com.evil.invalid/watch?v=dQw4w9WgXcQ"),
    ).toBe(null);
    expect(extractVideoId("javascript://youtu.be/dQw4w9WgXcQ")).toBe(null);
  });
  it("로그인 후 안전한 복귀", () => {
    expect(safeReturnPath("/r/ABCDEF")).toBe("/r/ABCDEF");
    for (const input of [
      "//evil.invalid",
      "https://evil.invalid",
      "/\\evil.invalid",
      "/auth/callback",
      "/r/%FF",
    ])
      expect(safeReturnPath(input)).toBe("/");
  });
  it("UID·임의 필드 위조 차단", () => {
    expect(() =>
      validatePayload("joinRoom", {
        code: "ABCDEF",
        nickname: "나",
        userId: "other",
      }),
    ).toThrow();
    expect(() =>
      validatePayload("updateNickname", {
        roomId: crypto.randomUUID(),
        nickname: "가".repeat(9),
      }),
    ).toThrow();
  });
  it("선택 한마디30자", () => {
    expect(
      validatePayload("registerTrack", {
        roomId: crypto.randomUUID(),
        videoId: "dQw4w9WgXcQ",
        comment: "",
      }).comment,
    ).toBe("");
    expect(() =>
      validatePayload("registerTrack", {
        roomId: crypto.randomUUID(),
        videoId: "dQw4w9WgXcQ",
        comment: "가".repeat(31),
      }),
    ).toThrow();
  });
});

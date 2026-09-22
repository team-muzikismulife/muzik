export const ERROR_MESSAGES = {
  FORBIDDEN: "이 팀에 참여한 계정인지 확인해 주세요.",
  NOT_FOUND: "팀 또는 곡을 찾을 수 없어요.",
  ROOM_FULL: "팀 정원 30명이 모두 찼어요.",
  TODAY_ONLY: "오늘 등록한 내 곡만 변경할 수 있어요.",
  HIDDEN_TRACK: "운영자가 숨긴 곡은 변경할 수 없어요.",
  TRACK_CHANGED: "곡이 삭제되거나 다시 등록됐어요. 현재 곡을 확인해 주세요.",
  ALREADY_EXISTS: "오늘은 이미 곡을 등록했어요.",
  REQUEST_CONFLICT: "요청 내용이 바뀌었어요. 다시 시도해 주세요.",
  RATE_LIMITED: "요청이 많아요. 잠시 후 다시 시도해 주세요.",
  VIDEO_UNAVAILABLE: "재생 가능한 공개 영상을 확인해 주세요.",
  UNAVAILABLE: "연결이 원활하지 않아요. 입력은 유지되니 다시 시도해 주세요.",
  INVALID_INPUT: "입력값을 확인해 주세요.",
  UNAUTHENTICATED: "Google 로그인이 필요해요.",
} as const;
export type ErrorCode = keyof typeof ERROR_MESSAGES;
export function errorCode(value: unknown): ErrorCode {
  return typeof value === "string" && Object.hasOwn(ERROR_MESSAGES, value)
    ? (value as ErrorCode)
    : "UNAVAILABLE";
}
export class CommandError extends Error {
  readonly code: ErrorCode;
  constructor(value: unknown) {
    const code = errorCode(value);
    super(ERROR_MESSAGES[code]);
    this.name = "CommandError";
    this.code = code;
  }
}

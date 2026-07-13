/**
 * Firebase 에러 코드 → 사용자 문구 매핑 (docs/frontend.md § Error Handling)
 * 화면은 메시지를 만들지 않는다. 여기서 받아서 보여주기만 한다.
 */

/** Functions callable이 던지는 코드 (백엔드설계.md §3) */
export type AppErrorCode =
  | 'not-found'
  | 'already-exists'
  | 'failed-precondition'
  | 'permission-denied'
  | 'resource-exhausted'
  | 'invalid-argument'
  | 'unavailable'
  | 'unknown';

const MESSAGES: Record<AppErrorCode, string> = {
  'not-found': '찾을 수 없어요.',
  'already-exists': '이미 등록되어 있어요.',
  'failed-precondition': '지금은 할 수 없는 작업이에요.',
  'permission-denied': '권한이 없어요.',
  'resource-exhausted': '잠시 후 다시 시도해 주세요.',
  'invalid-argument': '입력을 다시 확인해 주세요.',
  unavailable: '네트워크 연결 후 다시 시도해 주세요.',
  unknown: '문제가 발생했어요. 잠시 후 다시 시도해 주세요.',
};

/**
 * 화면별 문구 오버라이드.
 * 같은 not-found라도 "없는 초대 코드예요"와 "삭제된 곡이에요"는 다르게 읽혀야 한다.
 */
export const ERROR_CONTEXT = {
  joinRoom: {
    'not-found': '없는 초대 코드예요. 다시 확인해 주세요.',
    'failed-precondition': '이 팀은 정원이 가득 찼어요. (최대 30명)',
  },
  registerTrack: {
    // already-exists는 에러가 아니라 '수정하기' 분기다 — 화면에서 분기 처리할 것
    'already-exists': '오늘은 이미 곡을 올렸어요.',
    'invalid-argument': '등록할 수 없는 영상이에요.',
    'permission-denied': '이 팀의 팀원이 아니에요.',
  },
  updateTrack: {
    'failed-precondition': '지난 날짜의 곡은 수정할 수 없어요.',
    'not-found': '이미 삭제된 곡이에요.',
  },
  createRoom: {
    'resource-exhausted': '초대 코드를 만들지 못했어요. 잠시 후 다시 시도해 주세요.',
  },
} as const satisfies Record<string, Partial<Record<AppErrorCode, string>>>;

export type ErrorContext = keyof typeof ERROR_CONTEXT;

function codeOf(error: unknown): AppErrorCode {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    // Functions는 'functions/not-found' 형태로 준다
    const raw = String((error as { code: unknown }).code);
    const bare = raw.includes('/') ? raw.split('/')[1] : raw;
    if (bare in MESSAGES) return bare as AppErrorCode;
  }
  return 'unknown';
}

/** 에러 객체 → 화면에 띄울 한국어 문구 */
export function toMessage(error: unknown, context?: ErrorContext): string {
  const code = codeOf(error);
  const override = context ? (ERROR_CONTEXT[context] as Partial<Record<AppErrorCode, string>>)[code] : undefined;
  return override ?? MESSAGES[code];
}

/** 오프라인인가 — "네트워크 연결 후 다시 시도" 토스트 분기용 */
export function isOffline(error: unknown): boolean {
  return codeOf(error) === 'unavailable';
}

/** 하루 1곡 위반 — 에러가 아니라 '수정하기'로 보내는 분기 (docs/frontend.md) */
export function isAlreadyRegistered(error: unknown): boolean {
  return codeOf(error) === 'already-exists';
}

/**
 * dateKey 유틸 — "음악적 하루"는 새벽 4시(KST)에 끝난다.
 * 예: 5/16 03:59 등록 → dateKey '2026-05-15' / 5/16 04:00 → '2026-05-16'
 * 마감 = 배치 작업 없이 dateKey 쿼리로 처리.
 *
 * **클라이언트와 Cloud Functions가 같이 쓴다** (functions/tsconfig.json include).
 * 등록 시점의 dateKey는 서버가 확정하고(registerTrack), 클라는 조회용으로 같은 함수를 쓴다 —
 * 서버가 복사본을 가지면 하루가 어긋난다. 그러니 여기에 React/RN을 import하지 말 것
 * (Functions 빌드가 깨진다). 롤오버 훅은 `src/hooks/useDateKey.ts`에 있다.
 *
 * 타임존은 런타임에 기대지 않고 Intl로 못박는다 — Functions는 리전이 asia-northeast3여도
 * Node 런타임 TZ는 UTC라, 그냥 로컬 날짜를 쓰면 KST 04:00~12:59 구간이 전부 전날로 기록된다.
 */
export const DAY_CUTOFF_HOUR = 4; // KST 새벽 4시 마감

const KST_DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function todayKey(now: Date = new Date()): string {
  // 새벽 4시 이전은 전날로 취급 → 4시간 빼고 날짜 계산
  const shifted = new Date(now.getTime() - DAY_CUTOFF_HOUR * 60 * 60 * 1000);
  return KST_DATE_FMT.format(shifted); // en-CA → YYYY-MM-DD
}

/** 다음 마감(새벽 4시 KST)까지 남은 ms — 롤오버 타이머용 (`useDateKey`) */
export function msUntilCutoff(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const nowSec = (get('hour') % 24) * 3600 + get('minute') * 60 + get('second');
  const cutoffSec = DAY_CUTOFF_HOUR * 3600;
  const leftSec = nowSec < cutoffSec ? cutoffSec - nowSec : 24 * 3600 - nowSec + cutoffSec;
  return leftSec * 1000;
}

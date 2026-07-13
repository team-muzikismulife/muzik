/**
 * dateKey 유틸 — "음악적 하루"는 새벽 4시(KST)에 끝난다.
 * 예: 5/16 03:59 등록 → dateKey '2026-05-15' / 5/16 04:00 → '2026-05-16'
 * 마감 = 배치 작업 없이 dateKey 쿼리로 처리.
 * 주의: 최종 등록 시점의 dateKey는 Cloud Functions 서버 시각으로 재검증할 것.
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

/** 다음 마감(새벽 4시 KST)까지 남은 ms — 카운트다운 타이머용 */
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

export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

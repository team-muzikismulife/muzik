import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

/**
 * 초대 링크·공유 (백엔드설계.md §7 — 6자리 코드 + 링크 병행)
 *
 * **`muzik://r/{code}` 단독으로 보내면 안 된다.** 커스텀 스킴은 웹 브라우저에서도, Expo Go에서도
 * 열리지 않는다 — 받는 쪽에서 죽은 링크가 된다. 그래서
 *   ① 웹에서 열리는 **https URL**을 우선으로 넣고,
 *   ② 링크를 못 만드는 환경이면 **6자리 코드**만으로도 입장할 수 있게(`/room/join` 입력 화면) 항상 코드를 병기한다.
 */

/** 남에게 보낼 수 없는 주소 — 개발 중 origin을 초대 링크로 내보내면 받는 쪽에서 안 열린다 */
function isLocalOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.|\[::1\])/i.test(origin);
}

/**
 * 초대 URL. 우선순위:
 *   ① `EXPO_PUBLIC_WEB_URL` (배포된 공개 도메인) — **플랫폼 무관 최우선**.
 *      네이티브(Expo Go)엔 origin이 아예 없고, 웹도 로컬에서 열면 origin이 localhost라 공유가 불가능하다.
 *   ② 웹 origin — 단 localhost·사설 IP면 제외(공유해도 못 여는 주소).
 *   ③ 없으면 null → 코드만 공유한다(`/room/join` 코드 입력으로 입장 가능).
 */
export function inviteUrl(code: string): string | null {
  const base = process.env.EXPO_PUBLIC_WEB_URL?.trim();
  if (base) return `${base.replace(/\/+$/, '')}/r/${code}`;

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    if (!isLocalOrigin(origin)) return `${origin}/r/${code}`;
  }
  return null;
}

/** 공유·복사에 쓰는 초대 문구. 코드는 **항상** 포함한다(링크가 죽어도 코드로 입장 가능) */
export function inviteMessage(teamName: string, code: string): string {
  const url = inviteUrl(code);
  const lines = [`[MUZIK] 팀 "${teamName}"에 초대합니다.`, `초대 코드: ${code}`];
  if (url) lines.push(url);
  return lines.join('\n');
}

export type ShareResult = 'shared' | 'copied';

/**
 * 초대 공유. 데스크톱 브라우저엔 navigator.share가 없어 Share.share가 실패하므로,
 * 그때는 조용히 **클립보드 복사로 폴백**한다(공유가 아무 일도 안 일어난 것처럼 보이면 안 된다).
 */
export async function shareInvite(teamName: string, code: string): Promise<ShareResult> {
  const message = inviteMessage(teamName, code);
  try {
    await Share.share({ message });
    return 'shared';
  } catch {
    await Clipboard.setStringAsync(message);
    return 'copied';
  }
}

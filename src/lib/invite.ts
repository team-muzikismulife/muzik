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

/** 초대 URL — 웹은 현재 origin, 네이티브는 EXPO_PUBLIC_WEB_URL. 둘 다 없으면 null(코드만 공유) */
export function inviteUrl(code: string): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/r/${code}`;
  }
  // 네이티브는 origin이 없다 — 배포된 웹 도메인을 환경변수로 받아 링크를 만든다
  const base = process.env.EXPO_PUBLIC_WEB_URL;
  return base ? `${base.replace(/\/+$/, '')}/r/${code}` : null;
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

// 상대 경로 — Functions가 이 파일을 컴파일해 Node에서 실행한다.
// '@/' 별칭은 emit 후 해석되지 않아 런타임에 모듈을 못 찾는다.
import { colors } from '../theme/tokens';

/**
 * 닉네임 → 아바타 배경색. **클라이언트와 Cloud Functions가 같은 규칙을 쓴다.**
 * 서버가 `members.photoColor`를 확정하므로 기기가 달라도 같은 사람은 같은 색으로 보인다.
 *
 * RN 컴포넌트가 아니라 여기에 두는 이유: Functions는 react-native를 import할 수 없다.
 */
export function avatarColor(nickname: string): string {
  const palette = colors.avatarPalette;
  return palette[(nickname.codePointAt(0) ?? 0) % palette.length];
}

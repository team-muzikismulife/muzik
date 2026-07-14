import { Text, View, StyleSheet } from 'react-native';
import { colors, radius, shadow, size as sizeToken, spacing, typography } from '@/theme/tokens';

interface Props {
  nickname: string;
  /** Figma: 헤더/카드 32, 겹침 스택 24 */
  size?: number;
  /**
   * 서버가 확정한 배경색 (members.photoColor).
   * 없으면 닉네임 해시로 폴백 — 목데이터·오프라인 대비.
   */
  color?: string;
  /** 참여자 겹침 스택 — Figma: mr -4, drop-shadow -4.8 0 4.8 rgba(0,0,0,0.4) */
  overlap?: boolean;
  /** 트랙 카드 아바타의 white glow — Figma: 0 0 10px rgba(255,255,255,0.25) */
  glow?: boolean;
}

/** 닉네임 → 팔레트 인덱스. Cloud Functions도 같은 규칙으로 photoColor를 확정한다 */
export function avatarColor(nickname: string): string {
  const palette = colors.avatarPalette;
  return palette[(nickname.codePointAt(0) ?? 0) % palette.length];
}

export function Avatar({ nickname, size = sizeToken.avatarMd, color, overlap, glow }: Props) {
  return (
    <View
      // 아바타 자체는 의미가 없다 — 상위 항목의 accessibilityLabel에 닉네임이 포함된다
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.base,
        { width: size, height: size, backgroundColor: color ?? avatarColor(nickname) },
        overlap && styles.overlap,
        overlap && shadow.avatarStack,
        glow && shadow.avatarGlow,
      ]}
    >
      <Text
        style={[typography.avatarInitial, { fontSize: size * 0.45 }]}
        maxFontSizeMultiplier={1} // 원 밖으로 넘치지 않도록 고정
      >
        {nickname.slice(0, 1)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlap: { marginRight: -spacing.xs }, // Figma mr -4 = -xs
});

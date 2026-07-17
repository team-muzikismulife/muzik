import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, opacity, radius, size, spacing, typography } from '@/theme/tokens';
import { Screen } from '@/components/Screen';
import { PressableScale } from '@/components/PressableScale';
import { IconButton } from '@/components/Icon';
import { joinRoom } from '@/lib/api';
import { toMessage } from '@/lib/errors';
import { fieldError, InviteCodeSchema, NicknameSchema } from '@/schemas';
import { useSessionStore } from '@/store/session';
import { toast } from '@/store/ui';

/**
 * 코드로 입장 (모달 라우트) — 초대 링크(`muzik://r/{code}`)가 웹·Expo Go에서 안 열릴 때의 정공법.
 * 6자리 코드를 받아 그대로 joinRoom에 넘긴다. 딥링크 화면(app/r/[code].tsx)과 같은 joinRoom을 쓴다.
 *
 * Figma에 없는 화면 — create.tsx와 같은 임시 디자인 언어(보더형 입력·버튼)를 재사용한다.
 */
export default function JoinRoom() {
  const router = useRouter();
  const lastNickname = useSessionStore((s) => s.lastNickname);
  const setLastNickname = useSessionStore((s) => s.setLastNickname);

  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState(lastNickname ?? '');
  const [submitting, setSubmitting] = useState(false);

  // 혼동문자 보정은 스키마가 한다. 화면에선 공백 제거 + 대문자만 즉시 반영(받아적기 편하게).
  const onChangeCode = (text: string) => setCode(text.replace(/\s/g, '').toUpperCase());

  const codeError = fieldError(InviteCodeSchema, code);
  const nicknameError = fieldError(NicknameSchema, nickname);
  const canSubmit = !codeError && !nicknameError && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { roomId } = await joinRoom({ code, nickname });
      setLastNickname(nickname); // 다음 개설·입장 폼의 기본값
      router.replace(`/room/${roomId}`);
    } catch (e: unknown) {
      // not-found(없는 코드)·failed-precondition(정원)·unavailable(오프라인)를 문구로 분기 (errors.ts)
      toast(toMessage(e, 'joinRoom'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <IconButton
            name="chevronLeft"
            size={size.iconLg}
            accessibilityLabel="닫기"
            onPress={() => router.back()}
          />
          <Text style={typography.title}>팀 참가하기</Text>
        </View>

        <View style={styles.body}>
          <View>
            <Text style={[typography.caption, styles.label]}>초대 코드 (6자리)</Text>
            <TextInput
              value={code}
              onChangeText={onChangeCode}
              placeholder="예: ABC234"
              placeholderTextColor={colors.text40}
              style={[styles.input, styles.codeInput]}
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="next"
              accessibilityLabel="초대 코드 입력"
            />
          </View>

          <View>
            {/* 닉네임은 팀별 속성이다 (백엔드설계.md §1) — 팀마다 다르게 쓸 수 있다 */}
            <Text style={[typography.caption, styles.label]}>이 팀에서 쓸 닉네임</Text>
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              placeholder="닉네임"
              placeholderTextColor={colors.text40}
              style={styles.input}
              maxLength={8}
              returnKeyType="go"
              onSubmitEditing={submit}
              accessibilityLabel="닉네임 입력"
            />
          </View>

          <PressableScale
            style={[styles.btn, styles.btnPrimary, !canSubmit && styles.btnDisabled]}
            disabled={!canSubmit}
            onPress={submit}
            accessibilityRole="button"
            accessibilityLabel="입장하기"
          >
            {submitting ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={typography.bodyMedium}>입장하기</Text>
            )}
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: spacing.xxl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  body: { gap: spacing.xl, padding: spacing.xxl },
  label: { marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.white5,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: size.touch,
    color: colors.text,
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
  },
  // 코드는 받아적는 값이라 자간을 벌려 오독을 줄인다
  codeInput: { letterSpacing: 4, fontFamily: typography.bodyMedium.fontFamily },
  btn: {
    minHeight: size.touch,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
  },
  btnPrimary: {
    backgroundColor: colors.white10,
    borderWidth: 1,
    borderColor: colors.white60,
  },
  btnDisabled: { opacity: opacity.disabled },
});

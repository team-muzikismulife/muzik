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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, opacity, radius, size, spacing, typography } from '@/theme/tokens';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { PressableScale } from '@/components/PressableScale';
import { fieldError, InviteCodeSchema, NicknameSchema } from '@/schemas';
import { joinRoom } from '@/lib/api';
import { toMessage } from '@/lib/errors';
import { useSessionStore } from '@/store/session';

/**
 * 초대 딥링크 진입점: muzik://r/{code} (정식 런칭 시 https://<도메인>/r/{code} 병행)
 *
 * 코드 형태를 먼저 거르고(서버 왕복 전), 닉네임을 받아 joinRoom을 호출한다.
 * joinRoom은 닉네임을 요구하므로 — 신규 사용자는 여기서 처음 이름을 정한다.
 * (#15에서 프로필 기반으로 바뀌면 이 입력은 사라진다)
 */
export default function InviteEntry() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();

  const lastNickname = useSessionStore((s) => s.lastNickname);
  const setLastNickname = useSessionStore((s) => s.setLastNickname);

  // 혼동문자 보정 후 검증 — 서버에 보내기 전에 형태부터 거른다
  const normalized = (code ?? '').trim().toUpperCase();
  const codeError = fieldError(InviteCodeSchema, normalized);

  // null = 아직 안 건드림 → lastNickname을 보여준다 (create.tsx와 같은 패턴)
  const [nicknameInput, setNicknameInput] = useState<string | null>(null);
  const nickname = nicknameInput ?? lastNickname ?? '';
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nicknameError = fieldError(NicknameSchema, nickname);
  const canJoin = !nicknameError && !joining;

  const submit = async () => {
    if (!canJoin) return;
    setJoining(true);
    setError(null);
    try {
      const { roomId } = await joinRoom({ code: normalized, nickname });
      setLastNickname(nickname);
      // 초대 화면은 히스토리에 남기지 않는다 — 뒤로 가면 다시 입장 폼이 뜨는 게 어색하다
      router.replace(`/room/${roomId}`);
    } catch (e: unknown) {
      // not-found·정원초과·오프라인 문구는 errors.ts의 joinRoom 컨텍스트가 만든다
      setError(toMessage(e, 'joinRoom'));
      setJoining(false);
    }
  };

  // 코드 형태부터 틀렸거나(서버 왕복 전) 입장에 실패하면 — 다음 행동이 있는 에러 화면으로
  const blockingError = codeError ?? error;
  if (blockingError) {
    return (
      <Screen>
        <StateView
          status="error"
          title="입장할 수 없어요"
          message={blockingError}
          actionLabel="홈으로"
          onAction={() => router.replace('/')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.body}>
          <View style={styles.intro}>
            <Text style={typography.title}>팀에 입장하기</Text>
            <Text style={[typography.caption, styles.help]}>
              이 팀에서 쓸 닉네임을 정해 주세요.
            </Text>
          </View>

          <View>
            <Text style={[typography.caption, styles.label]}>닉네임</Text>
            <TextInput
              value={nickname}
              onChangeText={setNicknameInput}
              placeholder="닉네임"
              placeholderTextColor={colors.text40}
              style={styles.input}
              maxLength={8}
              returnKeyType="go"
              onSubmitEditing={submit}
              autoFocus
              accessibilityLabel="닉네임 입력"
            />
          </View>

          <PressableScale
            style={[styles.joinBtn, !canJoin && styles.disabled]}
            disabled={!canJoin}
            onPress={submit}
            accessibilityRole="button"
            accessibilityLabel="입장하기"
          >
            {joining ? (
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
  body: { gap: spacing.xl, padding: spacing.xxl },
  intro: { gap: spacing.xs },
  help: { color: colors.text60 },
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
  joinBtn: {
    minHeight: size.touch,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.white10,
    borderWidth: 1,
    borderColor: colors.white60,
  },
  disabled: { opacity: opacity.disabled },
});

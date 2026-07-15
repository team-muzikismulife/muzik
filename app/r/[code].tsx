import { useEffect, useRef, useState } from 'react';
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
import { joinRoom } from '@/lib/api';
import { toMessage } from '@/lib/errors';
import { fieldError, InviteCodeSchema, NicknameSchema } from '@/schemas';
import { useSessionStore } from '@/store/session';

/**
 * 초대 딥링크 진입점: muzik://r/{code} (정식 런칭 시 https://<도메인>/r/{code} 병행)
 *
 * 링크로 들어온 사람은 앱을 방금 깐 신규 사용자일 수 있다 — 그러면 닉네임이 없다.
 * 그래서 두 갈래다: 닉네임이 있으면 바로 입장, 없으면 이 화면에서 먼저 받는다.
 */
type Phase = 'invalid' | 'ask-nickname' | 'joining' | 'error';

export default function InviteEntry() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();

  const lastNickname = useSessionStore((s) => s.lastNickname);
  const setLastNickname = useSessionStore((s) => s.setLastNickname);

  // 혼동문자 보정 후 검증 — 서버에 보내기 전에 형태부터 거른다
  const normalized = (code ?? '').trim().toUpperCase();
  const codeError = fieldError(InviteCodeSchema, normalized);

  const [phase, setPhase] = useState<Phase>(() => {
    if (codeError) return 'invalid';
    return lastNickname ? 'joining' : 'ask-nickname';
  });
  const [message, setMessage] = useState(codeError ?? '');
  const [nickname, setNickname] = useState(lastNickname ?? '');

  // Fast Refresh·재마운트로 자동 입장이 두 번 호출되는 것을 막는다
  const attempted = useRef(false);

  const attemptJoin = async (nick: string) => {
    if (attempted.current) return;
    attempted.current = true;
    setPhase('joining');
    try {
      const { roomId } = await joinRoom({ code: normalized, nickname: nick });
      setLastNickname(nick);
      router.replace(`/room/${roomId}`);
    } catch (e: unknown) {
      // not-found / failed-precondition(정원) / unavailable(오프라인)를 문구로 분기 (errors.ts)
      attempted.current = false; // 재시도 허용
      setMessage(toMessage(e, 'joinRoom'));
      setPhase('error');
    }
  };

  // 닉네임이 이미 있으면 화면 진입 즉시 자동 입장
  useEffect(() => {
    if (phase === 'joining' && lastNickname) attemptJoin(lastNickname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'invalid' || phase === 'error') {
    return (
      <Screen>
        <StateView
          status="error"
          title="입장할 수 없어요"
          message={message}
          actionLabel="홈으로"
          onAction={() => router.replace('/')}
        />
      </Screen>
    );
  }

  if (phase === 'ask-nickname') {
    const nicknameError = fieldError(NicknameSchema, nickname);
    return (
      <Screen>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.body}>
            <View style={styles.intro}>
              <Text style={typography.title}>팀에 들어가기</Text>
              <Text style={[typography.caption, styles.help]}>
                이 팀에서 쓸 닉네임을 정해 주세요.
              </Text>
            </View>

            <View>
              {/* 닉네임은 팀별 속성이다 (백엔드설계.md §1) */}
              <Text style={[typography.caption, styles.label]}>닉네임</Text>
              <TextInput
                value={nickname}
                onChangeText={setNickname}
                placeholder="닉네임"
                placeholderTextColor={colors.text40}
                style={styles.input}
                maxLength={8}
                returnKeyType="go"
                autoFocus
                onSubmitEditing={() => !nicknameError && attemptJoin(nickname)}
                accessibilityLabel="닉네임 입력"
              />
            </View>

            <PressableScale
              style={[styles.btn, !!nicknameError && styles.btnDisabled]}
              disabled={!!nicknameError}
              onPress={() => attemptJoin(nickname)}
              accessibilityRole="button"
              accessibilityLabel="입장하기"
            >
              <Text style={typography.bodyMedium}>입장하기</Text>
            </PressableScale>
          </View>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  // joining
  return (
    <Screen>
      <StateView status="loading" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: spacing.xl, padding: spacing.xxl },
  intro: { gap: spacing.sm },
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
  btn: {
    minHeight: size.touch,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.white10,
    borderWidth: 1,
    borderColor: colors.white60,
  },
  btnDisabled: { opacity: opacity.disabled },
});

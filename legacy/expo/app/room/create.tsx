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
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { colors, radius, size, spacing, typography } from '@/theme/tokens';
import { Screen } from '@/components/Screen';
import { PressableScale } from '@/components/PressableScale';
import { Icon, IconButton } from '@/components/Icon';
import { createRoom } from '@/lib/api';
import { shareInvite } from '@/lib/invite';
import { toMessage } from '@/lib/errors';
import { fieldError, NicknameSchema, RoomNameSchema } from '@/schemas';
import { useSessionStore } from '@/store/session';
import { toast } from '@/store/ui';

/**
 * 팀 개설 (모달 라우트 — docs/frontend.md § URL State)
 *
 * **Figma에 없는 화면이다.** 시안이 나올 때까지의 임시본이라, 새 디자인 언어를 만들지 않고
 * 온보딩의 보더형 입력·버튼(radius 8)과 기존 토큰만 재사용한다. 로직(zod 검증·api 레이어)은
 * 화면 밖에 있으므로, 나중에 시안이 나와도 이 파일의 레이아웃만 다시 짜면 된다.
 *
 * 개설 성공 → 초대 코드를 보여준다. 팀은 혼자면 쓸모가 없으니 곧장 초대로 이어준다.
 */
export default function CreateRoom() {
  const router = useRouter();
  const lastNickname = useSessionStore((s) => s.lastNickname);
  const setLastNickname = useSessionStore((s) => s.setLastNickname);

  const [name, setName] = useState('');
  // null = 아직 안 건드림. 그동안엔 lastNickname을 보여준다 — AsyncStorage 복원이 늦게 와도
  // (useState 초기값으로 굳지 않고) 자동으로 채워진다. props→state 동기화 effect를 피하는 방법.
  const [nicknameInput, setNicknameInput] = useState<string | null>(null);
  const nickname = nicknameInput ?? lastNickname ?? '';
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ roomId: string; inviteCode: string } | null>(null);

  const nameError = fieldError(RoomNameSchema, name);
  const nicknameError = fieldError(NicknameSchema, nickname);
  const canSubmit = !nameError && !nicknameError && !submitting;
  const showNameError = name.trim().length > 0 && !!nameError;
  const showNicknameError = nickname.trim().length > 0 && !!nicknameError;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const result = await createRoom({ name, nickname });
      setLastNickname(nickname); // 다음 개설·입장 폼의 기본값
      setCreated(result);
    } catch (e: unknown) {
      toast(toMessage(e, 'createRoom'));
    } finally {
      setSubmitting(false);
    }
  };

  const enterRoom = () => created && router.replace(`/room/${created.roomId}`);

  if (created) {
    return (
      <Screen>
        <View style={styles.header}>
          <IconButton
            name="chevronLeft"
            size={size.iconLg}
            accessibilityLabel="닫기"
            onPress={enterRoom}
          />
          <Text style={typography.title}>팀을 만들었어요</Text>
        </View>

        <View style={styles.body}>
          <Text style={[typography.caption, styles.help]}>
            이 코드를 팀원에게 보내면 함께할 수 있어요.
          </Text>

          <View style={styles.codeBox}>
            <Text style={styles.code} accessibilityLabel={`초대 코드 ${created.inviteCode.split('').join(' ')}`}>
              {created.inviteCode}
            </Text>
          </View>

          <View style={styles.row}>
            <PressableScale
              style={[styles.btn, styles.btnGhost]}
              onPress={async () => {
                await Clipboard.setStringAsync(created.inviteCode);
                toast('초대 코드를 복사했어요');
              }}
              accessibilityRole="button"
              accessibilityLabel="초대 코드 복사"
            >
              <Icon name="clipboard" size={size.icon} color={colors.text} />
              <Text style={typography.bodyMedium}>복사</Text>
            </PressableScale>

            <PressableScale
              style={[styles.btn, styles.btnGhost]}
              onPress={async () => {
                // 코드 + (웹에서 열리는) https 초대 링크를 함께 보낸다 — src/lib/invite.ts
                const result = await shareInvite(name, created.inviteCode);
                if (result === 'copied') toast('초대 내용을 복사했어요');
              }}
              accessibilityRole="button"
              accessibilityLabel="초대 공유"
            >
              <Icon name="share" size={size.icon} color={colors.text} />
              <Text style={typography.bodyMedium}>공유</Text>
            </PressableScale>
          </View>

          <PressableScale
            style={[styles.btn, styles.btnPrimary]}
            onPress={enterRoom}
            accessibilityRole="button"
            accessibilityLabel="팀으로 이동"
          >
            <Text style={[typography.bodyMedium, styles.onPrimary]}>팀으로 이동</Text>
          </PressableScale>
        </View>
      </Screen>
    );
  }

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
          <Text style={typography.title}>새로운 팀 개설하기</Text>
        </View>

        <View style={styles.body}>
          <View>
            <Text style={[typography.caption, styles.label]}>팀 이름</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="예: 무직은 내 삶"
              placeholderTextColor={colors.text40}
              style={[styles.input, showNameError && styles.inputError]}
              maxLength={20}
              returnKeyType="next"
              accessibilityLabel="팀 이름 입력"
              accessibilityHint={showNameError ? nameError : undefined}
            />
            <Text style={[typography.tab, showNameError ? styles.errorText : styles.metaText]}>
              {showNameError ? nameError : `${name.length}/20`}
            </Text>
          </View>

          <View>
            {/* 닉네임은 팀별 속성이다 (백엔드설계.md §1) — 팀마다 다르게 쓸 수 있다 */}
            <Text style={[typography.caption, styles.label]}>이 팀에서 쓸 닉네임</Text>
            <TextInput
              value={nickname}
              onChangeText={setNicknameInput}
              placeholder="닉네임"
              placeholderTextColor={colors.text40}
              style={[styles.input, showNicknameError && styles.inputError]}
              maxLength={8}
              returnKeyType="done"
              onSubmitEditing={submit}
              accessibilityLabel="닉네임 입력"
              accessibilityHint={showNicknameError ? nicknameError : undefined}
            />
            <Text style={[typography.tab, showNicknameError ? styles.errorText : styles.metaText]}>
              {showNicknameError ? nicknameError : `${nickname.length}/8`}
            </Text>
          </View>

          <PressableScale
            style={[styles.btn, styles.btnPrimary, !canSubmit && styles.btnDisabled]}
            disabled={!canSubmit}
            onPress={submit}
            accessibilityRole="button"
            accessibilityLabel="팀 개설하기"
          >
            {submitting ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={[typography.bodyMedium, canSubmit && styles.onPrimary]}>팀 개설하기</Text>
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
    // IconButton이 44pt 터치 박스를 갖고 있어 좌측 패딩을 줄여 시각적 정렬을 맞춘다
    paddingLeft: spacing.md,
    paddingRight: spacing.xxl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  body: { gap: spacing.xl, padding: spacing.xxl },
  help: { color: colors.text60 },
  label: { marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.white5,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.white10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: size.touch,
    color: colors.text,
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
  },
  inputError: { borderColor: colors.danger },
  metaText: { color: colors.text40, marginTop: spacing.xs, textAlign: 'right' },
  errorText: { color: colors.danger, marginTop: spacing.xs },
  codeBox: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    backgroundColor: colors.white5,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.white20,
  },
  code: {
    ...typography.heroTitle,
    // 코드는 받아적는 값이다 — 자간을 벌려 O/0·I/1 혼동을 줄인다 (자셋에서 이미 제외했지만)
    letterSpacing: 6,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  btn: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: size.touch,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
  },
  btnGhost: { backgroundColor: colors.white10 },
  btnPrimary: {
    backgroundColor: colors.text,
  },
  onPrimary: { color: colors.bg },
  btnDisabled: { backgroundColor: colors.white10 },
});

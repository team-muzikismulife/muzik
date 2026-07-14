import { useCallback, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, radius, size, spacing, typography } from '@/theme/tokens';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { PressableScale } from '@/components/PressableScale';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { TeamCard } from '@/components/TeamCard';
import { fieldError, INVITE_CODE_LENGTH, InviteCodeSchema, NicknameSchema } from '@/schemas';
import { useSessionStore } from '@/store/session';
import { useTeamsStore } from '@/store/teams';

/**
 * 온보딩 / 참여 중인 팀 (Figma 107:1126 "OnBoarding")
 *
 * Figma에는 닉네임·초대 코드 입력란이 없으나(별도 화면 분리 예정), 초대 플로우가 깨지므로
 * 같은 디자인 언어(보더형 radius 8)로 하단에 유지한다.
 */

// Figma: 카드 간 16, 목록과 개설 버튼 사이 32
const LIST_CONTENT = { gap: spacing.lg, paddingBottom: spacing.lg };

export default function Onboarding() {
  const router = useRouter();

  const uid = useSessionStore((s) => s.uid);
  const lastNickname = useSessionStore((s) => s.lastNickname);
  const setLastNickname = useSessionStore((s) => s.setLastNickname);

  const teams = useTeamsStore((s) => s.teams);
  const teamsStatus = useTeamsStore((s) => s.status);
  const teamsError = useTeamsStore((s) => s.error);
  const loadTeams = useTeamsStore((s) => s.load);

  // 포커스 중에만 조회한다 — 방 개설·입장 후 돌아오면 목록이 갱신된다
  useFocusEffect(
    useCallback(() => {
      if (uid) loadTeams(uid);
    }, [uid, loadTeams]),
  );

  const [nickname, setNickname] = useState(lastNickname ?? '');
  const [inviteCode, setInviteCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);

  const nicknameError = fieldError(NicknameSchema, nickname);
  const codeError = inviteCode ? fieldError(InviteCodeSchema, inviteCode) : null;
  const canJoin = !nicknameError && !codeError && inviteCode.length === INVITE_CODE_LENGTH;

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 헤더 — 인사말 + 내 프로필. 아직 어느 팀에도 안 들어갔으면 닉네임이 없다 */}
        <View style={styles.header}>
          <Text style={typography.title} numberOfLines={1}>
            환영합니다{lastNickname ? `, ${lastNickname}님` : ''}
          </Text>
          <Avatar nickname={lastNickname || '?'} size={size.avatarMd} glow />
        </View>

        <View style={styles.body}>
          <Text style={typography.bodyMedium}>참여 중인 팀</Text>

          <FlatList
            data={teamsStatus === 'ready' ? teams : []}
            keyExtractor={(t) => t.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={LIST_CONTENT}
            ListEmptyComponent={
              teamsStatus === 'loading' ? (
                <StateView status="loading" />
              ) : teamsStatus === 'error' ? (
                <StateView
                  status="error"
                  title="팀 목록을 불러오지 못했어요"
                  message={teamsError ?? undefined}
                  actionLabel="다시 시도"
                  onAction={() => uid && loadTeams(uid)}
                />
              ) : (
                // 신규 사용자가 가장 먼저 보는 화면이다 — 다음 행동(개설)으로 이어줘야 한다
                <StateView
                  status="empty"
                  title="참여 중인 팀이 없어요"
                  message="팀을 만들거나, 받은 초대 코드를 입력해 보세요."
                />
              )
            }
            renderItem={({ item }) => (
              <TeamCard
                name={item.name}
                memberCount={item.memberCount}
                members={item.members}
                onPress={() => router.push(`/room/${item.id}`)}
              />
            )}
            // Figma: 팀 목록 바로 아래 (gap 32) — 화면 하단에 밀어두지 않는다
            ListFooterComponent={
              <PressableScale
                style={styles.createBtn}
                disabled={!!nicknameError}
                onPress={() => {
                  // TODO(M1): app/room/create.tsx 로 이동 → createRoom
                }}
                accessibilityRole="button"
                accessibilityLabel="새로운 팀 개설하기"
              >
                <Icon name="plus" size={size.icon} color={colors.text} />
                <Text style={typography.bodyMedium}>새로운 팀 개설하기</Text>
              </PressableScale>
            }
          />

          {/* 초대: 딥링크 없이도 6자리 코드로 입장 가능 (도메인 불필요) */}
          <View style={styles.form}>
            <View>
              <Text style={[typography.caption, styles.label]}>닉네임</Text>
              <TextInput
                value={nickname}
                onChangeText={setNickname}
                // 입력 중이 아니라 끝났을 때 기억한다 — 키 입력마다 쓰지 않는다
                onBlur={() => !nicknameError && setLastNickname(nickname)}
                placeholder="닉네임"
                placeholderTextColor={colors.text40}
                style={styles.input}
                maxLength={8}
                returnKeyType="done"
                accessibilityLabel="닉네임 입력"
              />
              {!!nicknameError && <Text style={styles.error}>{nicknameError}</Text>}
            </View>

            <View>
              <Text style={[typography.caption, styles.label]}>초대 코드</Text>
              <View style={styles.inviteRow}>
                <TextInput
                  value={inviteCode}
                  onChangeText={(v) => {
                    setInviteCode(v.toUpperCase());
                    setCodeTouched(true);
                  }}
                  placeholder="예: A3K9ZQ"
                  placeholderTextColor={colors.text40}
                  style={[styles.input, styles.flex]}
                  maxLength={INVITE_CODE_LENGTH}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={() => canJoin && router.push(`/r/${inviteCode}`)}
                  accessibilityLabel="초대 코드 입력"
                />
                <PressableScale
                  style={styles.joinBtn}
                  disabled={!canJoin}
                  onPress={() => router.push(`/r/${inviteCode}`)}
                  accessibilityRole="button"
                  accessibilityLabel="초대 코드로 입장"
                >
                  <Text style={typography.captionMedium}>입장</Text>
                </PressableScale>
              </View>
              {codeTouched && !!codeError && <Text style={styles.error}>{codeError}</Text>}
            </View>
          </View>
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
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxl,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  body: { flex: 1, gap: spacing.xxl, padding: spacing.xxl },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    minHeight: size.touch,
    paddingVertical: spacing.md,
    backgroundColor: colors.white3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.white20,
  },
  form: { gap: spacing.md },
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
  inviteRow: { flexDirection: 'row', gap: spacing.sm },
  joinBtn: {
    backgroundColor: colors.white10,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xl,
    minHeight: size.touch,
    justifyContent: 'center',
  },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
});

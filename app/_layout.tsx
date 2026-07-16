import { useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { colors, radius, size, spacing, typography } from '@/theme/tokens';
import { PressableScale } from '@/components/PressableScale';
import { Toast } from '@/components/Toast';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { useSessionStore } from '@/store/session';

// 폰트 로딩 전에 스플래시가 사라지면 시스템 폰트로 한 프레임 깜빡인다
SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * expo-router는 라우트 파일에서 named export한 ErrorBoundary를 사용한다.
 * (별도 컴포넌트로 감싸는 방식이 아님)
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  // 상세 메시지는 로깅으로만 — 사용자에겐 일반화된 문구만 노출한다 (내부 정보 노출 방지)
  useEffect(() => {
    console.error('RootLayout ErrorBoundary:', error);
  }, [error]);
  return (
    <View style={styles.fallback}>
      <Text style={typography.bodyMedium}>문제가 발생했어요</Text>
      <Text style={[typography.caption, styles.center]}>잠시 후 다시 시도해 주세요.</Text>
      <PressableScale
        style={styles.retry}
        onPress={retry}
        accessibilityRole="button"
        accessibilityLabel="다시 시도"
      >
        <Text style={typography.captionMedium}>다시 시도</Text>
      </PressableScale>
    </View>
  );
}

export default function RootLayout() {
  // Figma 전 구간이 Pretendard — 시스템 폰트로는 자간·자형이 맞지 않는다
  const [fontsLoaded, fontError] = useFonts({
    'Pretendard-Regular': require('../assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-Medium': require('../assets/fonts/Pretendard-Medium.otf'),
    'Pretendard-SemiBold': require('../assets/fonts/Pretendard-SemiBold.otf'),
  });

  // 익명 로그인 — uid가 없으면 어떤 화면도 데이터를 읽을 수 없으므로 루트에서 부트스트랩한다
  const authStatus = useSessionStore((s) => s.status);
  const authError = useSessionStore((s) => s.error);
  const retryAuth = useSessionStore((s) => s.retry);
  const bootstrap = useSessionStore((s) => s.bootstrap);

  useEffect(() => bootstrap(), [bootstrap]);

  const ready = (fontsLoaded || fontError) && authStatus !== 'loading';

  useEffect(() => {
    // 폰트 로딩이 실패해도 앱은 띄운다 (시스템 폰트 폴백) — 흰 화면으로 멈추지 않는다
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  // 인증 실패는 흰 화면이 아니라 다음 행동이 있는 화면으로 (docs/frontend.md § Error Handling)
  if (authStatus === 'error') {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Screen>
          <StateView
            status="error"
            title="시작하지 못했어요"
            message={authError ?? '네트워크 연결을 확인한 뒤 다시 시도해 주세요.'}
            actionLabel="다시 시도"
            onAction={retryAuth}
          />
        </Screen>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        {/* 모달은 라우트로 표현한다 — 뒤로가기·상태복원이 공짜로 따라온다 (frontend.md) */}
        <Stack.Screen name="room/create" options={{ presentation: 'modal' }} />
        <Stack.Screen name="room/[id]/index" />
        <Stack.Screen name="room/[id]/track/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="room/[id]/playlist/[dateKey]" />
        <Stack.Screen name="r/[code]" />
      </Stack>
      {/* 실패·안내의 단일 채널 — 화면 어디서든 toast()로 띄운다 */}
      <Toast />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xxl,
    backgroundColor: colors.bg,
  },
  center: { textAlign: 'center' },
  retry: {
    marginTop: spacing.sm,
    minHeight: size.ctaSm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white10,
    borderRadius: radius.full,
    justifyContent: 'center',
  },
});

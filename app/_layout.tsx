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

// 폰트 로딩 전에 스플래시가 사라지면 시스템 폰트로 한 프레임 깜빡인다
SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * expo-router는 라우트 파일에서 named export한 ErrorBoundary를 사용한다.
 * (별도 컴포넌트로 감싸는 방식이 아님)
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={styles.fallback}>
      <Text style={typography.bodyMedium}>문제가 발생했어요</Text>
      <Text style={[typography.caption, styles.center]}>{error.message}</Text>
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

  useEffect(() => {
    // 폰트 로딩이 실패해도 앱은 띄운다 (시스템 폰트 폴백) — 흰 화면으로 멈추지 않는다
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

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
        <Stack.Screen name="room/[id]/index" />
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

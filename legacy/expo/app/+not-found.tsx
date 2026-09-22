import { Stack, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';

/** 잘못된 딥링크·삭제된 팀으로 진입했을 때 흰 화면/크래시 대신 안내한다 */
export default function NotFound() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: '' }} />
      <Screen>
        <StateView
          status="error"
          title="찾을 수 없는 페이지예요"
          message="주소가 잘못되었거나 삭제된 팀일 수 있어요."
          actionLabel="홈으로"
          onAction={() => router.replace('/')}
        />
      </Screen>
    </>
  );
}

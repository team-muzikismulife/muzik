import { useRouter } from 'expo-router';
import { Screen } from './Screen';
import { StateView } from './StateView';

export function InvalidLink() {
  const router = useRouter();
  return (
    <Screen>
      <StateView
        status="error"
        title="링크를 확인해 주세요"
        message="팀 또는 날짜 정보가 올바르지 않아요."
        actionLabel="팀 목록으로"
        onAction={() => router.replace('/')}
      />
    </Screen>
  );
}

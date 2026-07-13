import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { fieldError, InviteCodeSchema } from '@/schemas';

/**
 * 초대 딥링크 진입점: muzik://r/{code} (정식 런칭 시 https://<도메인>/r/{code} 병행)
 * TODO(M1): joinRoom(code, nickname) 실연동 + 닉네임이 없으면 이 화면에서 먼저 받기
 */
type Status = 'checking' | 'error';

export default function InviteEntry() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();

  // 혼동문자 보정 후 검증 — 서버에 보내기 전에 형태부터 거른다
  const normalized = (code ?? '').trim().toUpperCase();
  const codeError = fieldError(InviteCodeSchema, normalized);

  const [status, setStatus] = useState<Status>(codeError ? 'error' : 'checking');
  const [message, setMessage] = useState(codeError ?? '');

  useEffect(() => {
    if (codeError) {
      setStatus('error');
      setMessage(codeError);
      return;
    }
    // TODO(M1): const { roomId } = await joinRoom({ code: normalized, nickname })
    //           → router.replace(`/room/${roomId}`) / not-found·정원초과 에러 분기
    setStatus('checking');
  }, [codeError, normalized]);

  if (status === 'error') {
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

  return (
    <Screen>
      <StateView status="loading" />
    </Screen>
  );
}

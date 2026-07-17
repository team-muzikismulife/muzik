import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { msUntilCutoff, todayKey } from '@/lib/date';

/**
 * 지금의 dateKey — 새벽 4시(KST) 마감을 넘기면 **스스로 갱신된다.**
 *
 * 왜 훅으로 두나: 원래 롤오버는 미션 배너의 카운트다운이 0에 닿는 걸 트리거로 삼았다
 * (백엔드설계.md §5). 그런데 Figma 재동기화에서 카운트다운 UI가 제거되면서 트리거가
 * 통째로 사라졌다 — 앱을 켜둔 채 4시를 넘기면 어제 dateKey로 구독이 남는다.
 * 시간 경계는 화면 장식이 아니라 데이터 레이어의 문제이므로, UI에 얹지 않고 여기 둔다.
 *
 * 타이머와 AppState를 같이 쓰는 이유: 켜둔 앱은 타이머가 깨우지만, 백그라운드에선 타이머가
 * 밀리거나 죽는다. 그래서 포그라운드 복귀 때 무조건 다시 맞춘다.
 *
 * 값이 그대로면 setState가 같은 문자열이라 리렌더는 일어나지 않는다.
 */
export function useDateKey(): string {
  const [dateKey, setDateKey] = useState(todayKey);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const sync = () => {
      setDateKey(todayKey());
      // 다음 마감에 다시 깨운다. +1s는 경계에서 todayKey()가 아직 직전 날짜를 내주는 걸 피하는 여유.
      timer = setTimeout(sync, msUntilCutoff() + 1000);
    };

    timer = setTimeout(sync, msUntilCutoff() + 1000);

    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      clearTimeout(timer);
      sync();
    });

    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);

  return dateKey;
}

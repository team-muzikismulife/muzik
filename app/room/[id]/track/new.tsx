import { useLocalSearchParams } from 'expo-router';
import { TrackForm } from '@/components/TrackForm';

/**
 * 곡 등록 모달 (docs/곡등록설계.md §2) — presentation: 'modal'은 _layout.tsx에서 지정.
 * URL이 생기므로 뒤로가기·상태복원·(나중에) 유튜브 공유 인텐트 진입이 공짜다.
 */
export default function NewTrack() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // TODO(M1): session.uid / members[uid].nickname 로 교체 — 홈 데모 정체성(u2·승완)과 맞춘다
  return <TrackForm roomId={id} uid="u2" nickname="승완" />;
}

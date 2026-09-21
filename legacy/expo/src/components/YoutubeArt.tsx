import { useState } from 'react';
import { Image, type ImageLoadEventData } from 'expo-image';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, duration } from '@/theme/tokens';
import { PLACEHOLDER_MAX_WIDTH, THUMB_CHAIN, thumbnailUrl } from '@/lib/youtube';

interface Props {
  /** 유일한 원본. 썸네일 URL은 여기서 파생한다 — 별도 필드로 받지 않는다. */
  videoId: string;
  /** 컨테이너 (카드 배경이면 StyleSheet.absoluteFill, 썸네일이면 크기 지정) */
  style?: StyleProp<ViewStyle>;
  /** 작은 썸네일은 저해상도부터 — 큰 파일을 받을 이유가 없다 */
  small?: boolean;
}

/**
 * 유튜브 썸네일 (i.ytimg.com 핫링크만 — 파일 저장 안 함, YouTube 정책)
 *
 * 두 가지 함정을 함께 해결한다 (src/lib/youtube.ts THUMB_CHAIN 주석 참고):
 *  1. maxresdefault는 404가 잦다 → sddefault → mqdefault 순으로 폴백
 *  2. sd/hqdefault는 4:3 레터박스다 → **항상 16:9 박스 안에 cover로 그려** 검은 띠를 정확히 잘라낸다
 *
 * 16:9 박스는 컨테이너 높이를 채우고 가로로 넘치며, 컨테이너가 overflow:hidden으로 자른다.
 */
export function YoutubeArt({ videoId, style, small }: Props) {
  // videoId가 바뀌면 폴백 단계도 처음부터 — key로 강제 리마운트
  return <ArtInner key={videoId} videoId={videoId} style={style} small={small} />;
}

function ArtInner({ videoId, style, small }: Props) {
  const [step, setStep] = useState(small ? THUMB_CHAIN.length - 1 : 0);
  const quality = THUMB_CHAIN[step];

  const fallback = () => setStep((s) => Math.min(s + 1, THUMB_CHAIN.length - 1));

  const onLoad = (e: ImageLoadEventData) => {
    // 404 대신 회색 플레이스홀더(120×90)를 200으로 주는 경우 — onError가 안 뜬다
    if (step === 0 && e.source.width <= PLACEHOLDER_MAX_WIDTH) fallback();
  };

  return (
    <View style={[styles.clip, style]}>
      <View style={styles.box16x9}>
        <Image
          source={thumbnailUrl(videoId, quality)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={duration.fast}
          cachePolicy="memory-disk"
          onError={fallback}
          onLoad={onLoad}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    backgroundColor: colors.white5, // 로드 실패 시 남는 폴백
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** 높이를 채우고 가로로 넘치는 16:9 박스 — 레터박스 띠가 여기서 잘린다 */
  box16x9: {
    height: '100%',
    aspectRatio: 16 / 9,
    minWidth: '100%',
  },
});

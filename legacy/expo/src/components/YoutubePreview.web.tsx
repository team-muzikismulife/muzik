import { createElement, type CSSProperties } from 'react';
import { View } from 'react-native';
import { colors, radius } from '@/theme/tokens';

interface Props {
  height: number;
  play: boolean;
  videoId: string;
  onChangeState?: (state: string) => void;
  onError?: () => void;
}

const iframeStyle: CSSProperties = {
  border: 0,
  display: 'block',
  height: '100%',
  width: '100%',
};

/** 웹 미리듣기 — WebView 의존성 없이 브라우저 iframe으로 렌더한다. */
export function YoutubePreview({ height, play, videoId, onError }: Props) {
  const src = `https://www.youtube.com/embed/${videoId}?playsinline=1${play ? '&autoplay=1' : ''}`;

  return (
    <View style={{ height, overflow: 'hidden', borderRadius: radius.input, backgroundColor: colors.card }}>
      {createElement('iframe', {
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
        allowFullScreen: true,
        onError,
        src,
        style: iframeStyle,
        title: 'YouTube preview',
      })}
    </View>
  );
}

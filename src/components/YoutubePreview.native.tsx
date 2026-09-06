import YoutubePlayer from 'react-native-youtube-iframe';

interface Props {
  height: number;
  play: boolean;
  videoId: string;
  onChangeState?: (state: string) => void;
  onError?: () => void;
}

/** 네이티브 미리듣기 — react-native-youtube-iframe은 웹 번들에서 별도 의존성이 필요하므로 native 전용으로 둔다. */
export function YoutubePreview({ height, play, videoId, onChangeState, onError }: Props) {
  return (
    <YoutubePlayer
      height={height}
      play={play}
      videoId={videoId}
      onChangeState={onChangeState}
      onError={onError}
    />
  );
}

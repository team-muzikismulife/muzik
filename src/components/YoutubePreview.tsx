import YoutubePlayer from 'react-native-youtube-iframe';

interface Props {
  height: number;
  play: boolean;
  videoId: string;
  onChangeState?: (state: string) => void;
  onError?: () => void;
}

/** 기본 미리듣기 — Metro web 빌드는 YoutubePreview.web.tsx를 우선 사용한다. */
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

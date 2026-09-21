import { defineSecret } from 'firebase-functions/params';
import { HttpsError } from 'firebase-functions/v2/https';
import { emulator } from './core';
import { getFirestore } from 'firebase-admin/firestore';

export const youtubeKey = defineSecret('YOUTUBE_API_KEY');
export const videoOptions = { secrets: emulator ? [] : [youtubeKey] };
export interface VideoMetadata { title: string; artist: string; embeddable: boolean; durationSec: number; unavailable: boolean; metaRefreshedAt: number }
export async function videoMetadata(videoId: string): Promise<VideoMetadata> {
  if (emulator && process.env.MUZIK_TEST_VIDEO_FIXTURE === 'true') {
    const failure = await getFirestore().runTransaction(async tx => {
      const ref = getFirestore().doc(`testVideoFailures/${videoId}`);
      const previous = await tx.get(ref);
      tx.set(ref, { calls: (previous.data()?.calls ?? 0) + 1 }, { merge: true });
      return previous.data()?.failure;
    });
    if (failure === 'unavailable' || failure === 'invalid-argument' || failure === 'resource-exhausted') {
      throw new HttpsError(failure, '에뮬레이터 검증용 영상 API 장애');
    }
    if (videoId === 'unavailable') throw new HttpsError('invalid-argument', '재생할 수 없는 영상이에요.');
    return { title: '에뮬레이터 검증용 곡', artist: '테스트', embeddable: true, durationSec: 180, unavailable: false, metaRefreshedAt: Date.now() };
  }
  const key = youtubeKey.value();
  if (!key) throw new HttpsError('failed-precondition', '영상 검증 서버 설정이 필요해요.');
  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.search = new URLSearchParams({ part: 'snippet,status,contentDetails', id: videoId, key }).toString();
  let response: Response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(8000) }); }
  catch { throw new HttpsError('unavailable', '영상 확인이 지연되고 있어요. 다시 시도해 주세요.'); }
  if (!response.ok) throw new HttpsError('unavailable', '영상 확인 서비스를 잠시 사용할 수 없어요.');
  const body = await response.json() as { items?: { snippet: { title: string; channelTitle: string; liveBroadcastContent: string }; status: { privacyStatus: string; uploadStatus: string; embeddable: boolean }; contentDetails: { duration: string; regionRestriction?: { allowed?: string[]; blocked?: string[] }; contentRating?: { ytRating?: string } } }[] };
  const video = body.items?.[0];
  const region = video?.contentDetails.regionRestriction;
  if (!video || !['public', 'unlisted'].includes(video.status.privacyStatus) || video.status.uploadStatus !== 'processed' || video.snippet.liveBroadcastContent !== 'none' || region?.blocked?.includes('KR') || (region?.allowed && !region.allowed.includes('KR')) || video.contentDetails.contentRating?.ytRating === 'ytAgeRestricted') {
    throw new HttpsError('invalid-argument', '공유 가능한 일반 공개 영상을 선택해 주세요.');
  }
  const duration = video.contentDetails.duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  return { title: video.snippet.title.slice(0, 200), artist: video.snippet.channelTitle.slice(0, 100), embeddable: video.status.embeddable, durationSec: duration ? Number(duration[1] ?? 0) * 3600 + Number(duration[2] ?? 0) * 60 + Number(duration[3] ?? 0) : 0, unavailable: false, metaRefreshedAt: Date.now() };
}

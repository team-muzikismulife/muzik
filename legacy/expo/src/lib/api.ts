import { httpsCallable } from 'firebase/functions';
import { auth, functions } from './firebase';
import { isMockPreviewEnabled } from './mockPreview';
import type { CreateRoomInput, JoinRoomInput } from '@/schemas';
import type { Track } from '@/types/models';

const pending = new Map<string, { id: string; promise?: Promise<unknown> }>();
export function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `request_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
export async function call<Res>(name: string, data: object, mutation = true): Promise<Res> {
  if (isMockPreviewEnabled()) throw Object.assign(new Error('시연 모드에서는 저장되지 않아요.'), { code: 'demo-only' });
  const key = JSON.stringify([auth.currentUser?.uid, name, data]);
  const item = pending.get(key) ?? { id: requestId() };
  if (item.promise) return item.promise as Promise<Res>;
  pending.set(key, item);
  item.promise = httpsCallable<object, Res>(functions, name)(mutation ? { ...data, requestId: item.id } : data)
    .then(result => { pending.delete(key); return result.data; })
    .catch(error => { item.promise = undefined; throw error; });
  return item.promise as Promise<Res>;
}

export interface CreateRoomResult { roomId: string; inviteCode: string }
export const createRoom = (input: CreateRoomInput) => call<CreateRoomResult>('createRoom', input);
export const joinRoom = (input: JoinRoomInput) => call<{ roomId: string }>('joinRoom', input);
export interface RegisterTrackInput { roomId: string; videoId: string; comment: string; nickname?: string; title?: string; artist?: string }
export type UpdateTrackInput = RegisterTrackInput;
const trackPayload = ({ roomId, videoId, comment }: RegisterTrackInput) => ({ roomId, videoId, comment });
export const registerTrack = (input: RegisterTrackInput) => call<{ dateKey: string }>('registerTrack', trackPayload(input));
export const updateTrack = (input: UpdateTrackInput) => call<{ dateKey: string }>('updateTrack', trackPayload(input));
export const deleteTrack = (roomId: string) => call<{ ok: boolean }>('deleteTrack', { roomId });
export const previewTrack = (roomId: string, videoId: string) => call<{ videoId: string; title: string; artist: string }>('previewTrack', { roomId, videoId }, false);
export const refreshMeta = (roomId: string, dateKey: string) => call<{ refreshed: number }>('refreshMeta', { roomId, dateKey }, false);
export const reportTrack = (roomId: string, trackId: string, reason: 'inappropriate' | 'copyright' | 'other') => call('reportTrack', { roomId, trackId, reason });
export const submitFeedback = (message: string) => call('submitFeedback', { message });
export const recordVisit = () => call('recordVisit', {}, false);
export interface ReviewItem { id: string; roomId?: string; trackId?: string; reason?: string; message?: string; status?: string; name?: string; at?: number; createdAt?: number; title?: string; comment?: string; videoId?: string }
export const reviewQueue = (kind: 'reports' | 'feedback' | 'events') => call<{ items: ReviewItem[] }>('reviewQueue', { kind }, false);
export const moderateTrack = (reportId: string, action: 'hide' | 'dismiss') => call('moderateTrack', { reportId, action });

// 후속 기능의 기존 화면 소스는 보존하지만 서버 쓰기와 직접 URL 진입은 닫는다.
export const DEFAULT_SHARED_PLAYLIST_ID = 'favorites';
export const DEFAULT_SHARED_PLAYLIST_NAME = '즐겨찾는 노래';
export async function ensureSharedPlaylist(_input: { roomId: string; name?: string }): Promise<{ playlistId: string }> {
  throw new Error('공동 즐겨찾기는 베타 이후 제공됩니다.');
}
export async function addTracksToSharedPlaylist(_input: { roomId: string; tracks: Track[]; playlistId?: string; playlistName?: string }): Promise<{ playlistId: string; addedCount: number }> {
  throw new Error('공동 즐겨찾기는 베타 이후 제공됩니다.');
}

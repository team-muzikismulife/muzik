import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { Track } from '@/types/models';

export const trackKey = (roomId: string, track: Track) => `${roomId}:${track.uid}_${track.dateKey}`;
const STORAGE_KEY = 'muzik.hiddenTracks';
export const useHiddenTracks = create<{
  keys: string[];
  hide: (key: string) => void;
  restore: () => void;
}>((set) => ({
  keys: [],
  hide: key => set(state => {
    const keys = [...new Set([...state.keys, key])];
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(keys)).catch(() => {});
    return { keys };
  }),
  restore: () => { AsyncStorage.removeItem(STORAGE_KEY).catch(() => {}); set({ keys: [] }); },
}));
AsyncStorage.getItem(STORAGE_KEY).then(value => {
  if (!value) return;
  const keys: unknown = JSON.parse(value);
  if (Array.isArray(keys) && keys.every(k => typeof k === 'string')) useHiddenTracks.setState({ keys });
}).catch(() => {});

/**
 * Player profiles kept on this device. Nobody has to make one: without a profile you play as a
 * guest, as before. A profile has a name, a ready-made avatar (or your own picture) and its own
 * stats and achievements.
 */
import { useSyncExternalStore } from 'react';
import { getSettings, updateSettings } from '../theme/settings';

export interface AvatarDef {
  id: string;
  emoji: string;
  bg: string;
}

/** Ready-made avatars: plain emoji on a colored circle */
export const AVATARS: AvatarDef[] = [
  { id: 'fox', emoji: '🦊', bg: '#f4a261' },
  { id: 'panda', emoji: '🐼', bg: '#90a4ae' },
  { id: 'tiger', emoji: '🐯', bg: '#ffb703' },
  { id: 'frog', emoji: '🐸', bg: '#8bc34a' },
  { id: 'owl', emoji: '🦉', bg: '#a1887f' },
  { id: 'octopus', emoji: '🐙', bg: '#f06292' },
  { id: 'unicorn', emoji: '🦄', bg: '#ce93d8' },
  { id: 'turtle', emoji: '🐢', bg: '#4db6ac' },
  { id: 'bee', emoji: '🐝', bg: '#ffd54f' },
  { id: 'lion', emoji: '🦁', bg: '#ff8a65' },
  { id: 'koala', emoji: '🐨', bg: '#b0bec5' },
  { id: 'penguin', emoji: '🐧', bg: '#64b5f6' },
  { id: 'cat', emoji: '🐱', bg: '#ffcc80' },
  { id: 'dog', emoji: '🐶', bg: '#bcaaa4' },
  { id: 'rabbit', emoji: '🐰', bg: '#f8bbd0' },
  { id: 'whale', emoji: '🐳', bg: '#4fc3f7' },
  { id: 'otter', emoji: '🦦', bg: '#c8a27a' },
  { id: 'dragon', emoji: '🐲', bg: '#66bb6a' },
  { id: 'robot', emoji: '🤖', bg: '#9fa8da' },
  { id: 'alien', emoji: '👽', bg: '#aed581' },
  { id: 'ghost', emoji: '👻', bg: '#e0e0e0' },
  { id: 'star', emoji: '⭐', bg: '#5c6bc0' },
  { id: 'rocket', emoji: '🚀', bg: '#7e57c2' },
  { id: 'cactus', emoji: '🌵', bg: '#81c784' },
  { id: 'sunflower', emoji: '🌻', bg: '#4e7d3a' },
  { id: 'mushroom', emoji: '🍄', bg: '#e57373' },
  { id: 'pizza', emoji: '🍕', bg: '#ffab40' },
  { id: 'crown', emoji: '👑', bg: '#8d6e63' },
  { id: 'wizard', emoji: '🧙', bg: '#5e35b1' },
  { id: 'ninja', emoji: '🥷', bg: '#455a64' },
  { id: 'detective', emoji: '🕵️', bg: '#6d4c41' },
];

export const avatarById = (id: string | undefined) => AVATARS.find((a) => a.id === id);

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  /** Your own picture, small JPEG as a data URL. Shown only in private rooms. */
  picture?: string;
  createdAt: number;
}

interface Store {
  profiles: Profile[];
  /** null = playing as a guest */
  current: string | null;
}

const KEY = 'oyun-masasi:profiles';
export const MAX_PROFILES = 8;
/** Largest picture we keep or accept from someone else (data URL length) */
export const MAX_PICTURE = 20000;

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Store;
      if (Array.isArray(s.profiles)) return { profiles: s.profiles, current: s.profiles.some((p) => p.id === s.current) ? s.current : null };
    }
  } catch {
    /* storage unavailable */
  }
  return { profiles: [], current: null };
}

let store = load();
const listeners = new Set<() => void>();

function save(next: Store) {
  store = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* full or unavailable: keep it in memory for now */
  }
  listeners.forEach((fn) => fn());
}

export function useProfiles(): Store {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => store,
  );
}

export function currentProfile(): Profile | null {
  return store.profiles.find((p) => p.id === store.current) ?? null;
}

/** Stats and achievements are kept per profile; guests share one set */
export function statsOwner(): string {
  return store.current ?? 'guest';
}

export function newProfileId() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function saveProfile(p: Profile) {
  const clean: Profile = { ...p, name: p.name.trim().slice(0, 20) || 'Player', picture: p.picture && p.picture.length <= MAX_PICTURE ? p.picture : undefined };
  const exists = store.profiles.some((x) => x.id === p.id);
  const profiles = exists ? store.profiles.map((x) => (x.id === p.id ? clean : x)) : [...store.profiles, clean].slice(0, MAX_PROFILES);
  save({ profiles, current: clean.id });
  // The name is what other players see online
  if (getSettings().name !== clean.name) updateSettings({ name: clean.name });
}

export function switchProfile(id: string | null) {
  save({ ...store, current: id });
  const p = currentProfile();
  if (p) updateSettings({ name: p.name });
}

export function deleteProfile(id: string) {
  save({ profiles: store.profiles.filter((p) => p.id !== id), current: store.current === id ? null : store.current });
  try {
    localStorage.removeItem('oyun-masasi:stats:' + id);
  } catch {
    /* ignore */
  }
}

/** What goes with your seat when you play: avatar always, picture only where it's allowed */
export function myLook(allowPicture: boolean): { avatar?: string; picture?: string } {
  const p = currentProfile();
  if (!p) return {};
  return { avatar: p.avatar, picture: allowPicture ? p.picture : undefined };
}

/** Shrinks a chosen image to a small square JPEG */
export function resizePicture(file: File, size = 96): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Choose a picture file.'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d')!;
      // Crop the middle square
      const s = Math.min(img.width, img.height);
      g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      let q = 0.8;
      let out = c.toDataURL('image/jpeg', q);
      while (out.length > MAX_PICTURE && q > 0.3) {
        q -= 0.15;
        out = c.toDataURL('image/jpeg', q);
      }
      if (out.length > MAX_PICTURE) reject(new Error('That picture is too detailed. Try another one.'));
      else resolve(out);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That picture could not be opened.'));
    };
    img.src = url;
  });
}

/** A picture someone else sent us is only used if it really is a small JPEG/PNG data URL */
export function isSafePicture(p: unknown): p is string {
  return typeof p === 'string' && p.length <= MAX_PICTURE && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p);
}

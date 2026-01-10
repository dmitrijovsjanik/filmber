'use client';

import { create } from 'zustand';
import type { UserSlot } from '@/types/room';

interface RoomState {
  // Room info
  roomCode: string | null;
  pin: string | null;
  userSlot: UserSlot | null;
  moviePoolSeed: number | null;

  // Solo mode
  isSoloMode: boolean;

  // Connection state
  isConnected: boolean;
  isPartnerConnected: boolean;
  isRoomReady: boolean;

  // Match state
  isMatchFound: boolean;
  matchedMovieId: number | null;

  // Partner progress
  partnerSwipeCount: number;

  // Actions
  setRoom: (code: string, pin: string, slot: UserSlot, seed: number) => void;
  setSoloMode: (seed: number) => void;
  setConnected: (connected: boolean) => void;
  setPartnerConnected: (connected: boolean) => void;
  setRoomReady: (ready: boolean) => void;
  setMatchFound: (found: boolean) => void;
  setMatchedMovieId: (id: number | null) => void;
  setPartnerSwipeCount: (count: number) => void;
  reset: () => void;
}

const initialState = {
  roomCode: null,
  pin: null,
  userSlot: null,
  moviePoolSeed: null,
  isSoloMode: false,
  isConnected: false,
  isPartnerConnected: false,
  isRoomReady: false,
  isMatchFound: false,
  matchedMovieId: null,
  partnerSwipeCount: 0,
};

export const useRoomStore = create<RoomState>()((set) => ({
  ...initialState,

  setRoom: (code, pin, slot, seed) =>
    set({
      roomCode: code,
      pin,
      userSlot: slot,
      moviePoolSeed: seed,
      isSoloMode: false,
    }),

  setSoloMode: (seed) =>
    set({
      moviePoolSeed: seed,
      isSoloMode: true,
      roomCode: null,
      pin: null,
      userSlot: null,
    }),

  setConnected: (connected) => set({ isConnected: connected }),
  setPartnerConnected: (connected) => set({ isPartnerConnected: connected }),
  setRoomReady: (ready) => set({ isRoomReady: ready }),
  setMatchFound: (found) => set({ isMatchFound: found }),
  setMatchedMovieId: (id) => set({ matchedMovieId: id }),
  setPartnerSwipeCount: (count) => set({ partnerSwipeCount: count }),

  reset: () => set(initialState),
}));

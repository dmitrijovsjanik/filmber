import { useRoomStore } from '../roomStore';
import { act } from '@testing-library/react';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('roomStore', () => {
  beforeEach(() => {
    // Reset store and localStorage before each test
    localStorageMock.clear();
    act(() => {
      useRoomStore.getState().reset();
    });
  });

  describe('setSoloMode', () => {
    it('should set solo mode with seed', () => {
      act(() => {
        useRoomStore.getState().setSoloMode(123456);
      });

      const state = useRoomStore.getState();
      expect(state.isSoloMode).toBe(true);
      expect(state.moviePoolSeed).toBe(123456);
    });

    it('should reset match state when starting new solo session', () => {
      // First, simulate a completed session with a match
      act(() => {
        useRoomStore.getState().setSoloMode(111111);
        useRoomStore.getState().setMatchFound(true);
        useRoomStore.getState().setMatchedMovieId(12345);
      });

      // Verify match state is set
      expect(useRoomStore.getState().isMatchFound).toBe(true);
      expect(useRoomStore.getState().matchedMovieId).toBe(12345);

      // Now start a new solo session
      act(() => {
        useRoomStore.getState().setSoloMode(222222);
      });

      // Match state should be reset
      const state = useRoomStore.getState();
      expect(state.isMatchFound).toBe(false);
      expect(state.matchedMovieId).toBe(null);
      expect(state.moviePoolSeed).toBe(222222);
    });

    it('should clear room-related fields when entering solo mode', () => {
      // First set up a pair room
      act(() => {
        useRoomStore.getState().setRoom('ABC123', '123456', 'A', 999999);
      });

      // Now switch to solo mode
      act(() => {
        useRoomStore.getState().setSoloMode(111111);
      });

      const state = useRoomStore.getState();
      expect(state.roomCode).toBe(null);
      expect(state.pin).toBe(null);
      expect(state.userSlot).toBe(null);
      expect(state.isSoloMode).toBe(true);
    });
  });

  describe('setRoom', () => {
    it('should set room data correctly', () => {
      act(() => {
        useRoomStore.getState().setRoom('XYZ789', '654321', 'B', 555555);
      });

      const state = useRoomStore.getState();
      expect(state.roomCode).toBe('XYZ789');
      expect(state.pin).toBe('654321');
      expect(state.userSlot).toBe('B');
      expect(state.moviePoolSeed).toBe(555555);
      expect(state.isSoloMode).toBe(false);
    });

    it('should reset match state when joining new room', () => {
      // Simulate a previous session with a match
      act(() => {
        useRoomStore.getState().setRoom('OLD123', '111111', 'A', 100000);
        useRoomStore.getState().setMatchFound(true);
        useRoomStore.getState().setMatchedMovieId(99999);
      });

      // Verify match state is set
      expect(useRoomStore.getState().isMatchFound).toBe(true);
      expect(useRoomStore.getState().matchedMovieId).toBe(99999);

      // Join a new room
      act(() => {
        useRoomStore.getState().setRoom('NEW456', '222222', 'B', 200000);
      });

      // Match state should be reset
      const state = useRoomStore.getState();
      expect(state.isMatchFound).toBe(false);
      expect(state.matchedMovieId).toBe(null);
      expect(state.roomCode).toBe('NEW456');
    });

    it('should clear solo mode when joining pair room', () => {
      // First be in solo mode
      act(() => {
        useRoomStore.getState().setSoloMode(123456);
      });

      expect(useRoomStore.getState().isSoloMode).toBe(true);

      // Join a pair room
      act(() => {
        useRoomStore.getState().setRoom('PAIR01', '333333', 'A', 300000);
      });

      expect(useRoomStore.getState().isSoloMode).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      // Set up some state
      act(() => {
        useRoomStore.getState().setRoom('TEST01', '444444', 'A', 400000);
        useRoomStore.getState().setConnected(true);
        useRoomStore.getState().setPartnerConnected(true);
        useRoomStore.getState().setRoomReady(true);
        useRoomStore.getState().setMatchFound(true);
        useRoomStore.getState().setMatchedMovieId(77777);
        useRoomStore.getState().setPartnerSwipeCount(10);
      });

      // Reset
      act(() => {
        useRoomStore.getState().reset();
      });

      const state = useRoomStore.getState();
      expect(state.roomCode).toBe(null);
      expect(state.pin).toBe(null);
      expect(state.userSlot).toBe(null);
      expect(state.moviePoolSeed).toBe(null);
      expect(state.isSoloMode).toBe(false);
      expect(state.isConnected).toBe(false);
      expect(state.isPartnerConnected).toBe(false);
      expect(state.isRoomReady).toBe(false);
      expect(state.isMatchFound).toBe(false);
      expect(state.matchedMovieId).toBe(null);
      expect(state.partnerSwipeCount).toBe(0);
    });
  });

  describe('persistence behavior', () => {
    it('should persist match state but reset on new session', () => {
      // This test verifies the bug fix:
      // Previously, isMatchFound persisted and wasn't reset on new session

      // Simulate: User completes a solo session with a match
      act(() => {
        useRoomStore.getState().setSoloMode(111111);
        useRoomStore.getState().setMatchFound(true);
        useRoomStore.getState().setMatchedMovieId(12345);
      });

      // The state persists (simulating localStorage restore)
      const persistedState = useRoomStore.getState();
      expect(persistedState.isMatchFound).toBe(true);

      // User starts a NEW solo session (the fix)
      act(() => {
        useRoomStore.getState().setSoloMode(222222);
      });

      // Bug fix verification: match state should be reset
      const newState = useRoomStore.getState();
      expect(newState.isMatchFound).toBe(false);
      expect(newState.matchedMovieId).toBe(null);
      expect(newState.moviePoolSeed).toBe(222222);
    });
  });
});

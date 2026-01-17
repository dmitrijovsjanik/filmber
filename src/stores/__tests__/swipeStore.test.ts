import { useSwipeStore } from '../swipeStore';
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

describe('swipeStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    act(() => {
      useSwipeStore.getState().reset();
      useSwipeStore.getState().clearAnonymousSwipes();
    });
  });

  describe('addSwipe', () => {
    it('should add movie to swipedMovieIds', () => {
      act(() => {
        useSwipeStore.getState().addSwipe(12345, false);
      });

      expect(useSwipeStore.getState().swipedMovieIds).toContain(12345);
    });

    it('should add movie to likedMovieIds when liked', () => {
      act(() => {
        useSwipeStore.getState().addSwipe(12345, true);
      });

      const state = useSwipeStore.getState();
      expect(state.swipedMovieIds).toContain(12345);
      expect(state.likedMovieIds).toContain(12345);
    });

    it('should not add to likedMovieIds when skipped', () => {
      act(() => {
        useSwipeStore.getState().addSwipe(12345, false);
      });

      const state = useSwipeStore.getState();
      expect(state.swipedMovieIds).toContain(12345);
      expect(state.likedMovieIds).not.toContain(12345);
    });

    it('should track anonymous swipes', () => {
      act(() => {
        useSwipeStore.getState().addSwipe(111, true);
        useSwipeStore.getState().addSwipe(222, false);
      });

      const swipes = useSwipeStore.getState().getAnonymousSwipes();
      expect(swipes).toHaveLength(2);
      expect(swipes[0]).toMatchObject({ movieId: 111, action: 'like' });
      expect(swipes[1]).toMatchObject({ movieId: 222, action: 'skip' });
    });
  });

  describe('hasSwipedMovie', () => {
    it('should return true for swiped movie', () => {
      act(() => {
        useSwipeStore.getState().addSwipe(12345, true);
      });

      expect(useSwipeStore.getState().hasSwipedMovie(12345)).toBe(true);
    });

    it('should return false for unswiped movie', () => {
      expect(useSwipeStore.getState().hasSwipedMovie(99999)).toBe(false);
    });
  });

  describe('hasLikedMovie', () => {
    it('should return true for liked movie', () => {
      act(() => {
        useSwipeStore.getState().addSwipe(12345, true);
      });

      expect(useSwipeStore.getState().hasLikedMovie(12345)).toBe(true);
    });

    it('should return false for skipped movie', () => {
      act(() => {
        useSwipeStore.getState().addSwipe(12345, false);
      });

      expect(useSwipeStore.getState().hasLikedMovie(12345)).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear swipedMovieIds and likedMovieIds', () => {
      act(() => {
        useSwipeStore.getState().addSwipe(111, true);
        useSwipeStore.getState().addSwipe(222, false);
        useSwipeStore.getState().addSwipe(333, true);
      });

      expect(useSwipeStore.getState().swipedMovieIds).toHaveLength(3);
      expect(useSwipeStore.getState().likedMovieIds).toHaveLength(2);

      act(() => {
        useSwipeStore.getState().reset();
      });

      const state = useSwipeStore.getState();
      expect(state.swipedMovieIds).toHaveLength(0);
      expect(state.likedMovieIds).toHaveLength(0);
    });

    it('should preserve anonymousSwipes on reset (for potential import)', () => {
      act(() => {
        useSwipeStore.getState().addSwipe(111, true);
        useSwipeStore.getState().addSwipe(222, false);
      });

      act(() => {
        useSwipeStore.getState().reset();
      });

      // Anonymous swipes should be preserved
      const swipes = useSwipeStore.getState().getAnonymousSwipes();
      expect(swipes).toHaveLength(2);
    });
  });

  describe('clearAnonymousSwipes', () => {
    it('should clear all anonymous swipes', () => {
      act(() => {
        useSwipeStore.getState().addSwipe(111, true);
        useSwipeStore.getState().addSwipe(222, false);
      });

      expect(useSwipeStore.getState().getAnonymousSwipes()).toHaveLength(2);

      act(() => {
        useSwipeStore.getState().clearAnonymousSwipes();
      });

      expect(useSwipeStore.getState().getAnonymousSwipes()).toHaveLength(0);
    });
  });

  describe('session reset workflow', () => {
    it('should properly clear state for new session', () => {
      // Simulate a complete session
      act(() => {
        useSwipeStore.getState().addSwipe(100, true);
        useSwipeStore.getState().addSwipe(200, false);
        useSwipeStore.getState().addSwipe(300, true);
      });

      expect(useSwipeStore.getState().swipedMovieIds).toHaveLength(3);

      // User starts new session - reset is called
      act(() => {
        useSwipeStore.getState().reset();
      });

      // Swipe history should be cleared
      const state = useSwipeStore.getState();
      expect(state.swipedMovieIds).toHaveLength(0);
      expect(state.likedMovieIds).toHaveLength(0);

      // Now new swipes should work fresh
      act(() => {
        useSwipeStore.getState().addSwipe(400, true);
      });

      expect(useSwipeStore.getState().swipedMovieIds).toEqual([400]);
    });
  });
});

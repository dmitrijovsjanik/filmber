import { useQueueStore, QueueItem } from '../queueStore';
import { act } from '@testing-library/react';
import type { Movie } from '@/types/movie';

// Helper to create mock movies
const createMockMovie = (id: number): Movie => ({
  tmdbId: id,
  title: `Movie ${id}`,
  titleRu: null,
  posterUrl: `/poster${id}.jpg`,
  overview: `Overview for movie ${id}`,
  overviewRu: null,
  releaseDate: '2024-01-01',
  ratings: {
    tmdb: '7.5',
    imdb: null,
    kinopoisk: null,
    rottenTomatoes: null,
    metacritic: null,
  },
  genres: ['Action', 'Adventure'],
  runtime: 120,
  mediaType: 'movie',
  numberOfSeasons: null,
  numberOfEpisodes: null,
});

// Helper to create queue items
const createQueueItem = (id: number, source: 'priority' | 'base' | 'partner_like' = 'base'): QueueItem => ({
  movie: createMockMovie(id),
  source,
});

describe('queueStore', () => {
  beforeEach(() => {
    act(() => {
      useQueueStore.getState().reset();
    });
  });

  describe('initializeQueue', () => {
    it('should initialize queue with items and meta', () => {
      const items = [createQueueItem(1), createQueueItem(2), createQueueItem(3)];
      const meta = {
        priorityQueueRemaining: 0,
        basePoolRemaining: 100,
        totalRemaining: 100,
        hasMore: true,
      };

      act(() => {
        useQueueStore.getState().initializeQueue('ABC123', 'A', items, meta);
      });

      const state = useQueueStore.getState();
      expect(state.roomCode).toBe('ABC123');
      expect(state.userSlot).toBe('A');
      expect(state.queue).toHaveLength(3);
      expect(state.currentIndex).toBe(0);
      expect(state.isInitialized).toBe(true);
      expect(state.meta).toEqual(meta);
    });
  });

  describe('consumeNext', () => {
    it('should increment currentIndex', () => {
      const items = [createQueueItem(1), createQueueItem(2), createQueueItem(3)];
      const meta = { priorityQueueRemaining: 0, basePoolRemaining: 100, totalRemaining: 100, hasMore: true };

      act(() => {
        useQueueStore.getState().initializeQueue('ABC123', 'A', items, meta);
      });

      expect(useQueueStore.getState().currentIndex).toBe(0);

      act(() => {
        useQueueStore.getState().consumeNext();
      });

      expect(useQueueStore.getState().currentIndex).toBe(1);

      act(() => {
        useQueueStore.getState().consumeNext();
      });

      expect(useQueueStore.getState().currentIndex).toBe(2);
    });
  });

  describe('getCurrentMovie', () => {
    it('should return current movie at currentIndex', () => {
      const items = [createQueueItem(100), createQueueItem(200), createQueueItem(300)];
      const meta = { priorityQueueRemaining: 0, basePoolRemaining: 100, totalRemaining: 100, hasMore: true };

      act(() => {
        useQueueStore.getState().initializeQueue('ABC123', 'A', items, meta);
      });

      expect(useQueueStore.getState().getCurrentMovie()?.movie.tmdbId).toBe(100);

      act(() => {
        useQueueStore.getState().consumeNext();
      });

      expect(useQueueStore.getState().getCurrentMovie()?.movie.tmdbId).toBe(200);
    });

    it('should return null when queue is empty', () => {
      expect(useQueueStore.getState().getCurrentMovie()).toBe(null);
    });
  });

  describe('getVisibleMovies', () => {
    it('should return specified number of movies from current position', () => {
      const items = [
        createQueueItem(1),
        createQueueItem(2),
        createQueueItem(3),
        createQueueItem(4),
        createQueueItem(5),
      ];
      const meta = { priorityQueueRemaining: 0, basePoolRemaining: 100, totalRemaining: 100, hasMore: true };

      act(() => {
        useQueueStore.getState().initializeQueue('ABC123', 'A', items, meta);
      });

      const visible = useQueueStore.getState().getVisibleMovies(3);
      expect(visible).toHaveLength(3);
      expect(visible[0].movie.tmdbId).toBe(1);
      expect(visible[1].movie.tmdbId).toBe(2);
      expect(visible[2].movie.tmdbId).toBe(3);
    });

    it('should update visible movies after consuming', () => {
      const items = [
        createQueueItem(1),
        createQueueItem(2),
        createQueueItem(3),
        createQueueItem(4),
      ];
      const meta = { priorityQueueRemaining: 0, basePoolRemaining: 100, totalRemaining: 100, hasMore: true };

      act(() => {
        useQueueStore.getState().initializeQueue('ABC123', 'A', items, meta);
        useQueueStore.getState().consumeNext();
      });

      const visible = useQueueStore.getState().getVisibleMovies(3);
      expect(visible[0].movie.tmdbId).toBe(2);
      expect(visible[1].movie.tmdbId).toBe(3);
      expect(visible[2].movie.tmdbId).toBe(4);
    });
  });

  describe('injectPartnerLike', () => {
    it('should inject partner like after visible cards', () => {
      const items = [
        createQueueItem(1),
        createQueueItem(2),
        createQueueItem(3),
        createQueueItem(4),
        createQueueItem(5),
      ];
      const meta = { priorityQueueRemaining: 0, basePoolRemaining: 100, totalRemaining: 100, hasMore: true };

      act(() => {
        useQueueStore.getState().initializeQueue('ABC123', 'A', items, meta);
      });

      const partnerMovie = createMockMovie(999);
      act(() => {
        useQueueStore.getState().injectPartnerLike(partnerMovie);
      });

      const state = useQueueStore.getState();
      expect(state.queue).toHaveLength(6);
      // Partner like should be inserted at position 4 (after 3 visible cards)
      expect(state.queue[4].movie.tmdbId).toBe(999);
      expect(state.queue[4].source).toBe('partner_like');
    });

    it('should not inject duplicate movies', () => {
      const items = [createQueueItem(1), createQueueItem(2)];
      const meta = { priorityQueueRemaining: 0, basePoolRemaining: 100, totalRemaining: 100, hasMore: true };

      act(() => {
        useQueueStore.getState().initializeQueue('ABC123', 'A', items, meta);
      });

      const existingMovie = createMockMovie(1); // Same as first movie
      act(() => {
        useQueueStore.getState().injectPartnerLike(existingMovie);
      });

      expect(useQueueStore.getState().queue).toHaveLength(2);
    });

    it('should defer injection during animation', () => {
      const items = [createQueueItem(1), createQueueItem(2)];
      const meta = { priorityQueueRemaining: 0, basePoolRemaining: 100, totalRemaining: 100, hasMore: true };

      act(() => {
        useQueueStore.getState().initializeQueue('ABC123', 'A', items, meta);
        useQueueStore.getState().setAnimating(true);
      });

      const partnerMovie = createMockMovie(999);
      act(() => {
        useQueueStore.getState().injectPartnerLike(partnerMovie);
      });

      // Should be in pending, not in queue
      const state = useQueueStore.getState();
      expect(state.queue).toHaveLength(2);
      expect(state.pendingPartnerLikes).toHaveLength(1);
      expect(state.pendingPartnerLikes[0].tmdbId).toBe(999);
    });
  });

  describe('processPendingLikes', () => {
    it('should process pending likes after animation ends', () => {
      const items = [createQueueItem(1), createQueueItem(2)];
      const meta = { priorityQueueRemaining: 0, basePoolRemaining: 100, totalRemaining: 100, hasMore: true };

      act(() => {
        useQueueStore.getState().initializeQueue('ABC123', 'A', items, meta);
        useQueueStore.getState().setAnimating(true);
      });

      // Inject during animation
      const partnerMovie = createMockMovie(999);
      act(() => {
        useQueueStore.getState().injectPartnerLike(partnerMovie);
      });

      expect(useQueueStore.getState().pendingPartnerLikes).toHaveLength(1);

      // End animation and process
      act(() => {
        useQueueStore.getState().setAnimating(false);
        useQueueStore.getState().processPendingLikes();
      });

      const state = useQueueStore.getState();
      expect(state.pendingPartnerLikes).toHaveLength(0);
      expect(state.queue).toHaveLength(3);
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      const items = [createQueueItem(1), createQueueItem(2)];
      const meta = { priorityQueueRemaining: 0, basePoolRemaining: 100, totalRemaining: 100, hasMore: true };

      act(() => {
        useQueueStore.getState().initializeQueue('ABC123', 'A', items, meta);
        useQueueStore.getState().consumeNext();
        useQueueStore.getState().setAnimating(true);
      });

      act(() => {
        useQueueStore.getState().reset();
      });

      const state = useQueueStore.getState();
      expect(state.queue).toHaveLength(0);
      expect(state.currentIndex).toBe(0);
      expect(state.roomCode).toBe(null);
      expect(state.userSlot).toBe(null);
      expect(state.isInitialized).toBe(false);
      expect(state.isAnimating).toBe(false);
      expect(state.meta).toBe(null);
    });
  });

  describe('shouldFetchMore', () => {
    it('should return true when remaining items are below threshold', () => {
      const items = [
        createQueueItem(1),
        createQueueItem(2),
        createQueueItem(3),
        createQueueItem(4),
        createQueueItem(5),
      ];
      const meta = { priorityQueueRemaining: 0, basePoolRemaining: 100, totalRemaining: 100, hasMore: true };

      act(() => {
        useQueueStore.getState().initializeQueue('ABC123', 'A', items, meta);
        // Consume until 5 remaining (exactly at threshold)
        // With 5 items and currentIndex 0, remaining = 5
      });

      // At threshold, should fetch
      expect(useQueueStore.getState().shouldFetchMore()).toBe(true);
    });

    it('should return false when hasMore is false', () => {
      const items = [createQueueItem(1), createQueueItem(2)];
      const meta = { priorityQueueRemaining: 0, basePoolRemaining: 0, totalRemaining: 0, hasMore: false };

      act(() => {
        useQueueStore.getState().initializeQueue('ABC123', 'A', items, meta);
      });

      expect(useQueueStore.getState().shouldFetchMore()).toBe(false);
    });

    it('should return false when already fetching', () => {
      const items = [createQueueItem(1), createQueueItem(2)];
      const meta = { priorityQueueRemaining: 0, basePoolRemaining: 100, totalRemaining: 100, hasMore: true };

      act(() => {
        useQueueStore.getState().initializeQueue('ABC123', 'A', items, meta);
        useQueueStore.getState().setFetchingMore(true);
      });

      expect(useQueueStore.getState().shouldFetchMore()).toBe(false);
    });
  });

  describe('session reset workflow', () => {
    it('should properly clear queue for new session', () => {
      // Simulate a complete session
      const items = [createQueueItem(1), createQueueItem(2), createQueueItem(3)];
      const meta = { priorityQueueRemaining: 0, basePoolRemaining: 100, totalRemaining: 100, hasMore: true };

      act(() => {
        useQueueStore.getState().initializeQueue('OLD123', 'A', items, meta);
        useQueueStore.getState().consumeNext();
        useQueueStore.getState().consumeNext();
      });

      expect(useQueueStore.getState().currentIndex).toBe(2);

      // User starts new session - reset is called
      act(() => {
        useQueueStore.getState().reset();
      });

      // Queue should be completely cleared
      const state = useQueueStore.getState();
      expect(state.queue).toHaveLength(0);
      expect(state.currentIndex).toBe(0);
      expect(state.isInitialized).toBe(false);
      expect(state.roomCode).toBe(null);

      // Now a new session can be initialized fresh
      const newItems = [createQueueItem(100), createQueueItem(200)];
      act(() => {
        useQueueStore.getState().initializeQueue('NEW456', 'B', newItems, meta);
      });

      expect(useQueueStore.getState().roomCode).toBe('NEW456');
      expect(useQueueStore.getState().queue[0].movie.tmdbId).toBe(100);
    });
  });
});

# State Management (Zustand)

## Existing Stores

| Store | Purpose | Persisted |
|-------|---------|-----------|
| `authStore` | User authentication state | Yes |
| `roomStore` | Room/pair session state | No |
| `swipeStore` | Swipe progress tracking | No |
| `queueStore` | Movie queue for swiping | No |
| `listStore` | User's saved movies | Yes |
| `deckSettingsStore` | Deck filter preferences | Yes |
| `referralStore` | Referral data | Yes |
| `consentStore` | Cookie consent state | Yes |

---

## Store Pattern Template

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FeatureState {
  // State
  data: DataType | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setData: (data: DataType) => void;
  fetchData: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  data: null,
  isLoading: false,
  error: null
};

export const useFeatureStore = create<FeatureState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setData: (data) => set({ data }),

      fetchData: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch('/api/feature');
          if (!response.ok) throw new Error('Failed to fetch');
          const data = await response.json();
          set({ data, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Unknown error',
            isLoading: false
          });
        }
      },

      reset: () => set(initialState)
    }),
    { name: 'feature-storage' }
  )
);
```

---

## Store Without Persistence

```typescript
import { create } from 'zustand';

interface SessionState {
  roomCode: string | null;
  partner: User | null;
  setRoom: (code: string) => void;
  setPartner: (user: User) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  roomCode: null,
  partner: null,
  setRoom: (code) => set({ roomCode: code }),
  setPartner: (user) => set({ partner: user }),
  clearSession: () => set({ roomCode: null, partner: null })
}));
```

---

## Selectors Pattern

Create custom hooks for optimized selectors:

```typescript
// src/hooks/useFeatureSelectors.ts
import { useFeatureStore } from '@/stores/featureStore';
import { shallow } from 'zustand/shallow';

export const useFeatureData = () =>
  useFeatureStore((state) => state.data);

export const useFeatureLoading = () =>
  useFeatureStore((state) => state.isLoading);

export const useFeatureActions = () =>
  useFeatureStore(
    (state) => ({
      setData: state.setData,
      fetchData: state.fetchData,
      reset: state.reset
    }),
    shallow
  );
```

---

## Memory Management Patterns

### Context Storage
```typescript
// Store project-specific context
const memoryPatterns = {
  "filmber/frontend/state": "Zustand stores with persist middleware",
  "filmber/backend/auth": "Telegram HMAC-SHA256 + JWT sessions",
  "filmber/database/schema": "PostgreSQL with Drizzle ORM migrations",
  "filmber/styling/system": "Tailwind CSS + Framer Motion animations",
  "filmber/testing/strategy": "Jest + RTL for components, API route tests",
  "filmber/deployment/strategy": "GitHub Actions → VPS with PM2"
};
```

### Decision Tracking
```typescript
// Track architectural decisions
const decisions = {
  state_management: {
    decision: "Zustand",
    rationale: "Lightweight, TypeScript-first, persist middleware",
    alternatives: ["Redux Toolkit", "Jotai", "Context API"]
  },
  database: {
    decision: "PostgreSQL + Drizzle",
    rationale: "Type-safe ORM, great migrations, SQL-first approach",
    alternatives: ["Prisma", "TypeORM", "Knex"]
  },
  realtime: {
    decision: "Socket.io",
    rationale: "Mature, reliable, good React integration",
    alternatives: ["Pusher", "Ably", "WebSocket API"]
  },
  styling: {
    decision: "Tailwind + Framer Motion",
    rationale: "Utility-first CSS, smooth animations for swipe UX",
    alternatives: ["styled-components", "CSS Modules", "Emotion"]
  }
};
```

---

## Store Integration with Socket.io

```typescript
// Example: Sync swipe progress via WebSocket
import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

interface SwipeState {
  progress: Record<number, 'like' | 'skip'>;
  socket: Socket | null;
  initSocket: (roomCode: string) => void;
  recordSwipe: (movieId: number, action: 'like' | 'skip') => void;
}

export const useSwipeStore = create<SwipeState>((set, get) => ({
  progress: {},
  socket: null,

  initSocket: (roomCode) => {
    const socket = io('/swipe', { query: { roomCode } });

    socket.on('swipe_progress', (data) => {
      set((state) => ({
        progress: { ...state.progress, ...data }
      }));
    });

    set({ socket });
  },

  recordSwipe: (movieId, action) => {
    const { socket, progress } = get();
    set({ progress: { ...progress, [movieId]: action } });
    socket?.emit('swipe', { movieId, action });
  }
}));
```

---

## Best Practices

1. **Always define initial state separately** for easy reset
2. **Use TypeScript interfaces** for type safety
3. **Implement reset function** for cleanup
4. **Use `shallow` comparison** for object selectors
5. **Persist only necessary data** (not loading states)
6. **Handle errors gracefully** in async actions
7. **Use optimistic updates** for better UX

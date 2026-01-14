# Real-time Features (Socket.io)

## Events Reference

| Event | Direction | Purpose |
|-------|-----------|---------|
| `join_room` | Client → Server | User joins room |
| `leave_room` | Client → Server | User leaves room |
| `swipe` | Client → Server | User swipes on movie |
| `user_joined` | Server → Client | Partner joined notification |
| `swipe_progress` | Server → Client | Sync swipe progress |
| `match_found` | Server → Client | Both users liked same movie |

---

## Server-side Handler Pattern

```typescript
// src/lib/socket/handlers.ts
import { Server, Socket } from 'socket.io';

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join_room', async (data: { roomCode: string; userId: number }) => {
      const { roomCode, userId } = data;

      // Join socket room
      socket.join(roomCode);

      // Notify other users in room
      socket.to(roomCode).emit('user_joined', { userId });

      // Send current room state
      const roomState = await getRoomState(roomCode);
      socket.emit('room_state', roomState);
    });

    socket.on('swipe', async (data: SwipeData) => {
      const { roomCode, movieId, action, userId } = data;

      // Save swipe to database
      await saveSwipe(userId, movieId, action);

      // Broadcast progress to room
      const progress = await getSwipeProgress(roomCode);
      io.to(roomCode).emit('swipe_progress', progress);

      // Check for match
      const match = await checkForMatch(roomCode, movieId);
      if (match) {
        io.to(roomCode).emit('match_found', { movieId, roomCode });
      }
    });

    socket.on('leave_room', (data: { roomCode: string }) => {
      socket.leave(data.roomCode);
      socket.to(data.roomCode).emit('user_left', { socketId: socket.id });
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
}
```

---

## Client-side Hook Pattern

```typescript
// src/hooks/useSocket.ts
import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/authStore';

export function useSocket(roomCode?: string) {
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    if (!roomCode || !user) return;

    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || '', {
      query: { roomCode, userId: user.id },
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected');
      socket.emit('join_room', { roomCode, userId: user.id });
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    return () => {
      socket.emit('leave_room', { roomCode });
      socket.disconnect();
    };
  }, [roomCode, user]);

  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  const on = useCallback((event: string, handler: (data: unknown) => void) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  return { socket: socketRef.current, emit, on };
}
```

---

## Real-time Sync Pattern with Zustand

```typescript
// src/hooks/useRoomSync.ts
import { useEffect } from 'react';
import { useSocket } from './useSocket';
import { useSwipeStore } from '@/stores/swipeStore';
import { useRoomStore } from '@/stores/roomStore';

export function useRoomSync(roomCode: string) {
  const { on } = useSocket(roomCode);
  const { setProgress, addMatch } = useSwipeStore();
  const { setPartner, setRoomState } = useRoomStore();

  useEffect(() => {
    const unsubProgress = on('swipe_progress', (data) => {
      setProgress(data as SwipeProgress);
    });

    const unsubMatch = on('match_found', (data) => {
      const { movieId } = data as { movieId: number };
      addMatch(movieId);
    });

    const unsubJoin = on('user_joined', (data) => {
      const { userId } = data as { userId: number };
      // Fetch partner info
      fetchUser(userId).then(setPartner);
    });

    const unsubState = on('room_state', (data) => {
      setRoomState(data as RoomState);
    });

    return () => {
      unsubProgress();
      unsubMatch();
      unsubJoin();
      unsubState();
    };
  }, [on, setProgress, addMatch, setPartner, setRoomState]);
}
```

---

## Optimistic Updates Pattern

```typescript
// Swipe with optimistic update
export function useSwipeAction(roomCode: string) {
  const { emit } = useSocket(roomCode);
  const { progress, setProgress } = useSwipeStore();
  const { user } = useAuthStore();

  const swipe = useCallback(async (movieId: number, action: 'like' | 'skip') => {
    // Optimistic update
    setProgress({
      ...progress,
      [movieId]: { action, userId: user?.id }
    });

    // Emit to server
    emit('swipe', {
      roomCode,
      movieId,
      action,
      userId: user?.id
    });
  }, [emit, roomCode, progress, setProgress, user]);

  return { swipe };
}
```

---

## Connection State Management

```typescript
// src/hooks/useConnectionState.ts
import { useState, useEffect } from 'react';
import { useSocket } from './useSocket';

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export function useConnectionState(roomCode: string) {
  const [state, setState] = useState<ConnectionState>('connecting');
  const { socket } = useSocket(roomCode);

  useEffect(() => {
    if (!socket) return;

    const onConnect = () => setState('connected');
    const onDisconnect = () => setState('disconnected');
    const onError = () => setState('error');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onError);
    };
  }, [socket]);

  return state;
}
```

---

## Reconnection Handling

```typescript
// Socket.io client with reconnection
const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000
});

// Handle reconnection
socket.on('reconnect', (attemptNumber) => {
  console.log(`Reconnected after ${attemptNumber} attempts`);
  // Re-join room after reconnection
  socket.emit('join_room', { roomCode, userId });
});

socket.on('reconnect_failed', () => {
  console.error('Failed to reconnect');
  // Show user notification
});
```

---

## Best Practices

1. **Always clean up listeners** in useEffect return
2. **Use optimistic updates** for better UX
3. **Handle connection errors** gracefully
4. **Implement reconnection logic** for dropped connections
5. **Validate data** on both client and server
6. **Use rooms** for scoped broadcasts
7. **Debounce rapid events** if necessary

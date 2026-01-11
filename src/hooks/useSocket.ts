'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRoomStore } from '@/stores/roomStore';
import { useQueueStore } from '@/stores/queueStore';
import type { ClientToServerEvents, ServerToClientEvents } from '@/types/socket';
import type { UserSlot, SwipeAction } from '@/types/room';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Singleton socket instance to survive React Strict Mode remounts
let globalSocket: TypedSocket | null = null;
let globalRoomCode: string | null = null;
let globalUserSlot: UserSlot | null = null;

export function useSocket(roomCode: string | null, userSlot: UserSlot | null) {
  const socketRef = useRef<TypedSocket | null>(null);
  const {
    setConnected,
    setPartnerConnected,
    setRoomReady,
    setMatchFound,
    setMatchedMovieId,
    setPartnerSwipeCount,
  } = useRoomStore();

  useEffect(() => {
    if (!roomCode || !userSlot) return;

    // Reuse existing socket if it's for the same room
    if (globalSocket && globalRoomCode === roomCode && globalUserSlot === userSlot) {
      socketRef.current = globalSocket;
      if (globalSocket.connected) {
        setConnected(true);
      }
      return;
    }

    // Disconnect old socket if switching rooms
    if (globalSocket) {
      globalSocket.disconnect();
      globalSocket = null;
    }

    // Initialize socket connection
    const socket = io({
      path: '/api/socket',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    globalSocket = socket;
    globalRoomCode = roomCode;
    globalUserSlot = userSlot;
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join_room', { roomCode, userSlot });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('user_joined', ({ userSlot: joinedSlot }) => {
      if (joinedSlot !== userSlot) {
        setPartnerConnected(true);
      }
    });

    socket.on('user_left', ({ userSlot: leftSlot }) => {
      if (leftSlot !== userSlot) {
        setPartnerConnected(false);
      }
    });

    socket.on('room_ready', () => {
      setRoomReady(true);
    });

    socket.on('swipe_progress', ({ userSlot: swipedSlot, totalSwiped }) => {
      if (swipedSlot !== userSlot) {
        setPartnerSwipeCount(totalSwiped);
      }
    });

    socket.on('match_found', ({ movieId }) => {
      setMatchFound(true);
      setMatchedMovieId(movieId);
    });

    socket.on('room_expired', () => {
      // Handle room expiration
    });

    socket.on('partner_liked', ({ movie }) => {
      // Inject partner's liked movie into queue
      const { injectPartnerLike } = useQueueStore.getState();
      injectPartnerLike(movie);
    });

    socket.on('error', ({ message }) => {
      console.error('Socket error:', message);
    });

    // Cleanup only on actual unmount, not on Strict Mode remount
    return () => {
      // Don't disconnect immediately - let it persist
      // Socket will be disconnected when switching rooms or on page unload
    };
  }, [
    roomCode,
    userSlot,
    setConnected,
    setPartnerConnected,
    setRoomReady,
    setMatchFound,
    setMatchedMovieId,
    setPartnerSwipeCount,
  ]);

  // Cleanup on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (globalSocket && globalRoomCode && globalUserSlot) {
        globalSocket.emit('leave_room', { roomCode: globalRoomCode, userSlot: globalUserSlot });
        globalSocket.disconnect();
        globalSocket = null;
        globalRoomCode = null;
        globalUserSlot = null;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const emitSwipe = useCallback(
    (movieId: number, action: SwipeAction) => {
      if (!roomCode || !userSlot) return;
      socketRef.current?.emit('swipe', {
        roomCode,
        movieId,
        action,
        userSlot,
      });
    },
    [roomCode, userSlot]
  );

  // Function to manually disconnect (call when leaving room)
  const disconnect = useCallback(() => {
    if (globalSocket && globalRoomCode && globalUserSlot) {
      globalSocket.emit('leave_room', { roomCode: globalRoomCode, userSlot: globalUserSlot });
      globalSocket.disconnect();
      globalSocket = null;
      globalRoomCode = null;
      globalUserSlot = null;
    }
  }, []);

  return { emitSwipe, disconnect };
}

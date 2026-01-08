import type { UserSlot, SwipeAction } from './room';

// Client → Server events
export interface ClientToServerEvents {
  join_room: (payload: JoinRoomPayload) => void;
  swipe: (payload: SwipePayload) => void;
  leave_room: (payload: LeaveRoomPayload) => void;
}

// Server → Client events
export interface ServerToClientEvents {
  user_joined: (payload: UserJoinedPayload) => void;
  user_left: (payload: UserLeftPayload) => void;
  room_ready: (payload: RoomReadyPayload) => void;
  swipe_progress: (payload: SwipeProgressPayload) => void;
  match_found: (payload: MatchFoundPayload) => void;
  room_expired: () => void;
  error: (payload: ErrorPayload) => void;
}

// Payload types
export interface JoinRoomPayload {
  roomCode: string;
  userSlot: UserSlot;
}

export interface SwipePayload {
  roomCode: string;
  movieId: number;
  action: SwipeAction;
  userSlot: UserSlot;
}

export interface LeaveRoomPayload {
  roomCode: string;
  userSlot: UserSlot;
}

export interface UserJoinedPayload {
  userSlot: UserSlot;
}

export interface UserLeftPayload {
  userSlot: UserSlot;
}

export interface RoomReadyPayload {
  roomCode: string;
}

export interface SwipeProgressPayload {
  userSlot: UserSlot;
  totalSwiped: number;
}

export interface MatchFoundPayload {
  movieId: number;
}

export interface ErrorPayload {
  message: string;
}

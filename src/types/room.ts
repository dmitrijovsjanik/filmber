export type UserSlot = 'A' | 'B';
export type RoomStatus = 'waiting' | 'active' | 'matched' | 'expired';
export type SwipeAction = 'like' | 'skip';

export interface RoomInfo {
  roomCode: string;
  pin: string;
  shareUrl: string;
}

export interface JoinRoomResponse {
  roomCode: string;
  userSlot: UserSlot;
  moviePoolSeed: number;
}

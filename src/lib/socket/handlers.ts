import { Server, Socket } from 'socket.io';
import { db } from '../db';
import { rooms, swipes, movies, userMovieLists, MOVIE_STATUS } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { enhanceMovieData } from '../api/moviePool';
import { TMDBClient } from '../api/tmdb';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  JoinRoomPayload,
  SwipePayload,
  LeaveRoomPayload,
} from '@/types/socket';
import type { Movie } from '@/types/movie';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

// Track user connections for disconnect handling
const userConnections = new Map<string, { roomCode: string; userSlot: 'A' | 'B' }>();

export function setupSocketHandlers(io: TypedServer) {
  io.on('connection', (socket: TypedSocket) => {
    console.log('Client connected:', socket.id);

    // Join room
    socket.on('join_room', async (payload: JoinRoomPayload) => {
      const { roomCode, userSlot } = payload;

      try {
        // Verify room exists first
        const [room] = await db
          .select()
          .from(rooms)
          .where(eq(rooms.code, roomCode));

        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        // Join Socket.io room
        socket.join(roomCode);

        // Track connection for disconnect handling
        userConnections.set(socket.id, { roomCode, userSlot });

        // Update database
        const updateField =
          userSlot === 'A'
            ? { userAConnected: true }
            : { userBConnected: true };

        await db
          .update(rooms)
          .set(updateField)
          .where(eq(rooms.code, roomCode));

        // Notify room members
        io.to(roomCode).emit('user_joined', { userSlot });

        // Check if joining user is authenticated and notify partner
        const joiningUserId = userSlot === 'A' ? room.userAId : room.userBId;
        if (joiningUserId) {
          // Check if user has items in their watchlist
          const watchlistCount = await db
            .select()
            .from(userMovieLists)
            .where(
              and(
                eq(userMovieLists.userId, joiningUserId),
                inArray(userMovieLists.status, [
                  MOVIE_STATUS.WANT_TO_WATCH,
                  MOVIE_STATUS.WATCHING,
                ])
              )
            );

          // Notify partner that this user is authenticated (so they can refetch queue)
          socket.to(roomCode).emit('partner_auth_changed', {
            isAuthenticated: true,
            hasWantToWatchList: watchlistCount.length > 0,
          });
        }

        // Check if both users are connected
        const [updatedRoom] = await db
          .select()
          .from(rooms)
          .where(eq(rooms.code, roomCode));

        if (updatedRoom?.userAConnected && updatedRoom?.userBConnected) {
          // Update room status to active
          await db
            .update(rooms)
            .set({ status: 'active' })
            .where(eq(rooms.code, roomCode));

          io.to(roomCode).emit('room_ready', { roomCode });
        }
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Handle swipe action
    socket.on('swipe', async (payload: SwipePayload) => {
      const { roomCode, movieId, action, userSlot } = payload;

      try {
        // Get room
        const [room] = await db
          .select()
          .from(rooms)
          .where(eq(rooms.code, roomCode));

        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        if (room.status === 'matched' || room.status === 'expired') {
          return;
        }

        // Record swipe
        await db
          .insert(swipes)
          .values({
            roomId: room.id,
            movieId,
            userSlot,
            action,
          })
          .onConflictDoNothing();

        // Count user's total swipes for progress
        const userSwipes = await db
          .select()
          .from(swipes)
          .where(and(eq(swipes.roomId, room.id), eq(swipes.userSlot, userSlot)));

        // Broadcast swipe progress
        io.to(roomCode).emit('swipe_progress', {
          userSlot,
          totalSwiped: userSwipes.length,
        });

        // Check for match if this is a "like"
        if (action === 'like') {
          const otherSlot = userSlot === 'A' ? 'B' : 'A';
          const partnerId = userSlot === 'A' ? room.userBId : room.userAId;

          // Get movie data to send to partner
          const movie = await getMovieById(movieId);

          // Notify partner to inject this movie into their queue
          if (movie) {
            socket.to(roomCode).emit('partner_liked', { movieId, movie });
          }

          // Check if other user also liked this movie (via swipe)
          const [otherSwipe] = await db
            .select()
            .from(swipes)
            .where(
              and(
                eq(swipes.roomId, room.id),
                eq(swipes.movieId, movieId),
                eq(swipes.userSlot, otherSlot),
                eq(swipes.action, 'like')
              )
            );

          // Check if movie is in partner's watchlist (for instant match)
          let partnerHasInWatchlist = false;
          if (!otherSwipe && partnerId) {
            // First look up the movie to get unifiedMovieId
            const [movieEntry] = await db
              .select({ id: movies.id })
              .from(movies)
              .where(eq(movies.tmdbId, movieId));

            if (movieEntry) {
              const [watchlistEntry] = await db
                .select()
                .from(userMovieLists)
                .where(
                  and(
                    eq(userMovieLists.userId, partnerId),
                    eq(userMovieLists.unifiedMovieId, movieEntry.id),
                    inArray(userMovieLists.status, [
                      MOVIE_STATUS.WANT_TO_WATCH,
                      MOVIE_STATUS.WATCHING,
                    ])
                  )
                );
              partnerHasInWatchlist = !!watchlistEntry;
            }
          }

          if (otherSwipe || partnerHasInWatchlist) {
            // MATCH FOUND!
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes TTL

            await db
              .update(rooms)
              .set({
                status: 'matched',
                matchedMovieId: movieId,
                expiresAt,
              })
              .where(eq(rooms.id, room.id));

            io.to(roomCode).emit('match_found', { movieId });

            // Schedule room expiration
            setTimeout(async () => {
              await db
                .update(rooms)
                .set({ status: 'expired' })
                .where(eq(rooms.id, room.id));

              io.to(roomCode).emit('room_expired');
            }, 5 * 60 * 1000);
          }
        }
      } catch (error) {
        console.error('Error processing swipe:', error);
        socket.emit('error', { message: 'Failed to process swipe' });
      }
    });

    // Handle leave room
    socket.on('leave_room', async (payload: LeaveRoomPayload) => {
      const { roomCode, userSlot } = payload;
      await handleUserLeave(io, roomCode, userSlot);
      socket.leave(roomCode);
      userConnections.delete(socket.id);
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log('Client disconnected:', socket.id);

      const connection = userConnections.get(socket.id);
      if (connection) {
        await handleUserLeave(io, connection.roomCode, connection.userSlot);
        userConnections.delete(socket.id);
      }
    });
  });
}

async function handleUserLeave(
  io: TypedServer,
  roomCode: string,
  userSlot: 'A' | 'B'
) {
  try {
    const updateField =
      userSlot === 'A'
        ? { userAConnected: false }
        : { userBConnected: false };

    await db.update(rooms).set(updateField).where(eq(rooms.code, roomCode));

    io.to(roomCode).emit('user_left', { userSlot });
  } catch (error) {
    console.error('Error handling user leave:', error);
  }
}

async function getMovieById(tmdbId: number): Promise<Movie | null> {
  try {
    // Check movies table first
    const [cached] = await db
      .select()
      .from(movies)
      .where(eq(movies.tmdbId, tmdbId));

    if (cached) {
      return {
        tmdbId: cached.tmdbId!,
        title: cached.title,
        titleRu: cached.titleRu,
        overview: cached.overview || '',
        overviewRu: cached.overviewRu,
        posterUrl: TMDBClient.getSmartPosterUrl(
          cached.localPosterPath,
          cached.posterPath,
          cached.posterUrl
        ),
        releaseDate: cached.releaseDate || '',
        ratings: {
          tmdb: cached.tmdbRating || '0',
          imdb: cached.imdbRating,
          kinopoisk: cached.kinopoiskRating,
          rottenTomatoes: cached.rottenTomatoesRating,
          metacritic: cached.metacriticRating,
        },
        genres: JSON.parse(cached.genres || '[]'),
        runtime: cached.runtime,
        mediaType: (cached.mediaType as 'movie' | 'tv') || 'movie',
        numberOfSeasons: cached.numberOfSeasons,
        numberOfEpisodes: cached.numberOfEpisodes,
      };
    }

    // Fetch and cache if not found
    return enhanceMovieData(tmdbId);
  } catch (error) {
    console.error(`Failed to get movie ${tmdbId}:`, error);
    return null;
  }
}

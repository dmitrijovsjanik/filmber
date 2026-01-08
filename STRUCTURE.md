# Filmber - Project Structure

Real-time movie matching application built with Next.js 16, Socket.io, and PostgreSQL.

## Quick Reference

```
filmber/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── [locale]/           # Localized pages (en, ru)
│   │   └── api/                # REST API routes
│   ├── components/             # React components
│   ├── hooks/                  # Custom React hooks
│   ├── i18n/                   # Internationalization
│   ├── lib/                    # Core libraries
│   │   ├── api/                # External API clients
│   │   ├── db/                 # Database (Drizzle ORM)
│   │   ├── socket/             # WebSocket handlers
│   │   └── utils/              # Utilities
│   ├── stores/                 # Zustand state
│   ├── types/                  # TypeScript types
│   └── middleware.ts           # i18n middleware
├── server/                     # Custom server (Socket.io)
└── public/                     # Static assets
```

---

## Pages & Routes

| Route | File | Purpose |
|-------|------|---------|
| `/[locale]` | `src/app/[locale]/page.tsx` | Home - create/join room |
| `/[locale]/room/[roomCode]` | `src/app/[locale]/room/[roomCode]/page.tsx` | Room info |
| `/[locale]/room/[roomCode]/swipe` | `src/app/[locale]/room/[roomCode]/swipe/page.tsx` | Main swiping UI |

---

## API Routes

| Method | Route | File | Purpose |
|--------|-------|------|---------|
| POST | `/api/rooms` | `src/app/api/rooms/route.ts` | Create new room |
| GET | `/api/rooms/[roomCode]` | `src/app/api/rooms/[roomCode]/route.ts` | Get room info |
| POST | `/api/rooms/[roomCode]/join` | `src/app/api/rooms/[roomCode]/join/route.ts` | Join room |
| GET | `/api/movies` | `src/app/api/movies/route.ts` | Fetch movie pool |

---

## Components

### Movie Components (`src/components/movie/`)
- **MovieCard.tsx** - Draggable movie card with Framer Motion
- **MovieStack.tsx** - Card deck manager, handles swipe logic
- **RatingBadge.tsx** - Rating display badges

### Room Components (`src/components/room/`)
- **ShareLink.tsx** - QR code and share URL display
- **PinInput.tsx** - PIN entry form
- **WaitingRoom.tsx** - Waiting for partner UI
- **MatchFound.tsx** - Match celebration screen

### UI Components (`src/components/ui/`)
- **Button.tsx** - Reusable button
- **Input.tsx** - Reusable input
- **Loader.tsx** - Loading spinner

---

## State Management (Zustand)

### `src/stores/roomStore.ts`
```ts
// Room session state
roomCode, pin, userSlot, moviePoolSeed
isConnected, isPartnerConnected, isRoomReady
isMatchFound, matchedMovieId, partnerSwipeCount
```

### `src/stores/swipeStore.ts`
```ts
// Swipe progress state
currentIndex, swipedMovieIds, likedMovieIds
```

---

## Hooks

### `src/hooks/useSocket.ts`
WebSocket connection manager:
- **Emits:** `join_room`, `swipe`, `leave_room`
- **Listens:** `user_joined`, `user_left`, `room_ready`, `swipe_progress`, `match_found`

---

## Core Libraries

### API Clients (`src/lib/api/`)
- **tmdb.ts** - TMDB API (movies, posters, details)
- **omdb.ts** - OMDB API (additional ratings)
- **moviePool.ts** - Movie pool generation with caching

### Database (`src/lib/db/`)
- **schema.ts** - Tables: `rooms`, `swipes`, `movieCache`
- **index.ts** - Drizzle ORM connection

### Socket (`src/lib/socket/`)
- **handlers.ts** - WebSocket event handlers

### Utilities (`src/lib/utils/`)
- **shuffle.ts** - Seeded deterministic shuffle
- **roomCode.ts** - Room code generator
- **pin.ts** - PIN generator

---

## Types (`src/types/`)

- **room.ts** - `UserSlot`, `RoomStatus`, `SwipeAction`, `RoomInfo`
- **movie.ts** - `Movie`, `MovieRatings`, `TMDBMovie`, `OMDBMovie`
- **socket.ts** - WebSocket event types

---

## i18n (`src/i18n/`)

- **config.ts** - Locales: `['en', 'ru']`, default: `'en'`
- **routing.ts** - next-intl routing config
- **request.ts** - Server-side translation handler

---

## Server

### `server/index.ts`
Custom HTTP server with Socket.io on `/api/socket`

---

## Database Schema

```
rooms
├── id (UUID)
├── code (10-char unique)
├── pin (6-digit)
├── status (waiting|active|matched|expired)
├── userAConnected, userBConnected
├── matchedMovieId
├── moviePoolSeed
└── createdAt, expiresAt

swipes
├── id (UUID)
├── roomId (FK → rooms)
├── movieId
├── userSlot (A|B)
├── action (like|skip)
└── createdAt

movieCache
├── tmdbId (PK)
├── title, titleRu
├── overview, overviewRu
├── posterPath, backdropPath
├── ratings (TMDB, IMDB, RT, Metacritic)
├── genres, runtime
└── cachedAt (24h TTL)
```

---

## Environment Variables

```env
DATABASE_URL=postgresql://...
TMDB_ACCESS_TOKEN=...
OMDB_API_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Scripts

```bash
npm run dev           # Development server with Socket.io
npm run build         # Production build
npm run start         # Production server
npm run db:push       # Push schema to DB
npm run db:studio     # Open Drizzle Studio
npm run services:start # Start Docker (PostgreSQL)
```

---

## Tech Stack

- **Framework:** Next.js 16, React 19
- **Styling:** Tailwind CSS v4
- **State:** Zustand
- **Database:** PostgreSQL, Drizzle ORM
- **Real-time:** Socket.io
- **Animation:** Framer Motion
- **i18n:** next-intl

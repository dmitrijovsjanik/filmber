# Filmber — User Guide

**Filmber** is a collaborative movie matching app that solves the eternal question "What should we watch?" using Tinder-like swiping mechanics.

> Version: 2.6.0
> Platform: Telegram Mini App

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Together Mode (Pair Mode)](#together-mode-pair-mode)
3. [Solo Mode](#solo-mode)
4. [Swipe Interface](#swipe-interface)
5. [My Collection](#my-collection)
6. [Movie Search](#movie-search)
7. [Recommendation Settings](#recommendation-settings)
8. [Notifications](#notifications)
9. [Profile](#profile)
10. [FAQ](#faq)

---

## Quick Start

### How to Open the App

1. Open Telegram
2. Find the bot **@filmberonline_bot**
3. Tap "Open App" button or send `/start` command
4. The app opens as a Telegram Mini App

### First Steps

After launching, you'll see the home screen with two modes:

- **Together** — for collaborative watching with a partner/friend
- **Solo** — for personal movie discovery

---

## Together Mode (Pair Mode)

The perfect way to choose a movie together without arguments.

### How It Works

1. **Create a Room**
   - Tap "Together" on the home screen
   - A room with a unique 6-digit PIN is automatically created

2. **Invite Your Partner**
   - Share the link via Telegram (tap "Share")
   - Or show the QR code for scanning
   - Or simply tell them the PIN code

3. **Wait for Connection**
   - You'll see a waiting animation
   - When your partner joins, a notification appears

4. **Swipe Together**
   - You both see the same movies
   - Swipe right = like
   - Swipe left = skip

5. **Find a Match!**
   - When both like the same movie — it's a Match!
   - A celebration screen with animation appears
   - The movie is automatically added to your collection

### Features

- Room stays active for ~30 minutes
- If one partner leaves, the room persists
- You can return using the same link
- Your favorite movies (rated 3 stars) can appear in your partner's deck

---

## Solo Mode

For personal movie discovery.

### How It Works

1. Tap "Solo" on the home screen
2. Swipe through movie cards
3. Your first liked movie becomes your Match
4. All liked movies are saved to your collection

### When to Use

- Building a watchlist for later
- Exploring new genres
- Preparing a list for your next session with a partner

---

## Swipe Interface

### Movie Card

Each card displays:

- **Poster** — tap for details
- **Title** — in your language
- **Release year**
- **Genres**
- **Ratings** (when available):
  - TMDB
  - IMDb
  - Kinopoisk
  - Rotten Tomatoes

### Controls

| Action | Gesture | Button |
|--------|---------|--------|
| Like | Swipe right | Green button ❤️ |
| Skip | Swipe left | Red button ✕ |
| Details | Tap on card | — |

### Detailed Information

Tapping on a card opens full information:

- Complete plot description
- All available ratings
- Runtime (for movies)
- Season/episode count (for TV series)
- Add to collection buttons

---

## My Collection

Access: bottom navigation → **My Movies**

### Movie Statuses

| Status | Description |
|--------|-------------|
| **Plans** | Want to watch |
| **Watched** | Already seen |
| **Watching** | Currently viewing |

### Rating System

Filmber uses a simple 3-point system:

| Icon | Value | Description |
|------|-------|-------------|
| 😞 | 1 star | Didn't like it |
| 😐 | 2 stars | It was okay |
| 😊 | 3 stars | Loved it! |

> Movies rated 3 stars may appear in your partner's deck in Together mode

### Filtering

- **By status**: All / Plans / Watched
- **By rating**: Any / 1★ / 2★ / 3★

### Movie Actions

- **Add to list** — "+" button on card
- **Rate** — emoji icons
- **Delete** — via card menu
- **Details** — tap on card

---

## Movie Search

Access: search icon on "My Movies" page

### Data Sources

- **TMDB** — primary source (The Movie Database)
- **Kinopoisk** — for Russian content
- **OMDB** — additional source (IMDb)

### Search Filters

| Filter | Options |
|--------|---------|
| **Sort by** | Relevance, popularity, rating, date |
| **Type** | All / Movies only / TV series only |
| **Genres** | Multiple selection |
| **Release year** | Range "from" — "to" |
| **Min rating** | Filter by minimum rating |
| **Original language** | 11 languages (EN, RU, KO, JA, etc.) |
| **Runtime** | Range in minutes |

### Search Tips

- Use multiple filters for precise results
- "Reset" button clears all filters
- Results load as you scroll (infinite scroll)

---

## Recommendation Settings

Access: Profile → **Recommendations** or gear icon on home screen

### Available Settings

| Setting | Description |
|---------|-------------|
| **Show watched movies** | Your favorite movies (3★) will be suggested to your partner |
| **Content type** | All / Movies only / TV series only |

> These settings affect which movies appear in the swipe deck

---

## Notifications

Access: Profile → **Notifications**

### Notification Categories

#### Bot Messages
- **Rating reminders** — after watching a movie

#### New Movies
- **Movie announcements** — about new anticipated movies
- **Theatrical releases** — when movies hit theaters
- **Digital releases** — when movies become available online

#### TV Series
- **New seasons** — for watched series
- **New episodes** — with dubbing delay consideration

#### App Updates
- **What's new** — about new versions and features

### Release Region

Choose your region for release notifications:
- 🇺🇸 USA
- 🇷🇺 Russia

---

## Profile

Access: bottom navigation → **Profile**

### Profile Information

- Telegram avatar
- First and last name
- Username (@username)

### Profile Menu

| Item | Description |
|------|-------------|
| **Language** | Switch EN/RU |
| **Notifications** | Configure notifications |
| **Recommendations** | Deck settings |
| **What's New** | Update history |
| **Support** | Donation link |

---

## FAQ

### General Questions

**Q: Do I need to register?**
A: No, authentication happens automatically through Telegram.

**Q: Is the app free?**
A: Yes, completely free.

**Q: What languages are available?**
A: English and Russian.

### Together Mode

**Q: What if my partner disconnects?**
A: The room persists for ~30 minutes. Your partner can return using the same link.

**Q: Can my partner see what I liked?**
A: No, swipes are hidden until a Match occurs.

**Q: Can I create multiple rooms?**
A: No, one room per user.

### Collection

**Q: Where are my movies stored?**
A: On the server, linked to your Telegram account.

**Q: Is there a limit on saved movies?**
A: No, save as many as you want.

**Q: Can I export my list?**
A: Not yet, but the feature is in development.

### Technical Questions

**Q: Why aren't posters loading?**
A: Check your internet connection. Try reloading the app.

**Q: The app is slow, what should I do?**
A: Close and reopen it. If the problem persists — contact support.

**Q: How do I report a bug?**
A: Message the creator: @ovsjanik on Telegram.

---

## Contact & Support

- **Telegram Bot**: @filmberonline_bot
- **Creator**: @ovsjanik
- **Support the Project**: [Boosty](https://boosty.to/filmber)

---

*© 2025 Filmber. Made with ❤️ for movie lovers.*

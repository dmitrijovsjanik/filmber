# Changelog

All notable changes to Filmber will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.7.0] - 2026-01-15 — Advanced Search Filters

### Added
- Quick filters: content type, original language, genres, rating
- Runtime filter for movies and TV series
- Support for filtering legacy data by genre name

### Changed
- Redesigned filters menu with expandable sections
- Improved filter compatibility with legacy cached data

### Fixed
- Fixed genre filtering for movies from different sources
- Fixed original language filtering
- Fixed hydration error in nested buttons

## [2.6.0] - 2026-01-13 — Smooth Swipe Animations

### Changed
- Smooth card exit animation with rotation when swiping
- Stack depth effect: cards behind are smaller with softer shadows
- Smooth entrance animation for new cards from below

### Fixed
- Fixed card "jittering" when rapidly clicking buttons

## [2.5.0] - 2026-01-13 — What's New Page

### Added
- "What's New" page with update history
- Release titles for easy navigation

### Changed
- Redesigned changelog format for users

## [2.4.0] - 2026-01-13 — TV Series & Optimization

### Added
- TV series support with seasons and episodes info
- Improved image loading for restricted regions

### Changed
- Updated movie card design with new icons
- Improved text readability and UI consistency
- Optimized database performance

### Fixed
- Improved list loading performance
- Fixed minor UI bugs

## [2.3.0] - 2026-01-12 — Similar Movies & Posters

### Added
- "Similar Movies" section on movie page
- Local poster caching for faster loading
- /bug command in bot for reporting issues

### Changed
- Improved watch reminder logic

## [2.2.0] - 2026-01-12 — Alternative Databases

### Added
- Kinopoisk and IMDB ratings on movie cards
- Links to movies on Kinopoisk and IMDB

### Fixed
- Correct display of instant matches
- Fixed clear button in search

## [2.1.0] - 2026-01-12 — Search & Recommendations

### Added
- Language selector for interface
- Support project button
- Chronological sorting for franchise movies

### Changed
- Improved movie search algorithm
- Search now finds movies in both languages

### Fixed
- Correct franchise episode sorting
- Proper handling of Cyrillic "ё" in search

## [2.0.0] - 2026-01-11 — Telegram Bot & New UI

### Added
- Telegram bot for managing lists and receiving notifications
- Queue-based recommendation system
- Deck settings for personalized matching

### Changed
- Completely redesigned interface
- New animated buttons and components

## [1.1.0] - 2026-01-10 — Solo Mode & Analytics

### Added
- Solo mode for individual movie browsing
- Expandable descriptions on movie cards
- Usage analytics

### Fixed
- Improved app stability

## [1.0.0] - 2026-01-08 — Initial Release

### Added
- Pair movie matching with real-time synchronization
- Telegram authentication
- Movie lists with ratings and watch status
- Room system with QR codes and PIN sharing
- Russian and English language support
- Referral system with invite tracking

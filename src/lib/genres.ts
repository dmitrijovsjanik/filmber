// TMDB movie genre translations
// These are the standard TMDB movie genres with Russian translations

export const genreTranslations: Record<string, string> = {
  // Movie genres (EN -> RU)
  'Action': 'Боевик',
  'Adventure': 'Приключения',
  'Animation': 'Мультфильм',
  'Comedy': 'Комедия',
  'Crime': 'Криминал',
  'Documentary': 'Документальный',
  'Drama': 'Драма',
  'Family': 'Семейный',
  'Fantasy': 'Фэнтези',
  'History': 'История',
  'Horror': 'Ужасы',
  'Music': 'Музыка',
  'Mystery': 'Детектив',
  'Romance': 'Мелодрама',
  'Science Fiction': 'Фантастика',
  'TV Movie': 'ТВ фильм',
  'Thriller': 'Триллер',
  'War': 'Военный',
  'Western': 'Вестерн',
  // TV series genres (EN -> RU)
  'Action & Adventure': 'Боевик',
  'Sci-Fi & Fantasy': 'Фантастика',
  'War & Politics': 'Военный',
  'Kids': 'Детский',
  'News': 'Новости',
  'Reality': 'Реалити',
  'Soap': 'Мыльная опера',
  'Talk': 'Ток-шоу',
};

export function translateGenre(genre: string, locale: string): string {
  if (locale === 'ru') {
    return genreTranslations[genre] || genre;
  }
  return genre;
}

export function translateGenres(genres: string[], locale: string): string[] {
  return genres.map(genre => translateGenre(genre, locale));
}

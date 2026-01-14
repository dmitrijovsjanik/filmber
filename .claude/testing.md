# Testing Strategy

## Overview

- Use Jest + React Testing Library
- Test files: `*.test.ts` or `*.test.tsx`
- Run: `npm test`

---

## Coverage Requirements

| Category | Target |
|----------|--------|
| Components | 70%+ |
| Hooks | 80%+ |
| Utils | 90%+ |
| API routes | 60%+ |

---

## Test Patterns

### Component Test Example
```typescript
import { render, screen } from '@testing-library/react';
import { MovieCard } from './MovieCard';

describe('MovieCard', () => {
  it('renders movie title', () => {
    render(<MovieCard movie={mockMovie} />);
    expect(screen.getByText(mockMovie.title)).toBeInTheDocument();
  });
});
```

### Hook Test Example
```typescript
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  it('debounces value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );

    expect(result.current).toBe('initial');

    rerender({ value: 'updated' });
    expect(result.current).toBe('initial'); // Still old value

    await act(async () => {
      await new Promise(r => setTimeout(r, 350));
    });

    expect(result.current).toBe('updated');
  });
});
```

### Store Test Example
```typescript
import { useFeatureStore } from './featureStore';

describe('featureStore', () => {
  beforeEach(() => {
    useFeatureStore.getState().reset();
  });

  it('updates data correctly', () => {
    const { setData } = useFeatureStore.getState();
    setData({ id: 1, name: 'test' });

    expect(useFeatureStore.getState().data).toEqual({ id: 1, name: 'test' });
  });
});
```

---

## Testing Pyramid

```
[BatchTool - Full Test Suite]:
  // Unit Tests (Parallel)
  - Bash("npm run test -- --testPathPattern=utils")
  - Bash("npm run test -- --testPathPattern=hooks")
  - Bash("npm run test -- --testPathPattern=stores")

  // Component Tests (Parallel)
  - Bash("npm run test -- --testPathPattern=components")

  // Integration Tests
  - Bash("npm run test -- --testPathPattern=integration")

  // Coverage Report
  - Bash("npm run test:coverage")
```

---

## Test Organization

```
src/__tests__/
├── components/          # Component tests
│   ├── ui/             # UI primitive tests
│   ├── movie/          # Movie component tests
│   └── room/           # Room component tests
├── hooks/              # Custom hook tests
├── stores/             # Zustand store tests
├── lib/
│   └── utils/          # Utility function tests
└── utils/
    ├── test-utils.tsx  # Test utilities
    └── mocks.ts        # Mock data factories
```

---

## Mock Patterns

### Mock Movie Data
```typescript
export const mockMovie = {
  id: 1,
  tmdbId: 550,
  title: 'Fight Club',
  titleRu: 'Бойцовский клуб',
  overview: 'An insomniac office worker...',
  posterPath: '/poster.jpg',
  releaseDate: '1999-10-15',
  voteAverage: 8.4,
  genres: ['Drama', 'Thriller']
};

export function createMockMovies(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    ...mockMovie,
    id: i + 1,
    tmdbId: 550 + i,
    title: `Movie ${i + 1}`
  }));
}
```

### Mock User Data
```typescript
export const mockUser = {
  id: 1,
  telegramId: '123456789',
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User',
  languageCode: 'en'
};
```

### Mock Socket Events
```typescript
export const mockSocketEvents = {
  join_room: { roomCode: 'ABC123', userId: 1 },
  swipe: { movieId: 550, action: 'like', roomCode: 'ABC123' },
  match_found: { movieId: 550, roomCode: 'ABC123' }
};
```

---

## Test Commands

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# CI mode (no watch, coverage)
npm run test:ci

# Run specific test file
npm test -- MovieCard.test.tsx

# Run tests matching pattern
npm test -- --testPathPattern=stores
```

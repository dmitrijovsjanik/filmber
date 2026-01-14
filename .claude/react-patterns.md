# React/Next.js Best Practices

## Component Design Principles

- **Single Responsibility**: One component, one purpose
- **Composition over Inheritance**: Prefer composition patterns
- **Props Interface Design**: Clear, typed prop interfaces
- **Custom Hooks**: Extract reusable logic to `src/hooks/`
- **Error Boundaries**: Graceful error handling
- **Accessibility**: ARIA labels, semantic HTML

---

## Component Template

```typescript
'use client';

import { FC, memo } from 'react';
import { motion } from 'framer-motion';

interface FeatureComponentProps {
  data: DataType;
  onAction?: () => void;
}

export const FeatureComponent: FC<FeatureComponentProps> = memo(({ data, onAction }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4"
    >
      {/* Component content */}
    </motion.div>
  );
});

FeatureComponent.displayName = 'FeatureComponent';
```

---

## Performance Optimization Checklist

- [ ] Use `React.memo` for expensive renders
- [ ] Use `useMemo`/`useCallback` for computed values
- [ ] Implement virtual scrolling for long lists (100+ items)
- [ ] Lazy load routes with `React.lazy` / Next.js dynamic imports
- [ ] Use Next.js Image component for all images
- [ ] Debounce search inputs (300-500ms)
- [ ] Throttle scroll/resize handlers

---

## Animation Patterns (Framer Motion)

### Swipe Card Animation
```typescript
const cardVariants = {
  initial: { scale: 0.95, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: (direction: number) => ({
    x: direction * 300,
    opacity: 0,
    transition: { duration: 0.3 }
  })
};
```

### Page Transition
```typescript
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};
```

### List Item Stagger
```typescript
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};
```

---

## Responsive Design

### Breakpoints (Tailwind)
```css
/* Mobile-first approach */
.component {
  /* Mobile (default): < 640px */
  @apply p-2;

  /* sm: >= 640px */
  @screen sm { @apply p-3; }

  /* md: >= 768px */
  @screen md { @apply p-4; }

  /* lg: >= 1024px */
  @screen lg { @apply p-6; }
}
```

### Telegram Mini App Viewport
```typescript
// Handle Telegram viewport
const useTelegramViewport = () => {
  const { viewportHeight, viewportStableHeight } = useTelegramWebApp();

  // Use viewportStableHeight for fixed elements
  // Use viewportHeight for dynamic content
  return { viewportHeight, viewportStableHeight };
};
```

---

## Security Checklist (React)

- [ ] XSS prevention (avoid `dangerouslySetInnerHTML`)
- [ ] Input validation on all forms
- [ ] Sanitize user-generated content
- [ ] Use `httpOnly` cookies for tokens
- [ ] Validate Telegram initData on every auth request
- [ ] Environment variable protection (no secrets in client code)

---

## Performance Optimization

### Frontend
```typescript
const frontendOptimization = {
  code_splitting: "Next.js automatic + dynamic imports",
  bundle: "Next.js built-in optimization",
  images: "next/image with local poster caching",
  caching: "SWR/React Query patterns in stores",
  lazy_loading: "Intersection Observer for movie lists"
};
```

### Backend
```typescript
const backendOptimization = {
  database: "Drizzle connection pooling via postgres.js",
  caching: "LRU cache for TMDB responses (30 days)",
  compression: "Next.js built-in gzip",
  cdn: "Future: CloudFlare for static assets",
  queries: "Indexed columns, efficient JOINs"
};
```

---

## Custom Hook Patterns

### Data Fetching Hook
```typescript
export function useMovies(filters: Filters) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchMovies = async () => {
      setLoading(true);
      try {
        const data = await fetch(`/api/movies?${new URLSearchParams(filters)}`);
        setMovies(await data.json());
      } catch (e) {
        setError(e as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
  }, [filters]);

  return { movies, loading, error };
}
```

### Debounce Hook
```typescript
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

### Intersection Observer Hook
```typescript
export function useInView(ref: RefObject<Element>, options?: IntersectionObserverInit) {
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsInView(entry.isIntersecting);
    }, options);

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, options]);

  return isInView;
}
```

---

## Error Boundary Pattern

```typescript
'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught:', error, errorInfo);
    // Send to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div>Something went wrong</div>;
    }

    return this.props.children;
  }
}
```

---

## Loading States Pattern

```typescript
interface LoadingProps {
  loading: boolean;
  error: Error | null;
  children: ReactNode;
}

export function LoadingState({ loading, error, children }: LoadingProps) {
  if (loading) {
    return <Skeleton />;
  }

  if (error) {
    return <ErrorMessage error={error} />;
  }

  return <>{children}</>;
}
```

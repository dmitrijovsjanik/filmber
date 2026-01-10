// Yandex Metrica counter ID
export const YM_COUNTER_ID = process.env.NEXT_PUBLIC_YM_COUNTER_ID;

// TypeScript declarations for Yandex Metrica
declare global {
  interface Window {
    ym: (counterId: number, method: string, ...args: unknown[]) => void;
  }
}

// Event names for custom tracking
export const YM_EVENTS = {
  ROOM_CREATED: 'room_created',
  ROOM_JOINED: 'room_joined',
  SWIPE_LIKE: 'swipe_like',
  SWIPE_SKIP: 'swipe_skip',
  MATCH_FOUND: 'match_found',
  SOLO_MODE_STARTED: 'solo_mode_started',
} as const;

// Helper function to track goal events
export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && window.ym && YM_COUNTER_ID) {
    window.ym(Number(YM_COUNTER_ID), 'reachGoal', eventName, params);
  }
}

// Helper function to track page views (for SPA navigation)
export function trackPageView(url: string, options?: { title?: string }) {
  if (typeof window !== 'undefined' && window.ym && YM_COUNTER_ID) {
    window.ym(Number(YM_COUNTER_ID), 'hit', url, options);
  }
}

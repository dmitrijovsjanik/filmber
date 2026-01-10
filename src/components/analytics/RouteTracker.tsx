'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useConsentStore } from '@/stores/consentStore';
import { trackPageView, YM_COUNTER_ID } from '@/lib/analytics/yandexMetrica';

export function RouteTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { analyticsConsent } = useConsentStore();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip if no consent or no counter ID
    if (!analyticsConsent || !YM_COUNTER_ID) return;

    // Skip initial page load (already tracked by YM init)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Build full URL for tracking
    const search = searchParams.toString();
    const url = pathname + (search ? `?${search}` : '');

    // Track page view
    trackPageView(url);
  }, [pathname, searchParams, analyticsConsent]);

  return null;
}

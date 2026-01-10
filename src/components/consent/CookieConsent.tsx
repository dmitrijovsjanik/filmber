'use client';

import { useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useConsentStore } from '@/stores/consentStore';
import { Button } from '@/components/ui/Button';

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function CookieConsent() {
  const t = useTranslations('consent');
  const { analyticsConsent, setAnalyticsConsent } = useConsentStore();
  const isMounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Don't render until mounted (prevents hydration mismatch with localStorage)
  if (!isMounted) return null;

  // Don't show if user has already decided
  if (analyticsConsent !== null) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-lg"
      >
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 text-sm text-gray-600 dark:text-gray-400">
            <p className="font-medium text-gray-900 dark:text-white mb-1">
              {t('title')}
            </p>
            <p>{t('description')}</p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAnalyticsConsent(false)}
            >
              {t('decline')}
            </Button>
            <Button size="sm" onClick={() => setAnalyticsConsent(true)}>
              {t('accept')}
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

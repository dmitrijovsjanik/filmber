'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from '@/i18n/navigation';
import { usePathname } from 'next/navigation';
import { Loader } from '@/components/ui/Loader';
import { type Locale } from '@/i18n/config';

const changingLanguageText: Record<Locale, string> = {
  en: 'Changing language...',
  ru: 'Меняем язык...',
};

interface LocaleSwitchContextValue {
  switchLocale: (newLocale: Locale) => void;
  isSwitching: boolean;
}

const LocaleSwitchContext = createContext<LocaleSwitchContextValue | null>(null);

export function useLocaleSwitch() {
  const context = useContext(LocaleSwitchContext);
  if (!context) {
    throw new Error('useLocaleSwitch must be used within LocaleSwitchProvider');
  }
  return context;
}

interface LocaleSwitchProviderProps {
  children: ReactNode;
}

const SWITCH_STORAGE_KEY = 'locale-switching';

export function LocaleSwitchProvider({ children }: LocaleSwitchProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isFadingIn, setIsFadingIn] = useState(false);
  const [targetLocale, setTargetLocale] = useState<Locale | null>(null);
  const [mounted, setMounted] = useState(false);

  // Check if we're in the middle of switching on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);

    const stored = sessionStorage.getItem(SWITCH_STORAGE_KEY);
    if (stored) {
      const { locale, timestamp } = JSON.parse(stored);
      const elapsed = Date.now() - timestamp;
      const remaining = 1000 - elapsed;

      if (remaining > 0) {
        // Continue showing overlay
        setTargetLocale(locale);
        setIsVisible(true);
        setIsFadingIn(true);

        // Schedule fade out
        setTimeout(() => {
          setIsFadingOut(true);
          setTimeout(() => {
            setIsVisible(false);
            setIsFadingOut(false);
            setIsFadingIn(false);
            setTargetLocale(null);
            sessionStorage.removeItem(SWITCH_STORAGE_KEY);
          }, 300);
        }, remaining);
      } else {
        // Time expired, clean up
        sessionStorage.removeItem(SWITCH_STORAGE_KEY);
      }
    }
  }, []);

  const switchLocale = useCallback((newLocale: Locale) => {
    // Store switching state in sessionStorage
    sessionStorage.setItem(SWITCH_STORAGE_KEY, JSON.stringify({
      locale: newLocale,
      timestamp: Date.now(),
    }));

    setTargetLocale(newLocale);
    setIsVisible(true);
    setIsFadingOut(false);
    // Trigger fade in on next frame
    requestAnimationFrame(() => setIsFadingIn(true));

    // Get path without locale prefix
    const pathWithoutLocale = pathname.replace(/^\/(en|ru)/, '') || '/';

    // Small delay to ensure overlay is visible before navigation
    setTimeout(() => {
      router.replace(pathWithoutLocale, { locale: newLocale });
    }, 100);
  }, [router, pathname]);

  const overlay = isVisible && targetLocale && (
    <div
      className="flex flex-col items-center justify-center bg-background"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        opacity: isFadingOut ? 0 : isFadingIn ? 1 : 0,
        transition: 'opacity 300ms ease-in-out',
      }}
    >
      <Loader size="lg" />
      <p className="mt-4 text-muted-foreground">
        {changingLanguageText[targetLocale]}
      </p>
    </div>
  );

  return (
    <LocaleSwitchContext.Provider value={{ switchLocale, isSwitching: isVisible }}>
      {children}
      {/* Render overlay via portal to ensure it's on top of everything */}
      {mounted && overlay && createPortal(overlay, document.body)}
    </LocaleSwitchContext.Provider>
  );
}

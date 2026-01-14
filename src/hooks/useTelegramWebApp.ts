'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';

// Telegram WebApp types
interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
}

interface ThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
}

interface MainButton {
  text: string;
  color: string;
  textColor: string;
  isVisible: boolean;
  isActive: boolean;
  isProgressVisible: boolean;
  setText: (text: string) => void;
  show: () => void;
  hide: () => void;
  enable: () => void;
  disable: () => void;
  showProgress: (leaveActive?: boolean) => void;
  hideProgress: () => void;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
}

interface BackButton {
  isVisible: boolean;
  show: () => void;
  hide: () => void;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
}

interface HapticFeedback {
  impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
  notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  selectionChanged: () => void;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    auth_date: number;
    hash: string;
    query_id?: string;
    start_param?: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: ThemeParams;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  isClosingConfirmationEnabled: boolean;
  MainButton: MainButton;
  BackButton: BackButton;
  HapticFeedback: HapticFeedback;
  ready: () => void;
  expand: () => void;
  close: () => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  showPopup: (
    params: {
      title?: string;
      message: string;
      buttons?: Array<{ id?: string; type?: string; text?: string }>;
    },
    callback?: (buttonId: string) => void
  ) => void;
  disableVerticalSwipes?: () => void;
  enableVerticalSwipes?: () => void;
  isVerticalSwipesEnabled?: boolean;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export function useTelegramWebApp() {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [isReady, setIsReady] = useState(false);
  const { setIsTelegramMiniApp } = useAuthStore();

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg && tg.initData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWebApp(tg);
      setIsTelegramMiniApp(true);

      // Tell Telegram that the app is ready
      tg.ready();

      // Expand to full height
      tg.expand();

      // Disable vertical swipes to prevent accidental app closure when scrolling
      // Available since Telegram WebApp API v7.7
      if (typeof tg.disableVerticalSwipes === 'function') {
        tg.disableVerticalSwipes();
      }

      // Set header/background colors to match app theme for seamless look
      // Uses CSS variable fallback for theme consistency
      const bgColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--background')
        .trim();
      if (bgColor && tg.setHeaderColor && tg.setBackgroundColor) {
        try {
          // Convert HSL to hex if needed, or use theme params
          const headerBg = tg.themeParams.header_bg_color || tg.themeParams.bg_color;
          if (headerBg) {
            tg.setHeaderColor(headerBg);
            tg.setBackgroundColor(headerBg);
          }
        } catch {
          // Ignore color setting errors
        }
      }

      setIsReady(true);
    } else {
      // Not in Telegram Mini App context
      setIsReady(true);
    }
  }, [setIsTelegramMiniApp]);

  // Haptic feedback helpers
  const hapticImpact = useCallback(
    (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') => {
      webApp?.HapticFeedback?.impactOccurred(style);
    },
    [webApp]
  );

  const hapticNotification = useCallback(
    (type: 'error' | 'success' | 'warning') => {
      webApp?.HapticFeedback?.notificationOccurred(type);
    },
    [webApp]
  );

  const hapticSelection = useCallback(() => {
    webApp?.HapticFeedback?.selectionChanged();
  }, [webApp]);

  return {
    webApp,
    isReady,
    isTelegramMiniApp: !!webApp,
    initData: webApp?.initData || '',
    user: webApp?.initDataUnsafe?.user,
    startParam: webApp?.initDataUnsafe?.start_param,
    colorScheme: webApp?.colorScheme || 'light',
    themeParams: webApp?.themeParams || {},
    platform: webApp?.platform || 'unknown',
    version: webApp?.version || '0.0',
    viewportHeight: webApp?.viewportHeight || 0,
    // Haptic feedback
    hapticImpact,
    hapticNotification,
    hapticSelection,
  };
}

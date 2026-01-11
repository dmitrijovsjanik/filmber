import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import Script from 'next/script';
import { routing } from '@/i18n/routing';
import { YandexMetrica } from '@/components/analytics/YandexMetrica';
import { RouteTracker } from '@/components/analytics/RouteTracker';
import { CookieConsent } from '@/components/consent/CookieConsent';
import { TelegramAuthProvider } from '@/components/auth';
import { BottomNav } from '@/components/ui/BottomNav';
import { MainContent } from '@/components/ui/MainContent';
import { Toaster } from '@/components/ui/sonner';
import { LocaleSwitchProvider } from '@/contexts/LocaleSwitchContext';
import '../globals.css';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'app' });

  return {
    title: t('name'),
    description: t('tagline'),
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;

  // Validate locale
  if (!routing.locales.includes(locale as 'en' | 'ru')) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="h-dvh bg-background text-foreground antialiased overflow-hidden">
        <NextIntlClientProvider messages={messages}>
          <TelegramAuthProvider>
            <LocaleSwitchProvider>
              <YandexMetrica />
              <Suspense fallback={null}>
                <RouteTracker />
              </Suspense>
              <MainContent>{children}</MainContent>
              <BottomNav />
              <CookieConsent />
              <Toaster />
            </LocaleSwitchProvider>
          </TelegramAuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

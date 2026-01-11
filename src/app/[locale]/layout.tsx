import type { Metadata } from 'next';
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
import { Toaster } from '@/components/ui/sonner';
import '../globals.css';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

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
      <body className="min-h-screen bg-background text-foreground antialiased">
        <NextIntlClientProvider messages={messages}>
          <TelegramAuthProvider>
            <YandexMetrica />
            <Suspense fallback={null}>
              <RouteTracker />
            </Suspense>
            <main className="min-h-screen flex flex-col pb-16">{children}</main>
            <BottomNav />
            <CookieConsent />
            <Toaster />
          </TelegramAuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

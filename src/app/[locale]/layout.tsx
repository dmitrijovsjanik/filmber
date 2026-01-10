import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { routing } from '@/i18n/routing';
import { YandexMetrica } from '@/components/analytics/YandexMetrica';
import { RouteTracker } from '@/components/analytics/RouteTracker';
import { CookieConsent } from '@/components/consent/CookieConsent';
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
      <body className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white antialiased">
        <NextIntlClientProvider messages={messages}>
          <YandexMetrica />
          <Suspense fallback={null}>
            <RouteTracker />
          </Suspense>
          <main className="min-h-screen flex flex-col">{children}</main>
          <CookieConsent />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

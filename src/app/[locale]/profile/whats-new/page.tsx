import { getTranslations } from 'next-intl/server';
import { parseChangelog } from '@/lib/changelog/parser';
import { WhatsNewContent } from './WhatsNewContent';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'changelog' });

  return {
    title: t('title'),
  };
}

export default async function WhatsNewPage({ params }: Props) {
  const { locale } = await params;
  const releases = parseChangelog(locale);

  return <WhatsNewContent releases={releases} />;
}

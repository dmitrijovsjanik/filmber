import { getTranslations } from 'next-intl/server';
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

export default async function WhatsNewPage() {
  return <WhatsNewContent />;
}

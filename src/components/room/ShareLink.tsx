'use client';

import { useState } from 'react';

interface ShareLinkProps {
  roomCode: string;
  pin: string;
  locale?: string;
}

export function ShareLink({ roomCode, pin, locale = 'en' }: ShareLinkProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/${locale}/room/${roomCode}`
      : `/${locale}/room/${roomCode}`;

  const copyToClipboard = async () => {
    const text = locale === 'ru'
      ? `${shareUrl}\n\nПароль: ${pin}`
      : `${shareUrl}\n\nPassword: ${pin}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const t = {
    shareTitle: locale === 'ru' ? 'Поделитесь комнатой' : 'Share this room',
    description: locale === 'ru'
      ? 'Отправьте ссылку и пароль вашему партнёру'
      : 'Send the link and password to your partner',
    copied: locale === 'ru' ? 'Скопировано!' : 'Copied!',
    copy: locale === 'ru' ? 'Скопировать ссылку и пароль' : 'Copy link and password',
  };

  return (
    <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {t.shareTitle}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        {t.description}
      </p>

      <button
        onClick={copyToClipboard}
        className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-xl font-medium transition-all shadow-lg shadow-pink-500/25"
      >
        {copied ? t.copied : t.copy}
      </button>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AnimatePresence, motion } from 'framer-motion';

interface ShareLinkProps {
  roomCode: string;
  pin: string;
  locale?: string;
}

export function ShareLink({ roomCode, pin, locale = 'en' }: ShareLinkProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedBoth, setCopiedBoth] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const hasAutoCopied = useRef(false);

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/${locale}/room/${roomCode}`
      : `/${locale}/room/${roomCode}`;

  const qrUrl = `${shareUrl}?pin=${pin}`;

  const t = {
    shareTitle: locale === 'ru' ? 'Поделитесь комнатой' : 'Share this room',
    description: locale === 'ru'
      ? 'Отправьте ссылку и пароль партнёру'
      : 'Send the link and password to your partner',
    link: locale === 'ru' ? 'Ссылка' : 'Link',
    password: locale === 'ru' ? 'Пароль' : 'Password',
    copied: locale === 'ru' ? 'Скопировано!' : 'Copied!',
    share: locale === 'ru' ? 'Поделиться' : 'Share',
    autoCopied: locale === 'ru' ? 'Ссылка и пароль скопированы' : 'Link and password copied',
    scanQr: locale === 'ru' ? 'Или отсканируйте QR-код' : 'Or scan QR code',
  };

  // Check if Web Share API is available
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && !!navigator.share);
  }, []);

  // Auto-copy link and PIN on mount
  useEffect(() => {
    if (hasAutoCopied.current) return;
    hasAutoCopied.current = true;

    const autoCopy = async () => {
      const text = locale === 'ru'
        ? `${shareUrl}\n\nПароль: ${pin}`
        : `${shareUrl}\n\nPassword: ${pin}`;

      try {
        await navigator.clipboard.writeText(text);
        setCopiedBoth(true);
        setTimeout(() => setCopiedBoth(false), 3000);
      } catch (err) {
        console.error('Auto-copy failed:', err);
      }
    };

    autoCopy();
  }, [shareUrl, pin, locale]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const copyPin = async () => {
    try {
      await navigator.clipboard.writeText(pin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    } catch (err) {
      console.error('Failed to copy PIN:', err);
    }
  };

  const handleShare = async () => {
    if (!navigator.share) return;

    try {
      await navigator.share({
        title: 'Filmber',
        text: locale === 'ru'
          ? `Присоединяйся к выбору фильма!\nПароль: ${pin}`
          : `Join movie selection!\nPassword: ${pin}`,
        url: shareUrl,
      });
    } catch (err) {
      // User cancelled or share failed
      if ((err as Error).name !== 'AbortError') {
        console.error('Share failed:', err);
      }
    }
  };

  return (
    <>
      {/* Snackbar */}
      <AnimatePresence>
        {copiedBoth && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 py-3 px-6 bg-gray-900 dark:bg-gray-700 text-white rounded-full shadow-lg flex items-center gap-2"
          >
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {t.autoCopied}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {t.shareTitle}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t.description}
        </p>

        {/* Link field */}
      <div className="mb-3">
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
          {t.link}
        </label>
        <button
          onClick={copyUrl}
          className="w-full flex items-center justify-between gap-2 p-3 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-pink-300 dark:hover:border-pink-500 transition-colors cursor-pointer text-left"
        >
          <span className="text-sm text-gray-900 dark:text-white truncate flex-1">
            {shareUrl}
          </span>
          {copiedUrl ? (
            <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>

      {/* PIN field */}
      <div className="mb-6">
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
          {t.password}
        </label>
        <button
          onClick={copyPin}
          className="w-full flex items-center justify-between gap-2 p-3 bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-pink-300 dark:hover:border-pink-500 transition-colors cursor-pointer text-left"
        >
          <span className="text-lg font-mono font-bold text-gray-900 dark:text-white tracking-wider">
            {pin}
          </span>
          {copiedPin ? (
            <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>

      {/* QR Code */}
      <div className="mb-6">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 text-center">
          {t.scanQr}
        </p>
        <div className="flex justify-center">
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <QRCodeSVG
              value={qrUrl}
              size={160}
              level="M"
              fgColor="#ec4899"
              bgColor="#ffffff"
            />
          </div>
        </div>
      </div>

        {/* Share button */}
        {canShare && (
          <button
            onClick={handleShare}
            className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-xl font-medium transition-all shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            {t.share}
          </button>
        )}
      </div>
    </>
  );
}

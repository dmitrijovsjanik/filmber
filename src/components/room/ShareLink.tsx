'use client';

import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Copy, Share2 } from 'lucide-react';

interface ShareLinkProps {
  roomCode: string;
  pin: string;
}

export function ShareLink({ roomCode, pin }: ShareLinkProps) {
  const t = useTranslations('room');
  const locale = useLocale();

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedBoth, setCopiedBoth] = useState(false);
  const hasAutoCopied = useRef(false);

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/${locale}/room/${roomCode}`
      : `/${locale}/room/${roomCode}`;

  const qrUrl = `${shareUrl}?pin=${pin}`;

  // Check Web Share API availability (computed, not state)
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  // Auto-copy link and PIN on mount
  useEffect(() => {
    if (hasAutoCopied.current) return;
    hasAutoCopied.current = true;

    const autoCopy = async () => {
      const text = `${shareUrl}\n\n${t('password')}: ${pin}`;

      try {
        await navigator.clipboard.writeText(text);
        setCopiedBoth(true);
        setTimeout(() => setCopiedBoth(false), 3000);
      } catch (err) {
        console.error('Auto-copy failed:', err);
      }
    };

    autoCopy();
  }, [shareUrl, pin, t]);

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
        text: `${t('shareLink')}\n${t('password')}: ${pin}`,
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
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
          >
            <Badge className="flex items-center gap-2 bg-card px-4 py-2 text-sm shadow-lg">
              <Check className="h-4 w-4 text-emerald-500" />
              {t('autoCopied')}
            </Badge>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="w-full max-w-md bg-card/50">
        <CardHeader>
          <CardTitle>{t('shareTitle')}</CardTitle>
          <CardDescription>{t('shareLink')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Link field */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              {t('link')}
            </label>
            <button
              onClick={copyUrl}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-input bg-background p-3 text-left transition-colors hover:border-pink-500/50"
            >
              <span className="flex-1 truncate text-sm">{shareUrl}</span>
              {copiedUrl ? (
                <Check className="h-5 w-5 flex-shrink-0 text-emerald-500" />
              ) : (
                <Copy className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
              )}
            </button>
          </div>

          {/* PIN field */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              {t('password')}
            </label>
            <button
              onClick={copyPin}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-input bg-background p-3 text-left transition-colors hover:border-pink-500/50"
            >
              <span className="font-mono text-lg font-bold tracking-wider">
                {pin}
              </span>
              {copiedPin ? (
                <Check className="h-5 w-5 flex-shrink-0 text-emerald-500" />
              ) : (
                <Copy className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
              )}
            </button>
          </div>

          {/* QR Code */}
          <div className="pt-2">
            <p className="mb-3 text-center text-xs text-muted-foreground">
              {t('scanQr')}
            </p>
            <div className="flex justify-center">
              <div className="rounded-xl bg-white p-4 shadow-sm">
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
            <Button
              onClick={handleShare}
              variant="gradient"
              className="w-full"
              size="lg"
            >
              <Share2 className="h-5 w-5" />
              {t('share')}
            </Button>
          )}
        </CardContent>
      </Card>
    </>
  );
}

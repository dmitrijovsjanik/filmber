'use client';

import { useTranslations } from 'next-intl';
import { ShareLink } from './ShareLink';
import { Loader } from '../ui/Loader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';

interface WaitingRoomProps {
  roomCode: string;
  pin: string;
  isPartnerConnected: boolean;
}

export function WaitingRoom({
  roomCode,
  pin,
  isPartnerConnected,
}: WaitingRoomProps) {
  const t = useTranslations('room');

  return (
    <div className="flex flex-col items-center gap-8 p-4">
      <ShareLink roomCode={roomCode} pin={pin} />

      <Card className="w-full max-w-md border-none bg-card/50">
        <CardContent className="flex flex-col items-center gap-4 pt-6">
          {isPartnerConnected ? (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">
                {t('connected')}
              </Badge>
              <p className="text-sm text-muted-foreground">{t('startingSoon')}</p>
            </>
          ) : (
            <>
              <Loader size="lg" />
              <p className="text-lg font-medium text-muted-foreground">
                {t('waiting')}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

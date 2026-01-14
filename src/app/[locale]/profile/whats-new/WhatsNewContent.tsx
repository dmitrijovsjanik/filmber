'use client';

import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth';
import { WhatsNewOverlay } from '@/components/profile';

interface WhatsNewContentProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  releases?: any[]; // Not used anymore, kept for backward compatibility
}

export function WhatsNewContent(_props: WhatsNewContentProps) {
  const router = useRouter();

  return (
    <AuthGuard>
      <WhatsNewOverlay
        isOpen={true}
        onClose={() => router.push('/profile')}
      />
    </AuthGuard>
  );
}

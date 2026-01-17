'use client';

import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth';
import { WhatsNewOverlay } from '@/components/profile';

export function WhatsNewContent() {
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

'use client';

import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth';
import { DeckSettingsOverlay } from '@/components/profile';

export default function DeckSettingsPage() {
  const router = useRouter();

  return (
    <AuthGuard>
      <DeckSettingsOverlay
        isOpen={true}
        onClose={() => router.push('/profile')}
      />
    </AuthGuard>
  );
}

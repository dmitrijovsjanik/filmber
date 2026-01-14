'use client';

import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth';
import { NotificationsOverlay } from '@/components/profile';

export default function NotificationsPage() {
  const router = useRouter();

  return (
    <AuthGuard>
      <NotificationsOverlay
        isOpen={true}
        onClose={() => router.push('/profile')}
      />
    </AuthGuard>
  );
}

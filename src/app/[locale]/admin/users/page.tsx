'use client';

import { DataTable } from '@/components/admin/DataTable';

interface UserData {
  id: string;
  telegramId: number;
  telegramUsername: string | null;
  firstName: string;
  lastName: string | null;
  isPremium: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  movieCount: number;
}

export default function UsersPage() {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Users</h2>
      <DataTable<UserData>
        endpoint="/api/admin/users"
        columns={[
          {
            key: 'telegramId',
            header: 'Telegram ID',
            className: 'font-mono text-xs',
          },
          {
            key: 'name',
            header: 'Name',
            render: (item) => (
              <div>
                <div className="font-medium">
                  {item.firstName} {item.lastName}
                </div>
                {item.telegramUsername && (
                  <div className="text-xs text-muted-foreground">
                    @{item.telegramUsername}
                  </div>
                )}
              </div>
            ),
          },
          {
            key: 'isPremium',
            header: 'Premium',
            render: (item) => (item.isPremium ? '⭐' : '-'),
            className: 'text-center',
          },
          {
            key: 'movieCount',
            header: 'Movies',
            className: 'text-center',
          },
          {
            key: 'lastSeenAt',
            header: 'Last Seen',
            render: (item) => formatDate(item.lastSeenAt),
            className: 'text-xs',
          },
          {
            key: 'createdAt',
            header: 'Registered',
            render: (item) => formatDate(item.createdAt),
            className: 'text-xs',
          },
        ]}
      />
    </div>
  );
}

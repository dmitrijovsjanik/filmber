'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DataTable } from '@/components/admin/DataTable';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface RoomData {
  id: string;
  code: string;
  status: string;
  userAConnected: boolean;
  userBConnected: boolean;
  userAId: string | null;
  userBId: string | null;
  matchedMovieId: number | null;
  createdAt: string;
  expiresAt: string | null;
  swipeCount: number;
}

const statusColors: Record<string, string> = {
  waiting: 'bg-yellow-500/20 text-yellow-600',
  active: 'bg-green-500/20 text-green-600',
  matched: 'bg-blue-500/20 text-blue-600',
  expired: 'bg-gray-500/20 text-gray-500',
};

export default function RoomsPage() {
  const pathname = usePathname();
  const locale = pathname.split('/')[1] || 'en';

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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Rooms</h2>
        <Tabs value="list">
          <TabsList>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="analytics" asChild>
              <Link href={`/${locale}/admin/rooms/analytics`}>Analytics</Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <DataTable<RoomData>
        endpoint="/api/admin/rooms"
        columns={[
          {
            key: 'code',
            header: 'Code',
            render: (item) => (
              <span className="font-mono font-medium">{item.code}</span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (item) => (
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${statusColors[item.status] || ''}`}
              >
                {item.status}
              </span>
            ),
          },
          {
            key: 'users',
            header: 'Users',
            render: (item) => (
              <div className="flex gap-1">
                <span
                  className={`h-2 w-2 rounded-full ${item.userAConnected ? 'bg-green-500' : 'bg-gray-300'}`}
                  title="User A"
                />
                <span
                  className={`h-2 w-2 rounded-full ${item.userBConnected ? 'bg-green-500' : 'bg-gray-300'}`}
                  title="User B"
                />
              </div>
            ),
            className: 'text-center',
          },
          {
            key: 'swipeCount',
            header: 'Swipes',
            className: 'text-center',
          },
          {
            key: 'matchedMovieId',
            header: 'Match',
            render: (item) =>
              item.matchedMovieId ? (
                <span className="text-green-600">#{item.matchedMovieId}</span>
              ) : (
                '-'
              ),
          },
          {
            key: 'createdAt',
            header: 'Created',
            render: (item) => formatDate(item.createdAt),
            className: 'text-xs',
          },
        ]}
      />
    </div>
  );
}

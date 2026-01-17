'use client';

import { useState } from 'react';
import { DataTable } from '@/components/admin/DataTable';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface UserData {
  id: string;
  telegramId: number;
  telegramUsername: string | null;
  firstName: string;
  lastName: string | null;
  isPremium: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  // Movie stats
  movieCount: number;
  watchingCount: number;
  watchedCount: number;
  // Room stats
  roomsTotal: number;
  roomsCreated: number;
  roomsJoined: number;
  roomsMatched: number;
  // Sessions
  sessionCount: number;
  // Activity by period
  activityDay: number;
  activityWeek: number;
  activityMonth: number;
}

type SortOption = 'lastSeenAt' | 'createdAt' | 'movieCount' | 'roomsTotal' | 'activityWeek';

export default function UsersPage() {
  const [sortBy, setSortBy] = useState<SortOption>('lastSeenAt');

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Users</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lastSeenAt">Last Seen</SelectItem>
              <SelectItem value="createdAt">Registered</SelectItem>
              <SelectItem value="movieCount">Movies</SelectItem>
              <SelectItem value="roomsTotal">Rooms</SelectItem>
              <SelectItem value="activityWeek">Weekly Activity</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable<UserData>
        endpoint={`/api/admin/users?sortBy=${sortBy}&sortOrder=desc`}
        columns={[
          {
            key: 'name',
            header: 'User',
            render: (item) => (
              <div className="min-w-[120px]">
                <div className="font-medium flex items-center gap-1">
                  {item.firstName} {item.lastName}
                  {item.isPremium && <span title="Telegram Premium">⭐</span>}
                </div>
                {item.telegramUsername && (
                  <div className="text-xs text-muted-foreground">
                    @{item.telegramUsername}
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground font-mono">
                  ID: {item.telegramId}
                </div>
              </div>
            ),
          },
          {
            key: 'movies',
            header: 'Movies',
            render: (item) => (
              <div className="text-center min-w-[60px]">
                <div className="font-medium">{item.movieCount}</div>
                <div className="text-[10px] text-muted-foreground">
                  {item.watchingCount}📺 {item.watchedCount}✓
                </div>
              </div>
            ),
            className: 'text-center',
          },
          {
            key: 'rooms',
            header: 'Rooms',
            render: (item) => (
              <div className="text-center min-w-[70px]">
                <div className="font-medium">{item.roomsTotal}</div>
                <div className="text-[10px] text-muted-foreground">
                  {item.roomsMatched} matches
                </div>
              </div>
            ),
            className: 'text-center',
          },
          {
            key: 'activity',
            header: 'Activity',
            render: (item) => (
              <div className="text-center min-w-[80px]">
                <div className="flex gap-1 justify-center text-xs">
                  <span
                    className={`px-1 rounded ${item.activityDay > 0 ? 'bg-green-500/20 text-green-600' : 'text-muted-foreground'}`}
                    title="Last 24h"
                  >
                    D:{item.activityDay}
                  </span>
                  <span
                    className={`px-1 rounded ${item.activityWeek > 0 ? 'bg-blue-500/20 text-blue-600' : 'text-muted-foreground'}`}
                    title="Last 7 days"
                  >
                    W:{item.activityWeek}
                  </span>
                  <span
                    className={`px-1 rounded ${item.activityMonth > 0 ? 'bg-purple-500/20 text-purple-600' : 'text-muted-foreground'}`}
                    title="Last 30 days"
                  >
                    M:{item.activityMonth}
                  </span>
                </div>
              </div>
            ),
            className: 'text-center',
          },
          {
            key: 'lastSeenAt',
            header: 'Last Seen',
            render: (item) => (
              <div className="text-xs min-w-[70px]" title={formatDate(item.lastSeenAt)}>
                {formatRelativeTime(item.lastSeenAt)}
              </div>
            ),
          },
          {
            key: 'createdAt',
            header: 'Registered',
            render: (item) => (
              <div className="text-xs min-w-[80px]">
                {formatDate(item.createdAt)}
              </div>
            ),
          },
        ]}
      />

      <div className="text-xs text-muted-foreground">
        <p><strong>Activity legend:</strong> D = last 24h, W = last 7 days, M = last 30 days (rooms participated)</p>
        <p><strong>Movies:</strong> 📺 = watching, ✓ = watched</p>
      </div>
    </div>
  );
}

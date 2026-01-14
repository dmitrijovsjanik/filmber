'use client';

import { useEffect } from 'react';
import { useAdminStore } from '@/stores/adminStore';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader } from '@/components/ui/Loader';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  UserMultiple02Icon,
  Film02Icon,
  GridIcon,
  Activity01Icon,
  Clock01Icon,
  HeartCheckIcon,
} from '@hugeicons/core-free-icons';

function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: typeof UserMultiple02Icon;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <HugeiconsIcon icon={icon} size={18} className="text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { stats, fetchStats } = useAdminStore();
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (token) {
      fetchStats(token);
    }
  }, [token, fetchStats]);

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader size="lg" />
      </div>
    );
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Dashboard</h2>

      {/* Users Section */}
      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">
          Users
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Users"
            value={stats.users.total}
            subtitle={`First: ${formatDate(stats.users.firstUser)}`}
            icon={UserMultiple02Icon}
          />
          <StatCard
            title="Last 24 Hours"
            value={`+${stats.users.last24h}`}
            subtitle="New registrations"
            icon={UserMultiple02Icon}
          />
          <StatCard
            title="Last 7 Days"
            value={`+${stats.users.last7d}`}
            subtitle="New registrations"
            icon={UserMultiple02Icon}
          />
          <StatCard
            title="Active Sessions"
            value={stats.sessions.active}
            subtitle="Currently valid"
            icon={Activity01Icon}
          />
        </div>
      </section>

      {/* Content Section */}
      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">
          Content
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Cached Movies"
            value={stats.movies.cached}
            subtitle="In database"
            icon={Film02Icon}
          />
          <StatCard
            title="Movies in Lists"
            value={stats.movies.inLists}
            subtitle="Saved by users"
            icon={HeartCheckIcon}
          />
          <StatCard
            title="Total Rooms"
            value={stats.rooms.total}
            subtitle={`${stats.rooms.active} active`}
            icon={GridIcon}
          />
          <StatCard
            title="Active Rooms"
            value={stats.rooms.active}
            subtitle="Currently open"
            icon={GridIcon}
          />
        </div>
      </section>

      {/* Activity Section */}
      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">
          Today&apos;s Activity
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Swipes Today"
            value={stats.activity.swipesToday}
            subtitle="User interactions"
            icon={Activity01Icon}
          />
          <StatCard
            title="Matches Today"
            value={stats.activity.matchesToday}
            subtitle="Successful pairs"
            icon={HeartCheckIcon}
          />
        </div>
      </section>

      {/* Server Info */}
      <section className="rounded-lg bg-muted/50 p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <HugeiconsIcon icon={Clock01Icon} size={16} />
          <span>Server time: {new Date(stats.serverTime).toLocaleString('ru-RU')}</span>
        </div>
      </section>
    </div>
  );
}

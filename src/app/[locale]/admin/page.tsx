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
  ChartLineData02Icon,
  RefreshIcon,
  UserSharingIcon,
  FilterIcon,
  SwipeLeft04Icon,
} from '@hugeicons/core-free-icons';
import { SimpleLineChart } from '@/components/admin';

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

      {/* Active Users (DAU/WAU/MAU) */}
      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">
          Active Users
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title="DAU"
            value={stats.activeUsers.dau}
            subtitle="Daily active users"
            icon={UserMultiple02Icon}
          />
          <StatCard
            title="WAU"
            value={stats.activeUsers.wau}
            subtitle="Weekly active users"
            icon={UserMultiple02Icon}
          />
          <StatCard
            title="MAU"
            value={stats.activeUsers.mau}
            subtitle="Monthly active users"
            icon={UserMultiple02Icon}
          />
        </div>
      </section>

      {/* Retention */}
      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">
          Retention
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title="D1 Retention"
            value={`${stats.retention.d1.rate}%`}
            subtitle={`${stats.retention.d1.returned}/${stats.retention.d1.cohort} users`}
            icon={RefreshIcon}
          />
          <StatCard
            title="D7 Retention"
            value={`${stats.retention.d7.rate}%`}
            subtitle={`${stats.retention.d7.returned}/${stats.retention.d7.cohort} users`}
            icon={RefreshIcon}
          />
          <StatCard
            title="D30 Retention"
            value={`${stats.retention.d30.rate}%`}
            subtitle={`${stats.retention.d30.returned}/${stats.retention.d30.cohort} users`}
            icon={RefreshIcon}
          />
        </div>
      </section>

      {/* Virality */}
      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">
          Virality
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title="K-factor"
            value={stats.virality.kFactor.toFixed(2)}
            subtitle="Viral coefficient"
            icon={UserSharingIcon}
          />
          <StatCard
            title="Total Referrals"
            value={stats.virality.totalReferrals}
            subtitle="Users who were referred"
            icon={UserSharingIcon}
          />
          <StatCard
            title="Active Referrers"
            value={stats.virality.usersWithReferrals}
            subtitle="Users who referred others"
            icon={UserSharingIcon}
          />
        </div>
      </section>

      {/* Funnel Conversion */}
      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">
          Funnel Conversion
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Rooms Connected"
            value={stats.funnel.roomsWithConnection}
            subtitle="At least one user joined"
            icon={GridIcon}
          />
          <StatCard
            title="One Auth (Rooms)"
            value={stats.funnel.roomsWithOneAuth}
            subtitle={`${stats.funnel.authRate}% of rooms`}
            icon={FilterIcon}
          />
          <StatCard
            title="Both Auth (Rooms)"
            value={stats.funnel.roomsWithBothAuth}
            subtitle={`${stats.funnel.bothAuthRate}% of rooms`}
            icon={FilterIcon}
          />
          <StatCard
            title="Guest→Auth Users"
            value={stats.funnel.usersWithSwipeSync}
            subtitle={`${stats.funnel.guestToAuthRate}% of users`}
            icon={UserMultiple02Icon}
          />
          <StatCard
            title="Guest→Auth Rate"
            value={`${stats.funnel.guestToAuthRate}%`}
            subtitle="Synced anonymous swipes"
            icon={UserMultiple02Icon}
          />
        </div>
      </section>

      {/* Session Depth */}
      <section>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">
          Session Depth
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Avg Swipes/Room"
            value={stats.sessionDepth.avgSwipesPerRoom}
            subtitle="Pair mode depth"
            icon={SwipeLeft04Icon}
          />
          <StatCard
            title="Avg Swipes/User"
            value={stats.sessionDepth.avgSwipesPerUser}
            subtitle="Solo mode depth"
            icon={SwipeLeft04Icon}
          />
          <StatCard
            title="Total Room Swipes"
            value={stats.sessionDepth.totalRoomSwipes}
            subtitle="All time (pair mode)"
            icon={Activity01Icon}
          />
          <StatCard
            title="Total User Swipes"
            value={stats.sessionDepth.totalUserSwipes}
            subtitle="All time (solo mode)"
            icon={Activity01Icon}
          />
        </div>
      </section>

      {/* User Growth Chart */}
      <section>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              User Growth (Last 30 days)
            </CardTitle>
            <HugeiconsIcon icon={ChartLineData02Icon} size={18} className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <SimpleLineChart data={stats.growth.daily} height={200} />
          </CardContent>
        </Card>
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

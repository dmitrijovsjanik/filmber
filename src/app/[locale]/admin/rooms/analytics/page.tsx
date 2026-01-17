'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader } from '@/components/ui/Loader';

interface TimeRangeStats {
  totalRooms: number;
  byStatus: {
    waiting: number;
    active: number;
    matched: number;
    expired: number;
  };
  rates: {
    matchRate: number;
    abandonmentRate: number;
  };
  auth: {
    withAuth: number;
    bothAuth: number;
    anonymous: number;
  };
  swipes: {
    total: number;
    avgToMatch: number;
  };
  topMatches: Array<{ movieId: number; count: number }>;
}

interface HourlyData {
  hour: number;
  count: number;
}

interface DailyData {
  date: string;
  total: number;
  matched: number;
}

interface AnalyticsData {
  analytics: Record<string, TimeRangeStats>;
  distributions: {
    hourly: HourlyData[];
    daily: DailyData[];
  };
}

function StatCard({
  title,
  value,
  subtitle,
  trend,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-500',
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className={`text-xs ${trend ? trendColors[trend] : 'text-muted-foreground'}`}>
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SimpleBarChart({ data, maxValue }: { data: { label: string; value: number }[]; maxValue: number }) {
  return (
    <div className="space-y-2">
      {data.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className="w-8 text-xs text-muted-foreground">{item.label}</span>
          <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%` }}
            />
          </div>
          <span className="w-12 text-xs text-right">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function RoomAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('week');

  useEffect(() => {
    fetch('/api/admin/rooms/analytics')
      .then((res) => res.json())
      .then((result) => {
        if (result.error) {
          setError(result.error);
        } else {
          setData(result);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader size="lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 text-red-500">
        {error || 'Failed to load analytics'}
      </div>
    );
  }

  const stats = data.analytics[timeRange];
  const hourlyData = data.distributions.hourly.map((h) => ({
    label: `${h.hour}:00`,
    value: h.count,
  }));
  const maxHourly = Math.max(...data.distributions.hourly.map((h) => h.count), 1);

  // Funnel data
  const funnelData = [
    { label: 'Created', value: stats.totalRooms, color: 'bg-blue-500' },
    { label: 'Active', value: stats.byStatus.active + stats.byStatus.matched + stats.byStatus.expired, color: 'bg-yellow-500' },
    { label: 'Matched', value: stats.byStatus.matched, color: 'bg-green-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Room Analytics</h2>
        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="all">All Time</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Rooms"
          value={stats.totalRooms}
          subtitle={`${stats.byStatus.active} active now`}
        />
        <StatCard
          title="Match Rate"
          value={`${stats.rates.matchRate}%`}
          subtitle={`${stats.byStatus.matched} matched`}
          trend={stats.rates.matchRate > 20 ? 'up' : stats.rates.matchRate > 10 ? 'neutral' : 'down'}
        />
        <StatCard
          title="Abandonment"
          value={`${stats.rates.abandonmentRate}%`}
          subtitle={`${stats.byStatus.expired} expired`}
          trend={stats.rates.abandonmentRate < 50 ? 'up' : 'down'}
        />
        <StatCard
          title="Avg Swipes to Match"
          value={stats.swipes.avgToMatch || '-'}
          subtitle={`${stats.swipes.total} total swipes`}
        />
      </div>

      {/* Funnel & Status */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {funnelData.map((item, i) => {
                const widthPercent = stats.totalRooms > 0
                  ? (item.value / stats.totalRooms) * 100
                  : 0;
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{item.label}</span>
                      <span className="font-medium">{item.value}</span>
                    </div>
                    <div className="h-6 bg-muted rounded overflow-hidden">
                      <div
                        className={`h-full ${item.color} transition-all`}
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                    {i > 0 && stats.totalRooms > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {((item.value / stats.totalRooms) * 100).toFixed(1)}% of total
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-yellow-500/10 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{stats.byStatus.waiting}</div>
                <div className="text-xs text-muted-foreground">Waiting</div>
              </div>
              <div className="text-center p-3 bg-green-500/10 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.byStatus.active}</div>
                <div className="text-xs text-muted-foreground">Active</div>
              </div>
              <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.byStatus.matched}</div>
                <div className="text-xs text-muted-foreground">Matched</div>
              </div>
              <div className="text-center p-3 bg-gray-500/10 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">{stats.byStatus.expired}</div>
                <div className="text-xs text-muted-foreground">Expired</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Auth & Time Patterns */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Authentication</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Anonymous (no auth)</span>
                <span className="font-medium">{stats.auth.anonymous}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">At least one authenticated</span>
                <span className="font-medium">{stats.auth.withAuth}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Both authenticated</span>
                <span className="font-medium">{stats.auth.bothAuth}</span>
              </div>
              {stats.totalRooms > 0 && (
                <div className="pt-2 border-t">
                  <div className="text-xs text-muted-foreground">
                    Auth rate: {((stats.auth.withAuth / stats.totalRooms) * 100).toFixed(1)}%
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Hourly Activity (Last 7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={hourlyData} maxValue={maxHourly} />
          </CardContent>
        </Card>
      </div>

      {/* Top Matches */}
      {stats.topMatches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top Matched Movies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {stats.topMatches.map((match) => (
                <div
                  key={match.movieId}
                  className="text-center p-2 bg-muted rounded"
                >
                  <div className="text-sm font-medium">#{match.movieId}</div>
                  <div className="text-xs text-muted-foreground">{match.count} matches</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Daily Trend (Last 30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="flex gap-1 min-w-max">
              {data.distributions.daily.map((day) => {
                const maxDaily = Math.max(...data.distributions.daily.map((d) => d.total), 1);
                const height = (day.total / maxDaily) * 60;
                const matchedHeight = (day.matched / maxDaily) * 60;
                return (
                  <div key={day.date} className="flex flex-col items-center" title={`${day.date}: ${day.total} rooms, ${day.matched} matched`}>
                    <div className="relative h-16 w-4 bg-muted rounded-t flex items-end">
                      <div
                        className="absolute bottom-0 w-full bg-blue-300 rounded-t"
                        style={{ height: `${height}px` }}
                      />
                      <div
                        className="absolute bottom-0 w-full bg-green-500 rounded-t"
                        style={{ height: `${matchedHeight}px` }}
                      />
                    </div>
                    <div className="text-[8px] text-muted-foreground mt-1 -rotate-45 origin-top-left w-6">
                      {day.date.slice(5)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-300 rounded" />
                <span>Total</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded" />
                <span>Matched</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader } from '@/components/ui/Loader';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Settings02Icon,
  AnalyticsUpIcon,
  PlayIcon,
  Search01Icon,
  Notification03Icon,
} from '@hugeicons/core-free-icons';

interface NotificationStats {
  totalNotifications: number;
  totalSuccess: number;
  totalFailed: number;
  byType: Record<string, { count: number; success: number; failed: number }>;
  recentLogs: Array<{
    id: string;
    type: string;
    tmdbId: number;
    totalRecipients: number;
    successCount: number;
    failureCount: number;
    startedAt: string;
    completedAt: string | null;
  }>;
  upcomingMovies: {
    total: number;
    tracked: number;
    released: number;
    archived: number;
  };
}

interface NotificationConfig {
  'upcoming.enabled': string;
  'upcoming.announcementsEnabled': string;
  'upcoming.theatricalReleasesEnabled': string;
  'upcoming.digitalReleasesEnabled': string;
  'upcoming.digitalReleaseDelayDays': string;
  'upcoming.minPopularity': string;
}

interface UpcomingMovie {
  id: string;
  tmdbId: number;
  title: string;
  titleRu: string | null;
  posterPath: string | null;
}

interface SearchResult {
  id: number;
  title: string;
  original_title: string;
  release_date: string;
  poster_path: string | null;
}

interface UserOption {
  id: string;
  telegramId: number;
  telegramUsername: string | null;
  firstName: string;
}

export default function NotificationsPage() {
  const token = useAuthStore((state) => state.token);

  // Stats state
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Config state
  const [config, setConfig] = useState<NotificationConfig>({
    'upcoming.enabled': 'true',
    'upcoming.announcementsEnabled': 'true',
    'upcoming.theatricalReleasesEnabled': 'true',
    'upcoming.digitalReleasesEnabled': 'true',
    'upcoming.digitalReleaseDelayDays': '7',
    'upcoming.minPopularity': '50',
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configResult, setConfigResult] = useState<string | null>(null);

  // Test notification state
  const [testType, setTestType] = useState<'announcement' | 'theatrical' | 'digital'>('announcement');
  const [testMovies, setTestMovies] = useState<UpcomingMovie[]>([]);
  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Movie search state
  const [movieSearch, setMovieSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<SearchResult | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // User selection state
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('me');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Release notes test state
  const [releaseVersion, setReleaseVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [selectedReleaseUserId, setSelectedReleaseUserId] = useState<string>('me');
  const [isSendingRelease, setIsSendingRelease] = useState(false);
  const [releaseResult, setReleaseResult] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch('/api/admin/notifications/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  }, [token]);

  const fetchConfig = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch('/api/admin/notifications/config', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
    }
  }, [token]);

  const fetchTestMovies = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch('/api/upcoming?limit=20', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setTestMovies(data.data || []);
        if (data.data?.length > 0) {
          setSelectedMovieId(data.data[0].tmdbId);
        }
      }
    } catch (error) {
      console.error('Failed to fetch movies:', error);
    }
  }, [token]);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setIsLoadingUsers(true);

    try {
      const response = await fetch('/api/admin/users?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [token]);

  const searchMovies = useCallback(async (query: string) => {
    if (!token || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/search?query=${encodeURIComponent(query)}&mediaType=movie`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        // Map SearchResult to our simpler interface
        const results = (data.tmdb?.results || []).slice(0, 10).map((r: { tmdbId: number; title: string; releaseDate?: string; posterPath?: string }) => ({
          id: r.tmdbId,
          title: r.title,
          original_title: r.title,
          release_date: r.releaseDate,
          poster_path: r.posterPath,
        }));
        setSearchResults(results);
        setShowSearchResults(true);
      }
    } catch (error) {
      console.error('Failed to search movies:', error);
    } finally {
      setIsSearching(false);
    }
  }, [token]);

  // Debounced movie search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (movieSearch.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchMovies(movieSearch);
      }, 300);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [movieSearch, searchMovies]);

  // Close search results on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchStats();
    fetchConfig();
    fetchTestMovies();
    fetchUsers();
  }, [fetchStats, fetchConfig, fetchTestMovies, fetchUsers]);

  const handleSaveConfig = async () => {
    if (!token) return;

    setIsSavingConfig(true);
    setConfigResult(null);

    try {
      const response = await fetch('/api/admin/notifications/config', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        setConfigResult('Configuration saved');
      } else {
        const data = await response.json();
        setConfigResult(`Error: ${data.error}`);
      }
    } catch (error) {
      setConfigResult('Failed to save configuration');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSendTest = async () => {
    const tmdbId = selectedMovie?.id || selectedMovieId;
    if (!token || !tmdbId) return;

    setIsSendingTest(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/admin/notifications/test', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: testType,
          tmdbId,
          userId: selectedUserId === 'me' ? undefined : selectedUserId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setTestResult(`Test notification sent: ${data.data.movieTitle}`);
      } else {
        setTestResult(`Error: ${data.error}`);
      }
    } catch (error) {
      setTestResult('Failed to send test notification');
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSendReleaseNotesTest = async () => {
    if (!token || !releaseVersion || !releaseNotes) return;

    setIsSendingRelease(true);
    setReleaseResult(null);

    try {
      const response = await fetch('/api/admin/notifications/test', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'release_notes',
          version: releaseVersion,
          releaseNotes,
          userId: selectedReleaseUserId === 'me' ? undefined : selectedReleaseUserId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setReleaseResult(`Release notes v${releaseVersion} sent successfully`);
      } else {
        setReleaseResult(`Error: ${data.error}`);
      }
    } catch (error) {
      setReleaseResult('Failed to send release notes notification');
    } finally {
      setIsSendingRelease(false);
    }
  };

  const handleSelectMovie = (movie: SearchResult) => {
    setSelectedMovie(movie);
    setMovieSearch(movie.title);
    setShowSearchResults(false);
    setSelectedMovieId(null);
  };

  const clearSelectedMovie = () => {
    setSelectedMovie(null);
    setMovieSearch('');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      announcement: 'Announcement',
      theatrical_release: 'Theatrical',
      digital_release: 'Digital',
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Notifications Management</h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats?.upcomingMovies.tracked || 0}</div>
            <div className="text-xs text-muted-foreground">Tracked Movies</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats?.totalNotifications || 0}</div>
            <div className="text-xs text-muted-foreground">Total Sent</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-500">{stats?.totalSuccess || 0}</div>
            <div className="text-xs text-muted-foreground">Successful</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-500">{stats?.totalFailed || 0}</div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HugeiconsIcon icon={Settings02Icon} size={18} />
            Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Global Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="font-medium">Enable Notifications</div>
              <div className="text-xs text-muted-foreground">Global toggle for all notification types</div>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={config['upcoming.enabled'] === 'true'}
                onChange={(e) => setConfig({ ...config, 'upcoming.enabled': e.target.checked ? 'true' : 'false' })}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-muted after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
            </label>
          </div>

          {/* Type Toggles */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm">Announcements</span>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={config['upcoming.announcementsEnabled'] === 'true'}
                  onChange={(e) => setConfig({ ...config, 'upcoming.announcementsEnabled': e.target.checked ? 'true' : 'false' })}
                  className="peer sr-only"
                />
                <div className="peer h-5 w-9 rounded-full bg-muted after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
              </label>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm">Theatrical</span>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={config['upcoming.theatricalReleasesEnabled'] === 'true'}
                  onChange={(e) => setConfig({ ...config, 'upcoming.theatricalReleasesEnabled': e.target.checked ? 'true' : 'false' })}
                  className="peer sr-only"
                />
                <div className="peer h-5 w-9 rounded-full bg-muted after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
              </label>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm">Digital</span>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={config['upcoming.digitalReleasesEnabled'] === 'true'}
                  onChange={(e) => setConfig({ ...config, 'upcoming.digitalReleasesEnabled': e.target.checked ? 'true' : 'false' })}
                  className="peer sr-only"
                />
                <div className="peer h-5 w-9 rounded-full bg-muted after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
              </label>
            </div>
          </div>

          {/* Number Inputs */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Digital Release Delay (days)</label>
              <input
                type="number"
                min="0"
                max="30"
                value={config['upcoming.digitalReleaseDelayDays']}
                onChange={(e) => setConfig({ ...config, 'upcoming.digitalReleaseDelayDays': e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Min Popularity Threshold</label>
              <input
                type="number"
                min="0"
                max="1000"
                value={config['upcoming.minPopularity']}
                onChange={(e) => setConfig({ ...config, 'upcoming.minPopularity': e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button onClick={handleSaveConfig} disabled={isSavingConfig}>
              {isSavingConfig ? 'Saving...' : 'Save Configuration'}
            </Button>
            {configResult && (
              <span className={`text-sm ${configResult.startsWith('Error') ? 'text-red-500' : 'text-green-500'}`}>
                {configResult}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Test Notification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HugeiconsIcon icon={PlayIcon} size={18} />
            Test Notification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Notification Type</label>
              <select
                value={testType}
                onChange={(e) => setTestType(e.target.value as typeof testType)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="announcement">Announcement</option>
                <option value="theatrical">Theatrical Release</option>
                <option value="digital">Digital Release</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Send To</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                disabled={isLoadingUsers}
              >
                <option value="me">Me (Admin)</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.telegramUsername ? `(@${user.telegramUsername})` : `(${user.telegramId})`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Movie Search */}
          <div ref={searchRef} className="relative">
            <label className="mb-1 block text-sm text-muted-foreground">Movie (search by title)</label>
            <div className="relative">
              <HugeiconsIcon
                icon={Search01Icon}
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                value={movieSearch}
                onChange={(e) => {
                  setMovieSearch(e.target.value);
                  if (selectedMovie) setSelectedMovie(null);
                }}
                placeholder="Search any movie..."
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader size="sm" />
                </div>
              )}
            </div>

            {/* Search Results Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-background shadow-lg">
                {searchResults.map((movie) => (
                  <button
                    key={movie.id}
                    onClick={() => handleSelectMovie(movie)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    {movie.title} ({movie.release_date?.slice(0, 4) || 'TBA'})
                  </button>
                ))}
              </div>
            )}

            {/* Selected Movie Display */}
            {selectedMovie && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm">
                <span className="flex-1">
                  {selectedMovie.title} ({selectedMovie.release_date?.slice(0, 4) || 'TBA'})
                </span>
                <button
                  onClick={clearSelectedMovie}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Or select from upcoming movies */}
          {!selectedMovie && testMovies.length > 0 && (
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Or select from upcoming movies</label>
              <select
                value={selectedMovieId || ''}
                onChange={(e) => setSelectedMovieId(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a movie...</option>
                {testMovies.map((movie) => (
                  <option key={movie.tmdbId} value={movie.tmdbId}>
                    {movie.title} {movie.titleRu ? `(${movie.titleRu})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-4">
            <Button onClick={handleSendTest} disabled={isSendingTest || (!selectedMovie && !selectedMovieId)}>
              {isSendingTest ? 'Sending...' : 'Send Test'}
            </Button>
            {testResult && (
              <span className={`text-sm ${testResult.startsWith('Error') ? 'text-red-500' : 'text-green-500'}`}>
                {testResult}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Release Notes Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HugeiconsIcon icon={Notification03Icon} size={18} />
            Test Release Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Version</label>
              <input
                type="text"
                value={releaseVersion}
                onChange={(e) => setReleaseVersion(e.target.value)}
                placeholder="e.g., 2.8.0"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Send To</label>
              <select
                value={selectedReleaseUserId}
                onChange={(e) => setSelectedReleaseUserId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                disabled={isLoadingUsers}
              >
                <option value="me">Me (Admin)</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.telegramUsername ? `(@${user.telegramUsername})` : `(${user.telegramId})`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Release Notes</label>
            <textarea
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
              placeholder="What's new in this version..."
              rows={4}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-4">
            <Button onClick={handleSendReleaseNotesTest} disabled={isSendingRelease || !releaseVersion || !releaseNotes}>
              {isSendingRelease ? 'Sending...' : 'Send Release Notes'}
            </Button>
            {releaseResult && (
              <span className={`text-sm ${releaseResult.startsWith('Error') ? 'text-red-500' : 'text-green-500'}`}>
                {releaseResult}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HugeiconsIcon icon={AnalyticsUpIcon} size={18} />
            Recent Notification Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingStats ? (
            <div className="flex justify-center py-4">
              <Loader />
            </div>
          ) : !stats?.recentLogs?.length ? (
            <p className="py-4 text-center text-muted-foreground">No notification logs yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 pr-4">Type</th>
                    <th className="pb-2 pr-4">TMDB ID</th>
                    <th className="pb-2 pr-4">Recipients</th>
                    <th className="pb-2 pr-4">Success</th>
                    <th className="pb-2 pr-4">Failed</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentLogs.map((log) => (
                    <tr key={log.id} className="border-b border-border/50">
                      <td className="py-2 pr-4">
                        <span className="rounded bg-primary/10 px-2 py-1 text-xs">
                          {getTypeLabel(log.type)}
                        </span>
                      </td>
                      <td className="py-2 pr-4">{log.tmdbId}</td>
                      <td className="py-2 pr-4">{log.totalRecipients}</td>
                      <td className="py-2 pr-4 text-green-500">{log.successCount || 0}</td>
                      <td className="py-2 pr-4 text-red-500">{log.failureCount || 0}</td>
                      <td className="py-2 text-muted-foreground">{formatDate(log.startedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader } from '@/components/ui/Loader';
import { HugeiconsIcon } from '@hugeicons/react';
import { Megaphone01Icon, Mail01Icon, CheckmarkCircle01Icon, Clock01Icon } from '@hugeicons/core-free-icons';

interface BugReport {
  id: string;
  telegramId: number;
  telegramUsername: string | null;
  firstName: string | null;
  message: string;
  status: string;
  adminReply: string | null;
  repliedAt: string | null;
  createdAt: string;
}

interface BugReportCounts {
  open: number;
  replied: number;
  total: number;
}

export default function BotPage() {
  const token = useAuthStore((state) => state.token);

  // Broadcast state
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [audience, setAudience] = useState('all');
  const [isSending, setIsSending] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);

  // Bug reports state
  const [reports, setReports] = useState<BugReport[]>([]);
  const [counts, setCounts] = useState<BugReportCounts>({ open: 0, replied: 0, total: 0 });
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const fetchReports = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch('/api/admin/bug-reports?status=open', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setReports(data.data);
        setCounts(data.counts);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setIsLoadingReports(false);
    }
  }, [token]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleBroadcast = async () => {
    if (!token || !broadcastMessage.trim()) return;

    setIsSending(true);
    setBroadcastResult(null);

    try {
      const response = await fetch('/api/admin/bot/broadcast', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: broadcastMessage,
          audience,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setBroadcastResult(`Broadcast started to ${data.targetUsers} users`);
        setBroadcastMessage('');
      } else {
        setBroadcastResult(`Error: ${data.error}`);
      }
    } catch (error) {
      setBroadcastResult('Failed to send broadcast');
    } finally {
      setIsSending(false);
    }
  };

  const handleReply = async (reportId: string) => {
    if (!token || !replyText.trim()) return;

    try {
      const response = await fetch(`/api/admin/bug-reports/${reportId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reply: replyText }),
      });

      if (response.ok) {
        setReplyingTo(null);
        setReplyText('');
        fetchReports();
      }
    } catch (error) {
      console.error('Failed to send reply:', error);
    }
  };

  const handleCloseReport = async (reportId: string) => {
    if (!token) return;

    try {
      await fetch(`/api/admin/bug-reports/${reportId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'closed' }),
      });
      fetchReports();
    } catch (error) {
      console.error('Failed to close report:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Bot Management</h2>

      {/* Broadcast Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HugeiconsIcon icon={Megaphone01Icon} size={18} />
            Broadcast Message
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            value={broadcastMessage}
            onChange={(e) => setBroadcastMessage(e.target.value)}
            placeholder="Enter message to broadcast (supports HTML formatting)..."
            className="h-24 w-full resize-none rounded-lg border border-border bg-background p-3 text-sm"
            maxLength={4000}
          />

          <div className="flex items-center gap-4">
            <label className="text-sm text-muted-foreground">Audience:</label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="all">All users</option>
              <option value="active_7d">Active in last 7 days</option>
              <option value="active_30d">Active in last 30 days</option>
            </select>
          </div>

          <div className="flex items-center gap-4">
            <Button
              onClick={handleBroadcast}
              disabled={isSending || !broadcastMessage.trim()}
            >
              {isSending ? 'Sending...' : 'Send Broadcast'}
            </Button>

            {broadcastResult && (
              <span
                className={`text-sm ${broadcastResult.startsWith('Error') ? 'text-red-500' : 'text-green-500'}`}
              >
                {broadcastResult}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bug Reports Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <HugeiconsIcon icon={Mail01Icon} size={18} />
              Bug Reports
            </span>
            <span className="flex gap-2 text-xs font-normal">
              <span className="rounded bg-yellow-500/20 px-2 py-1 text-yellow-600">
                {counts.open} open
              </span>
              <span className="rounded bg-green-500/20 px-2 py-1 text-green-600">
                {counts.replied} replied
              </span>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingReports ? (
            <div className="flex justify-center py-4">
              <Loader />
            </div>
          ) : reports.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">
              No open bug reports
            </p>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="rounded-lg border border-border p-4"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <span className="font-medium">
                        {report.firstName || 'Unknown'}
                      </span>
                      {report.telegramUsername && (
                        <span className="ml-2 text-sm text-muted-foreground">
                          @{report.telegramUsername}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(report.createdAt)}
                    </span>
                  </div>

                  <p className="mb-3 whitespace-pre-wrap text-sm">
                    {report.message}
                  </p>

                  {replyingTo === report.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type your reply..."
                        className="h-20 w-full resize-none rounded-lg border border-border bg-background p-2 text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleReply(report.id)}
                          disabled={!replyText.trim()}
                        >
                          Send Reply
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyText('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReplyingTo(report.id)}
                      >
                        Reply
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCloseReport(report.id)}
                      >
                        Close
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

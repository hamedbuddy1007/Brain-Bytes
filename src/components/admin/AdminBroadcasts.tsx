import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../Icon';
import { apiRequest } from '../../services/apiClient';
import type { BroadcastHistoryItem, BroadcastPriority } from '../../types/competition';

interface AdminBroadcastsResponse {
  activeBroadcast: {
    message: string;
    timestamp: string | null;
    title?: string | null;
    priority: BroadcastPriority;
  } | null;
  history: BroadcastHistoryItem[];
}

interface QuickTemplate {
  id: string;
  label: string;
  title: string;
  priority: BroadcastPriority;
  message: string;
  icon: 'play' | 'award' | 'clock' | 'alert-triangle' | 'trophy' | 'bell';
}

const QUICK_TEMPLATES: QuickTemplate[] = [
  {
    id: 'r1-live',
    label: 'Round 1 Started',
    title: 'Round 1 (Data MCQ) is Now LIVE',
    priority: 'INFO',
    message: 'Round 1 (Data MCQ) is now open! Please enter the Arena Cockpit and launch Round 1. You have 10 minutes to complete 50 questions.',
    icon: 'play',
  },
  {
    id: 'r1-qual',
    label: 'Round 2 Qualifiers Out',
    title: 'Round 1 Qualification Results Published',
    priority: 'QUALIFICATION',
    message: 'Official Round 1 qualification cutoff has been executed! Qualified participants have received a selection pop-up and may now advance to Round 2.',
    icon: 'award',
  },
  {
    id: 'r2-live',
    label: 'Round 2 Started',
    title: 'Round 2 (Graph Challenge) is Now LIVE',
    priority: 'INFO',
    message: 'Round 2 (Graph Challenge) is now open for all qualified candidates! Proceed to the Round 2 tab in the Arena Cockpit to begin.',
    icon: 'play',
  },
  {
    id: 'r2-qual',
    label: 'Round 3 Finalists Out',
    title: 'Grand Finale Qualifiers Selected',
    priority: 'QUALIFICATION',
    message: 'Official Round 2 qualification results are published! Congratulations to the finalists selected for the Round 3 Rapid Fire Showdown!',
    icon: 'trophy',
  },
  {
    id: 'r3-live',
    label: 'Round 3 Finale Live',
    title: 'Round 3 Grand Finale is Now LIVE',
    priority: 'URGENT',
    message: 'The Round 3 Championship Finale (Rapid Fire) has begun! Finalists, launch Round 3 immediately. +5 for correct, -2 for wrong!',
    icon: 'play',
  },
  {
    id: 'time-5m',
    label: '5 Minutes Left',
    title: '5 Minutes Remaining in Current Stage',
    priority: 'WARNING',
    message: 'Attention participants: 5 minutes remaining in the current competition round. Ensure all your selected answers are saved.',
    icon: 'clock',
  },
  {
    id: 'time-1m',
    label: 'Final 60 Seconds',
    title: 'Final 60 Seconds Remaining!',
    priority: 'URGENT',
    message: 'Final 60 seconds remaining! Submit your answers now or keep them selected for automatic lock-in when the timer hits zero.',
    icon: 'alert-triangle',
  },
  {
    id: 'standby',
    label: 'Standby Notice',
    title: 'Proctor Standby Instruction',
    priority: 'WARNING',
    message: 'Please remain seated and do not refresh or switch browser tabs while scores and round qualifications are verified.',
    icon: 'bell',
  },
];

const PRIORITY_META: Record<
  BroadcastPriority,
  {
    label: string;
    defaultSubject: string;
    color: string;
    bg: string;
    border: string;
    glow: string;
    desc: string;
  }
> = {
  INFO: {
    label: 'OFFICIAL BROADCAST',
    defaultSubject: 'Official Tournament Announcement',
    color: '#F43F5E',
    bg: 'rgba(142, 35, 59, 0.25)',
    border: 'rgba(244, 63, 94, 0.45)',
    glow: 'rgba(142, 35, 59, 0.35)',
    desc: 'Standard arena announcement',
  },
  QUALIFICATION: {
    label: 'QUALIFICATION NOTICE',
    defaultSubject: 'Official Qualification Update',
    color: '#34D399',
    bg: 'rgba(16, 185, 129, 0.16)',
    border: 'rgba(52, 211, 153, 0.45)',
    glow: 'rgba(16, 185, 129, 0.28)',
    desc: 'Round selection & progression alert',
  },
  WARNING: {
    label: 'IMPORTANT WARNING',
    defaultSubject: 'Important Proctor Notice',
    color: '#FBBF24',
    bg: 'rgba(245, 158, 11, 0.16)',
    border: 'rgba(251, 191, 36, 0.45)',
    glow: 'rgba(245, 158, 11, 0.28)',
    desc: 'Time reminders & proctor instructions',
  },
  URGENT: {
    label: 'URGENT ALERT',
    defaultSubject: 'Urgent Tournament Alert',
    color: '#F87171',
    bg: 'rgba(239, 68, 68, 0.2)',
    border: 'rgba(248, 113, 113, 0.5)',
    glow: 'rgba(239, 68, 68, 0.32)',
    desc: 'Critical high-priority flash alert',
  },
};

export function formatBroadcastTimeAmPm(ts?: string | number | Date | null): string {
  const dateObj = ts ? new Date(ts) : new Date();
  if (Number.isNaN(dateObj.getTime())) {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
  return dateObj.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export const AdminBroadcasts: React.FC = () => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<BroadcastPriority>('INFO');
  const [activeBroadcast, setActiveBroadcast] = useState<AdminBroadcastsResponse['activeBroadcast']>(null);
  const [history, setHistory] = useState<BroadcastHistoryItem[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchBroadcastData = useCallback(async () => {
    try {
      const data = await apiRequest<AdminBroadcastsResponse>('/admin/broadcasts');
      if (data) {
        setActiveBroadcast(data.activeBroadcast || null);
        setHistory(Array.isArray(data.history) ? data.history : []);
      }
    } catch {
      // Ignore transient poll errors
    }
  }, []);

  useEffect(() => {
    void fetchBroadcastData();
    const interval = setInterval(() => void fetchBroadcastData(), 4000);
    return () => clearInterval(interval);
  }, [fetchBroadcastData]);

  const handleSendBroadcast = async (
    overrideMsg?: string,
    overrideTitle?: string | null,
    overridePriority?: BroadcastPriority,
  ) => {
    const priorityToSend = overridePriority || priority;
    const msgToSend = (overrideMsg !== undefined ? overrideMsg : message).trim();
    const rawTitle = (overrideTitle !== undefined ? overrideTitle || '' : title).trim();
    const titleToSend = rawTitle || PRIORITY_META[priorityToSend].defaultSubject;

    if (!msgToSend) {
      showToast('Please enter an announcement message to share.', 'error');
      return;
    }

    setIsSending(true);
    try {
      await apiRequest('/admin/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          message: msgToSend,
          title: titleToSend,
          priority: priorityToSend,
        }),
      });
      if (overrideMsg === undefined) {
        setMessage('');
        setTitle('');
      }
      await fetchBroadcastData();
      showToast('Announcement shared to all active participants! (5s pop-up + Announcement Centre)');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to share announcement.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleClearActiveBroadcast = async () => {
    setIsClearing(true);
    try {
      await apiRequest('/admin/broadcast', { method: 'DELETE' });
      await fetchBroadcastData();
      showToast('Active broadcast pop-up cleared.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to clear active broadcast.', 'error');
    } finally {
      setIsClearing(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Clear all past broadcast history logs from the Announcement Centre?')) return;
    try {
      await apiRequest('/admin/broadcasts/history', { method: 'DELETE' });
      await fetchBroadcastData();
      showToast('Announcement history log cleared.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to clear announcement history.', 'error');
    }
  };

  const handleApplyTemplate = (tpl: QuickTemplate) => {
    setTitle(tpl.title);
    setMessage(tpl.message);
    setPriority(tpl.priority);
  };

  const currentPriorityMeta = PRIORITY_META[priority] || PRIORITY_META.INFO;
  const previewSubject = title.trim() || currentPriorityMeta.defaultSubject;

  return (
    <div className="overview-container" style={{ gap: '20px' }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            background: toast.type === 'error' ? 'rgba(127, 29, 29, 0.95)' : 'rgba(6, 78, 59, 0.95)',
            border: `1px solid ${toast.type === 'error' ? 'rgba(248, 113, 113, 0.5)' : 'rgba(52, 211, 153, 0.5)'}`,
            color: '#FFFFFF',
            padding: '14px 20px',
            borderRadius: '12px',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 700,
            fontSize: '13.5px',
          }}
        >
          <Icon name={toast.type === 'error' ? 'alert-circle' : 'check-circle'} size={18} />
          <span>{toast.text}</span>
        </div>
      )}

      {/* 1. LIVE ACTIVE BROADCAST STATUS BANNER */}
      <div
        style={{
          padding: '22px 26px',
          borderRadius: '16px',
          background: activeBroadcast
            ? 'linear-gradient(135deg, rgba(20, 24, 38, 0.9) 0%, rgba(142, 35, 59, 0.22) 100%)'
            : 'var(--admin-bg-panel, rgba(20, 24, 38, 0.72))',
          border: activeBroadcast
            ? `1.5px solid ${PRIORITY_META[activeBroadcast.priority || 'INFO']?.border || 'rgba(244, 63, 94, 0.45)'}`
            : '1px solid var(--admin-border-subtle, rgba(255, 255, 255, 0.12))',
          boxShadow: activeBroadcast
            ? `0 12px 32px ${PRIORITY_META[activeBroadcast.priority || 'INFO']?.glow || 'rgba(142, 35, 59, 0.25)'}`
            : '0 8px 32px rgba(0, 0, 0, 0.24)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flex: 1, minWidth: '260px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: activeBroadcast
                ? PRIORITY_META[activeBroadcast.priority || 'INFO']?.bg || 'rgba(142, 35, 59, 0.25)'
                : 'rgba(255, 255, 255, 0.05)',
              border: activeBroadcast
                ? `1px solid ${PRIORITY_META[activeBroadcast.priority || 'INFO']?.border || 'rgba(244, 63, 94, 0.4)'}`
                : '1px solid rgba(255, 255, 255, 0.1)',
              color: activeBroadcast
                ? PRIORITY_META[activeBroadcast.priority || 'INFO']?.color || '#F43F5E'
                : 'var(--admin-text-dim, #94A3B8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon name="bell" size={22} />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background: activeBroadcast
                    ? PRIORITY_META[activeBroadcast.priority || 'INFO']?.bg
                    : 'rgba(255, 255, 255, 0.06)',
                  border: activeBroadcast
                    ? `1px solid ${PRIORITY_META[activeBroadcast.priority || 'INFO']?.border}`
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  color: activeBroadcast
                    ? PRIORITY_META[activeBroadcast.priority || 'INFO']?.color
                    : 'var(--admin-text-muted, #CBD5E1)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: activeBroadcast
                      ? PRIORITY_META[activeBroadcast.priority || 'INFO']?.color
                      : '#64748B',
                    boxShadow: activeBroadcast
                      ? `0 0 8px ${PRIORITY_META[activeBroadcast.priority || 'INFO']?.color}`
                      : 'none',
                  }}
                />
                {activeBroadcast
                  ? `${PRIORITY_META[activeBroadcast.priority || 'INFO']?.label} • SHARED TO ALL ACTIVE PARTICIPANTS`
                  : 'NO ACTIVE POP-UP BROADCAST'}
              </span>

              {activeBroadcast?.timestamp && (
                <span
                  style={{
                    fontSize: '12px',
                    color: 'var(--admin-text-muted, #CBD5E1)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                  }}
                >
                  Shared at {formatBroadcastTimeAmPm(activeBroadcast.timestamp)}
                </span>
              )}
            </div>

            {activeBroadcast ? (
              <div>
                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: 800,
                    color: 'var(--admin-text-main, #FFFFFF)',
                    marginBottom: '4px',
                  }}
                >
                  {activeBroadcast.title || PRIORITY_META[activeBroadcast.priority || 'INFO']?.defaultSubject}
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--admin-text-muted, #CBD5E1)',
                    lineHeight: 1.5,
                  }}
                >
                  {activeBroadcast.message}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '13.5px', color: 'var(--admin-text-dim, #94A3B8)', fontWeight: 500 }}>
                No active pop-up is currently pinned. When you share an announcement, it pops up on all active participant windows for 5 seconds and remains stored in their Announcement Centre.
              </div>
            )}
          </div>
        </div>

        {activeBroadcast && (
          <button
            type="button"
            onClick={() => void handleClearActiveBroadcast()}
            disabled={isClearing}
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(248, 113, 113, 0.4)',
              color: '#FCA5A5',
              padding: '10px 16px',
              borderRadius: '10px',
              fontSize: '12.5px',
              fontWeight: 800,
              cursor: isClearing ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              flexShrink: 0,
              transition: 'all 0.2s ease',
            }}
          >
            <Icon name="x" size={15} />
            {isClearing ? 'Clearing...' : 'Clear Active Pop-up'}
          </button>
        )}
      </div>

      {/* 2. COMPOSER + QUICK TEMPLATES GRID */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        {/* Left: Broadcast Composer & Live Preview */}
        <div
          style={{
            padding: '24px',
            borderRadius: '16px',
            background: 'var(--admin-bg-panel, rgba(20, 24, 38, 0.72))',
            border: '1px solid var(--admin-border-subtle, rgba(255, 255, 255, 0.12))',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.24)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <Icon name="award" size={18} style={{ color: 'var(--admin-maroon-highlight, #B94B68)' }} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--admin-text-main, #FFFFFF)' }}>
                Compose Arena Announcement
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--admin-text-dim, #94A3B8)', fontWeight: 500 }}>
              Pops up on all active participant windows for 5 seconds, then stays accessible in their Announcement Centre.
            </p>
          </div>

          {/* Priority Level Selector */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--admin-text-muted, #CBD5E1)',
                marginBottom: '8px',
              }}
            >
              Announcement Priority
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {(Object.keys(PRIORITY_META) as BroadcastPriority[]).map((pKey) => {
                const meta = PRIORITY_META[pKey];
                const isSelected = priority === pKey;
                return (
                  <button
                    key={pKey}
                    type="button"
                    onClick={() => setPriority(pKey)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: isSelected
                        ? `1.5px solid ${meta.color}`
                        : '1px solid var(--admin-border-subtle, rgba(255, 255, 255, 0.12))',
                      background: isSelected ? meta.bg : 'var(--admin-bg-inset, rgba(12, 15, 24, 0.6))',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        color: isSelected ? meta.color : 'var(--admin-text-main, #FFFFFF)',
                        letterSpacing: '0.06em',
                        marginBottom: '2px',
                      }}
                    >
                      {meta.label}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--admin-text-dim, #94A3B8)', fontWeight: 500 }}>
                      {meta.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subject Line Input */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--admin-text-muted, #CBD5E1)',
                }}
              >
                Subject Line *
              </label>
              <span style={{ fontSize: '11px', color: 'var(--admin-text-dim, #94A3B8)', fontWeight: 600 }}>
                {title.length}/100
              </span>
            </div>
            <input
              type="text"
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`e.g., ${currentPriorityMeta.defaultSubject}`}
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '10px',
                border: '1px solid var(--admin-border-subtle, rgba(255, 255, 255, 0.14))',
                background: 'var(--admin-bg-inset, rgba(12, 15, 24, 0.65))',
                fontSize: '13.5px',
                fontWeight: 600,
                color: 'var(--admin-text-main, #FFFFFF)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Message Body Input */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--admin-text-muted, #CBD5E1)',
                }}
              >
                Announcement Message *
              </label>
              <span
                style={{
                  fontSize: '11px',
                  color: message.length > 450 ? '#F87171' : 'var(--admin-text-dim, #94A3B8)',
                  fontWeight: 600,
                }}
              >
                {message.length}/500
              </span>
            </div>
            <textarea
              rows={4}
              maxLength={500}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write the official announcement message to display below the subject line for all active participants..."
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1px solid var(--admin-border-subtle, rgba(255, 255, 255, 0.14))',
                background: 'var(--admin-bg-inset, rgba(12, 15, 24, 0.65))',
                fontSize: '13.5px',
                fontWeight: 500,
                color: 'var(--admin-text-main, #FFFFFF)',
                lineHeight: 1.5,
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Live Participant Pop-up Preview */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              background: 'rgba(10, 12, 20, 0.85)',
              border: `1.5px solid ${currentPriorityMeta.border}`,
              boxShadow: `0 8px 24px ${currentPriorityMeta.glow}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  color: currentPriorityMeta.color,
                  textTransform: 'uppercase',
                }}
              >
                LIVE PARTICIPANT POP-UP PREVIEW (5s WINDOW) • {currentPriorityMeta.label}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#94A3B8',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {formatBroadcastTimeAmPm()}
              </span>
            </div>

            {/* Subject Line */}
            <div
              style={{
                fontSize: '14px',
                fontWeight: 800,
                color: '#FFFFFF',
                marginBottom: '6px',
                paddingBottom: '6px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              Subject: {previewSubject}
            </div>

            {/* Message Below Subject Line */}
            <div
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: message.trim() ? '#E2E8F0' : '#64748B',
                fontStyle: message.trim() ? 'normal' : 'italic',
                lineHeight: 1.5,
              }}
            >
              {message.trim() || 'Your announcement message will appear here below the subject line...'}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => void handleSendBroadcast()}
              disabled={isSending || !message.trim()}
              style={{
                flex: 1,
                padding: '13px 20px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: !message.trim()
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'linear-gradient(135deg, var(--admin-maroon-primary, #8E233B), var(--admin-maroon-highlight, #B94B68))',
                color: !message.trim() ? '#64748B' : '#FFFFFF',
                fontSize: '13.5px',
                fontWeight: 800,
                cursor: isSending || !message.trim() ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: !message.trim() ? 'none' : '0 8px 24px rgba(142, 35, 59, 0.45)',
                transition: 'all 0.2s ease',
              }}
            >
              <Icon name="bell" size={16} />
              {isSending ? 'Sharing Announcement...' : 'Share to All Active Participants'}
            </button>

            {(title || message) && (
              <button
                type="button"
                onClick={() => {
                  setTitle('');
                  setMessage('');
                }}
                style={{
                  padding: '13px 16px',
                  borderRadius: '10px',
                  border: '1px solid var(--admin-border-subtle, rgba(255, 255, 255, 0.14))',
                  background: 'var(--admin-bg-inset, rgba(12, 15, 24, 0.6))',
                  color: 'var(--admin-text-muted, #CBD5E1)',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Right: Instant 1-Click Tournament Templates */}
        <div
          style={{
            padding: '24px',
            borderRadius: '16px',
            background: 'var(--admin-bg-panel, rgba(20, 24, 38, 0.72))',
            border: '1px solid var(--admin-border-subtle, rgba(255, 255, 255, 0.12))',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.24)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <Icon name="zap" size={18} style={{ color: 'var(--admin-maroon-highlight, #B94B68)' }} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--admin-text-main, #FFFFFF)' }}>
                Quick-Fire Tournament Presets
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--admin-text-dim, #94A3B8)', fontWeight: 500 }}>
              Load a preset into the editor or share it directly to all active participants in one click.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {QUICK_TEMPLATES.map((tpl) => {
              const pMeta = PRIORITY_META[tpl.priority];
              return (
                <div
                  key={tpl.id}
                  style={{
                    padding: '13px 15px',
                    borderRadius: '12px',
                    border: '1px solid var(--admin-border-subtle, rgba(255, 255, 255, 0.1))',
                    background: 'var(--admin-bg-inset, rgba(12, 15, 24, 0.6))',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: pMeta.bg,
                          border: `1px solid ${pMeta.border}`,
                          color: pMeta.color,
                          letterSpacing: '0.06em',
                        }}
                      >
                        {pMeta.label}
                      </span>
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--admin-text-main, #FFFFFF)' }}>
                        {tpl.title}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleApplyTemplate(tpl)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '7px',
                          border: '1px solid rgba(255, 255, 255, 0.14)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--admin-text-muted, #CBD5E1)',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={isSending}
                        onClick={() => void handleSendBroadcast(tpl.message, tpl.title, tpl.priority)}
                        style={{
                          padding: '5px 11px',
                          borderRadius: '7px',
                          border: `1px solid ${pMeta.border}`,
                          background: pMeta.bg,
                          color: '#FFFFFF',
                          fontSize: '11.5px',
                          fontWeight: 800,
                          cursor: isSending ? 'wait' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Icon name="bell" size={12} />
                        Share Now
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--admin-text-dim, #94A3B8)', lineHeight: 1.45 }}>
                    {tpl.message}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. BROADCAST HISTORY LOG */}
      <div
        style={{
          padding: '24px',
          borderRadius: '16px',
          background: 'var(--admin-bg-panel, rgba(20, 24, 38, 0.72))',
          border: '1px solid var(--admin-border-subtle, rgba(255, 255, 255, 0.12))',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.24)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 800, color: 'var(--admin-text-main, #FFFFFF)' }}>
              Announcement Centre History ({history.length})
            </h3>
            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--admin-text-dim, #94A3B8)', fontWeight: 500 }}>
              All announcements listed here are visible in the Participant Announcement Centre. You can re-share any item at any time.
            </p>
          </div>

          {history.length > 0 && (
            <button
              type="button"
              onClick={() => void handleClearHistory()}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(248, 113, 113, 0.35)',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#FCA5A5',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Clear History Log
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              color: 'var(--admin-text-dim, #94A3B8)',
              background: 'var(--admin-bg-inset, rgba(12, 15, 24, 0.5))',
              borderRadius: '12px',
              border: '1px dashed rgba(255, 255, 255, 0.12)',
              fontSize: '13.5px',
              fontWeight: 600,
            }}
          >
            No announcements have been shared in this session yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {history.map((item) => {
              const pMeta = PRIORITY_META[item.priority || 'INFO'] || PRIORITY_META.INFO;
              const subjectText = item.title || pMeta.defaultSubject;
              return (
                <div
                  key={item.id}
                  style={{
                    padding: '14px 18px',
                    borderRadius: '12px',
                    background: 'var(--admin-bg-inset, rgba(12, 15, 24, 0.6))',
                    border: '1px solid var(--admin-border-subtle, rgba(255, 255, 255, 0.1))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: pMeta.bg,
                          border: `1px solid ${pMeta.border}`,
                          color: pMeta.color,
                          letterSpacing: '0.06em',
                        }}
                      >
                        {pMeta.label}
                      </span>
                      <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--admin-text-main, #FFFFFF)' }}>
                        {subjectText}
                      </span>
                      <span
                        style={{
                          fontSize: '11.5px',
                          color: 'var(--admin-text-dim, #94A3B8)',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 600,
                        }}
                      >
                        {formatBroadcastTimeAmPm(item.createdAt)}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--admin-text-muted, #CBD5E1)', fontWeight: 500, lineHeight: 1.5 }}>
                      {item.message}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() => void handleSendBroadcast(item.message, subjectText, item.priority || 'INFO')}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.14)',
                      background: 'rgba(255, 255, 255, 0.06)',
                      color: '#FFFFFF',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: isSending ? 'wait' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexShrink: 0,
                    }}
                  >
                    <Icon name="refresh" size={13} />
                    Share Again
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

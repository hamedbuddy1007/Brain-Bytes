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
    message: 'Attention candidates: 5 minutes remaining in the current competition round. Ensure all your selected answers are saved.',
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
    message: 'Please remain seated at your assigned terminal and do not refresh or switch browser tabs while scores and qualifications are verified.',
    icon: 'bell',
  },
];

const PRIORITY_META: Record<
  BroadcastPriority,
  { label: string; color: string; bg: string; border: string; desc: string }
> = {
  INFO: {
    label: 'OFFICIAL BROADCAST',
    color: '#EA580C',
    bg: '#FFF7ED',
    border: '#FDBA74',
    desc: 'Standard arena announcement',
  },
  QUALIFICATION: {
    label: 'QUALIFICATION NOTICE',
    color: '#059669',
    bg: '#ECFDF5',
    border: '#6EE7B7',
    desc: 'Round selection & progression alert',
  },
  WARNING: {
    label: 'IMPORTANT WARNING',
    color: '#D97706',
    bg: '#FFFBEB',
    border: '#FCD34D',
    desc: 'Time reminders & proctor instructions',
  },
  URGENT: {
    label: 'URGENT ALERT',
    color: '#DC2626',
    bg: '#FEF2F2',
    border: '#FCA5A5',
    desc: 'Critical high-priority flash alert',
  },
};

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
    const msgToSend = (overrideMsg !== undefined ? overrideMsg : message).trim();
    const titleToSend = (overrideTitle !== undefined ? overrideTitle || '' : title).trim();
    const priorityToSend = overridePriority || priority;

    if (!msgToSend) {
      showToast('Please enter an announcement message to broadcast.', 'error');
      return;
    }

    setIsSending(true);
    try {
      await apiRequest('/admin/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          message: msgToSend,
          title: titleToSend || null,
          priority: priorityToSend,
        }),
      });
      if (overrideMsg === undefined) {
        setMessage('');
        setTitle('');
      }
      await fetchBroadcastData();
      showToast('Announcement broadcasted live to all participant terminals!');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to broadcast announcement.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleClearActiveBroadcast = async () => {
    setIsClearing(true);
    try {
      await apiRequest('/admin/broadcast', { method: 'DELETE' });
      await fetchBroadcastData();
      showToast('Active broadcast cleared from all participant screens.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to clear active broadcast.', 'error');
    } finally {
      setIsClearing(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Clear all past broadcast history logs?')) return;
    try {
      await apiRequest('/admin/broadcasts/history', { method: 'DELETE' });
      await fetchBroadcastData();
      showToast('Broadcast history log cleared.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to clear broadcast history.', 'error');
    }
  };

  const handleApplyTemplate = (tpl: QuickTemplate) => {
    setTitle(tpl.title);
    setMessage(tpl.message);
    setPriority(tpl.priority);
  };

  const currentPriorityMeta = PRIORITY_META[priority] || PRIORITY_META.INFO;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            background: toast.type === 'error' ? '#FEF2F2' : '#ECFDF5',
            border: `1px solid ${toast.type === 'error' ? '#FCA5A5' : '#6EE7B7'}`,
            color: toast.type === 'error' ? '#991B1B' : '#065F46',
            padding: '14px 20px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(15, 23, 42, 0.12)',
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
        className=" stitch-card"
        style={{
          padding: '22px 26px',
          background: activeBroadcast
            ? 'linear-gradient(135deg, #FFF7ED 0%, #FFFFFF 100%)'
            : '#FFFFFF',
          border: activeBroadcast ? '2px solid #FB923C' : '1px solid #E2E8F0',
          borderRadius: '16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 'min(100%, 240px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  background: activeBroadcast ? '#EA580C' : '#F1F5F9',
                  color: activeBroadcast ? '#FFFFFF' : '#64748B',
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: activeBroadcast ? '#FFFFFF' : '#94A3B8',
                  }}
                />
                {activeBroadcast ? 'LIVE ON ALL TERMINALS' : 'NO ACTIVE BROADCAST'}
              </span>

              {activeBroadcast && (
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 800,
                    background: (PRIORITY_META[activeBroadcast.priority] || PRIORITY_META.INFO).bg,
                    color: (PRIORITY_META[activeBroadcast.priority] || PRIORITY_META.INFO).color,
                    border: `1px solid ${(PRIORITY_META[activeBroadcast.priority] || PRIORITY_META.INFO).border}`,
                  }}
                >
                  {(PRIORITY_META[activeBroadcast.priority] || PRIORITY_META.INFO).label}
                </span>
              )}

              {activeBroadcast?.timestamp && (
                <span style={{ fontSize: '12px', color: '#64748B', fontFamily: "'JetBrains Mono', monospace" }}>
                  Sent at {new Date(activeBroadcast.timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>

            {activeBroadcast ? (
              <div>
                {activeBroadcast.title && (
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>
                    {activeBroadcast.title}
                  </div>
                )}
                <p style={{ margin: 0, fontSize: '14.5px', color: '#1E293B', lineHeight: 1.55, fontWeight: 500 }}>
                  "{activeBroadcast.message}"
                </p>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '13.5px', color: '#64748B' }}>
                No broadcast pop-up is currently displayed on participant screens. Compose a message or choose a quick template below to push an announcement to all connected stations.
              </p>
            )}
          </div>

          {activeBroadcast && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={isSending}
                onClick={() =>
                  handleSendBroadcast(
                    activeBroadcast.message,
                    activeBroadcast.title,
                    activeBroadcast.priority,
                  )
                }
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid #F97316',
                  background: '#FFFFFF',
                  color: '#EA580C',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                }}
                title="Re-send with a new timestamp so dismissed pop-ups flash again on all screens"
              >
                <Icon name="refresh" size={15} />
                <span>Re-Flash on All Screens</span>
              </button>

              <button
                type="button"
                disabled={isClearing}
                onClick={handleClearActiveBroadcast}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid #FCA5A5',
                  background: '#FEF2F2',
                  color: '#DC2626',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                }}
              >
                <Icon name="x-circle" size={15} />
                <span>{isClearing ? 'Clearing...' : 'Clear Active Broadcast'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. MAIN COMPOSER & LIVE PREVIEW GRID */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: '20px',
        }}
      >
        {/* Left: Broadcast Composer */}
        <div
          className="stitch-card"
          style={{
            padding: 'clamp(16px, 3vw, 24px)',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#FFF7ED',
                color: '#EA580C',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="bell" size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                Compose Official Announcement
              </h3>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#64748B' }}>
                Pushes an instant flashing notification card to every connected participant terminal
              </p>
            </div>
          </div>

          {/* Priority / Category Selector */}
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '11.5px',
                fontWeight: 800,
                color: '#475569',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '8px',
              }}
            >
              Announcement Category / Priority
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: '8px' }}>
              {(['INFO', 'QUALIFICATION', 'WARNING', 'URGENT'] as BroadcastPriority[]).map((pKey) => {
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
                      border: isSelected ? `2px solid ${meta.color}` : '1px solid #E2E8F0',
                      background: isSelected ? meta.bg : '#F8FAFC',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 800, color: meta.color }}>
                      {meta.label}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                      {meta.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Headline Input */}
          <div style={{ marginBottom: '14px' }}>
            <label
              htmlFor="broadcast-title-input"
              style={{
                display: 'block',
                fontSize: '11.5px',
                fontWeight: 800,
                color: '#475569',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '6px',
              }}
            >
              Headline / Subject (Optional)
            </label>
            <input
              id="broadcast-title-input"
              type="text"
              maxLength={120}
              placeholder="e.g., Round 2 Qualifiers Published / 5 Minutes Remaining"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                fontSize: '13.5px',
                color: '#0F172A',
                background: '#F8FAFC',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Message Body Input */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label
                htmlFor="broadcast-message-input"
                style={{
                  fontSize: '11.5px',
                  fontWeight: 800,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Announcement Message <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <span
                style={{
                  fontSize: '11.5px',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: message.length > 450 ? '#DC2626' : '#64748B',
                }}
              >
                {message.length} / 500
              </span>
            </div>
            <textarea
              id="broadcast-message-input"
              rows={4}
              maxLength={500}
              placeholder="Type the announcement to display across all participant screens..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                fontSize: '14px',
                color: '#0F172A',
                background: '#F8FAFC',
                resize: 'vertical',
                lineHeight: 1.5,
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              disabled={isSending || !message.trim()}
              onClick={() => handleSendBroadcast()}
              style={{
                flex: 1,
                padding: '13px 20px',
                borderRadius: '10px',
                border: 'none',
                background: !message.trim()
                  ? '#CBD5E1'
                  : 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 800,
                cursor: !message.trim() ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: !message.trim() ? 'none' : '0 6px 16px rgba(234, 88, 12, 0.28)',
              }}
            >
              <Icon name="bell" size={17} />
              <span>{isSending ? 'Broadcasting...' : 'Broadcast to All Terminals'}</span>
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
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#475569',
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

        {/* Right: Live Participant Screen Preview & Quick Templates */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Live Preview Card */}
          <div
            className="stitch-card"
            style={{
              padding: '20px 24px',
              background: '#0F172A',
              borderRadius: '16px',
              color: '#FFFFFF',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.08em',
                color: '#94A3B8',
                textTransform: 'uppercase',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>LIVE PARTICIPANT TERMINAL PREVIEW</span>
              <span style={{ color: '#38BDF8' }}>Bottom-Right Pop-up</span>
            </div>

            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '14px',
                padding: '16px 18px',
                border: `2px solid ${currentPriorityMeta.color}`,
                color: '#0F172A',
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.35)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: currentPriorityMeta.bg,
                    color: currentPriorityMeta.color,
                  }}
                >
                  {currentPriorityMeta.label}
                </span>
                <span style={{ fontSize: '11px', color: '#94A3B8' }}>✕</span>
              </div>

              {title.trim() && (
                <div style={{ fontWeight: 800, fontSize: '14px', color: '#0F172A', marginBottom: '4px' }}>
                  {title}
                </div>
              )}

              <div
                style={{
                  fontSize: '13.5px',
                  color: message.trim() ? '#1E293B' : '#94A3B8',
                  lineHeight: 1.5,
                  fontStyle: message.trim() ? 'normal' : 'italic',
                }}
              >
                {message.trim() || 'Your announcement message preview will appear here...'}
              </div>

              <div
                style={{
                  marginTop: '10px',
                  paddingTop: '8px',
                  borderTop: '1px solid #F1F5F9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: '#64748B',
                }}
              >
                <span>Event Administration • Proctors</span>
                <span>Just now</span>
              </div>
            </div>
          </div>

          {/* Quick Templates Grid */}
          <div
            className="stitch-card"
            style={{
              padding: '20px 24px',
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              flex: 1,
            }}
          >
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800, color: '#0F172A' }}>
                Quick Tournament Templates
              </h4>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>
                Click any preset to load it into the composer, or click "Send Now" for instant broadcast
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))',
                gap: '10px',
              }}
            >
              {QUICK_TEMPLATES.map((tpl) => {
                const pMeta = PRIORITY_META[tpl.priority];
                return (
                  <div
                    key={tpl.id}
                    style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      background: '#F8FAFC',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#0F172A' }}>
                          {tpl.label}
                        </span>
                        <span
                          style={{
                            fontSize: '9.5px',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: pMeta.bg,
                            color: pMeta.color,
                          }}
                        >
                          {tpl.priority}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: '4px 0 0',
                          fontSize: '11.5px',
                          color: '#475569',
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {tpl.message}
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleApplyTemplate(tpl)}
                        style={{
                          flex: 1,
                          padding: '5px 8px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          background: '#FFFFFF',
                          color: '#334155',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Edit in Composer
                      </button>
                      <button
                        type="button"
                        disabled={isSending}
                        onClick={() => handleSendBroadcast(tpl.message, tpl.title, tpl.priority)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: 'none',
                          background: pMeta.color,
                          color: '#FFFFFF',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Send Now
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 3. BROADCAST HISTORY LOG */}
      <div
        className="stitch-card"
        style={{
          padding: '22px 26px',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
              Broadcast History Log ({history.length})
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748B' }}>
              Complete audit log of all announcements transmitted during the tournament
            </p>
          </div>

          {history.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: '#F8FAFC',
                color: '#475569',
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
              background: '#F8FAFC',
              borderRadius: '12px',
              color: '#64748B',
              fontSize: '13.5px',
            }}
          >
            No broadcasts have been sent yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {history.map((item) => {
              const pMeta = PRIORITY_META[item.priority] || PRIORITY_META.INFO;
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '14px',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '5px',
                          background: pMeta.bg,
                          color: pMeta.color,
                          border: `1px solid ${pMeta.border}`,
                        }}
                      >
                        {pMeta.label}
                      </span>
                      <span
                        style={{
                          fontSize: '11.5px',
                          color: '#64748B',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {item.title && (
                      <div style={{ fontWeight: 800, fontSize: '13.5px', color: '#0F172A' }}>
                        {item.title}
                      </div>
                    )}
                    <div style={{ fontSize: '13px', color: '#334155', marginTop: '2px' }}>
                      {item.message}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setTitle(item.title || '');
                        setMessage(item.message);
                        setPriority(item.priority || 'INFO');
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '7px',
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        color: '#334155',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      disabled={isSending}
                      onClick={() => handleSendBroadcast(item.message, item.title, item.priority)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '7px',
                        border: '1px solid #F97316',
                        background: '#FFF7ED',
                        color: '#EA580C',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Re-Broadcast
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

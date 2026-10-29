import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from './Icon';
import { apiRequest } from '../services/apiClient';
import type { BroadcastHistoryItem, BroadcastPriority } from '../types/competition';

interface CompetitionStateResponse {
  broadcastMessage?: string | null;
  broadcastTimestamp?: string | null;
  broadcastTitle?: string | null;
  broadcastPriority?: BroadcastPriority | null;
  announcements?: BroadcastHistoryItem[];
}

interface BroadcastNotificationProps {
  currentView?: string;
}

const PRIORITY_CONFIG: Record<
  BroadcastPriority,
  {
    label: string;
    defaultSubject: string;
    borderColor: string;
    tagBg: string;
    tagColor: string;
    accentColor: string;
  }
> = {
  INFO: {
    label: 'OFFICIAL BROADCAST',
    defaultSubject: 'Official Tournament Announcement',
    borderColor: '#E11D48',
    tagBg: 'rgba(225, 29, 72, 0.2)',
    tagColor: '#FDA4AF',
    accentColor: '#F43F5E',
  },
  QUALIFICATION: {
    label: 'QUALIFICATION NOTICE',
    defaultSubject: 'Official Qualification Update',
    borderColor: '#10B981',
    tagBg: 'rgba(16, 185, 129, 0.2)',
    tagColor: '#6EE7B7',
    accentColor: '#34D399',
  },
  WARNING: {
    label: 'IMPORTANT WARNING',
    defaultSubject: 'Important Proctor Notice',
    borderColor: '#F59E0B',
    tagBg: 'rgba(245, 158, 11, 0.2)',
    tagColor: '#FDE68A',
    accentColor: '#FBBF24',
  },
  URGENT: {
    label: 'URGENT ALERT',
    defaultSubject: 'Urgent Tournament Alert',
    borderColor: '#EF4444',
    tagBg: 'rgba(239, 68, 68, 0.24)',
    tagColor: '#FCA5A5',
    accentColor: '#F87171',
  },
};

export function formatAmPmTime(ts?: string | number | Date | null): string {
  try {
    const d = ts ? new Date(ts) : new Date();
    if (Number.isNaN(d.getTime())) {
      return new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'Just now';
  }
}

export const BroadcastNotification: React.FC<BroadcastNotificationProps> = ({ currentView }) => {
  const [broadcast, setBroadcast] = useState<{
    message: string;
    timestamp: string;
    title: string;
    priority: BroadcastPriority;
  } | null>(null);

  const [announcements, setAnnouncements] = useState<BroadcastHistoryItem[]>([]);
  const [isCentreOpen, setIsCentreOpen] = useState(false);

  const [dismissedTimestamp, setDismissedTimestamp] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('bb_dismissed_broadcast_ts');
    } catch {
      return null;
    }
  });

  const [lastSeenTimestamp, setLastSeenTimestamp] = useState<string | null>(() => {
    try {
      return localStorage.getItem('bb_last_seen_announcement_ts');
    } catch {
      return null;
    }
  });

  const handleDismiss = useCallback((tsToDismiss?: string) => {
    const targetTs = tsToDismiss || broadcast?.timestamp;
    if (!targetTs) return;
    try {
      sessionStorage.setItem('bb_dismissed_broadcast_ts', targetTs);
    } catch {}
    setDismissedTimestamp(targetTs);
    setBroadcast(null);
  }, [broadcast]);

  const markAllAnnouncementsRead = useCallback((items: BroadcastHistoryItem[]) => {
    const newestTs = items[0]?.createdAt || broadcast?.timestamp || new Date().toISOString();
    try {
      localStorage.setItem('bb_last_seen_announcement_ts', newestTs);
    } catch {}
    setLastSeenTimestamp(newestTs);
  }, [broadcast]);

  // Listen for custom event from Arena Cockpit header button to open Announcement Centre
  useEffect(() => {
    const handleOpenCentre = () => {
      setIsCentreOpen(true);
    };
    window.addEventListener('bb:open-announcement-centre', handleOpenCentre);
    return () => {
      window.removeEventListener('bb:open-announcement-centre', handleOpenCentre);
    };
  }, []);

  // Mark announcements as read when Announcement Centre is opened
  useEffect(() => {
    if (isCentreOpen && announcements.length > 0) {
      markAllAnnouncementsRead(announcements);
    }
  }, [isCentreOpen, announcements, markAllAnnouncementsRead]);

  // Poll /competition/state for live broadcast + announcement centre list
  useEffect(() => {
    let isMounted = true;

    const checkBroadcast = async () => {
      try {
        const state = await apiRequest<CompetitionStateResponse>('/competition/state');
        if (!isMounted || !state) return;

        // Build announcement list for Announcement Centre
        const serverList = Array.isArray(state.announcements) ? state.announcements : [];
        if (serverList.length > 0) {
          setAnnouncements(serverList);
        } else if (state.broadcastMessage && state.broadcastTimestamp) {
          const prio = state.broadcastPriority || 'INFO';
          setAnnouncements([
            {
              id: 1,
              message: state.broadcastMessage,
              title: state.broadcastTitle || PRIORITY_CONFIG[prio]?.defaultSubject || 'Official Tournament Announcement',
              priority: prio,
              createdAt: state.broadcastTimestamp,
            },
          ]);
        } else {
          setAnnouncements([]);
        }

        // Handle 5-second pop-up for newly shared active broadcast
        if (state.broadcastMessage && state.broadcastTimestamp) {
          const ts = state.broadcastTimestamp;
          const prio = state.broadcastPriority || 'INFO';
          const defaultSubj = PRIORITY_CONFIG[prio]?.defaultSubject || 'Official Tournament Announcement';
          if (ts !== dismissedTimestamp) {
            setBroadcast({
              message: state.broadcastMessage,
              timestamp: ts,
              title: state.broadcastTitle?.trim() || defaultSubj,
              priority: prio,
            });
          } else {
            setBroadcast(null);
          }
        } else {
          setBroadcast(null);
        }
      } catch {
        // Silently tolerate transient network poll glitches
      }
    };

    void checkBroadcast();
    const interval = setInterval(() => void checkBroadcast(), 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [dismissedTimestamp]);

  // Automatically dismiss the floating pop-up after 5 seconds (5000ms)
  // After 5 seconds, it is only viewed in the Participant Announcement Centre
  useEffect(() => {
    if (!broadcast) return;
    const timer = setTimeout(() => {
      handleDismiss(broadcast.timestamp);
    }, 5000);
    return () => clearTimeout(timer);
  }, [broadcast, handleDismiss]);

  // Calculate unread count for Announcement Centre badge
  const unreadCount = announcements.filter((item) => {
    if (!lastSeenTimestamp) return true;
    return new Date(item.createdAt).getTime() > new Date(lastSeenTimestamp).getTime();
  }).length;

  // Broadcast unread/total counts so Arena Header button can also display badge if desired
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('bb:announcement-count-updated', {
        detail: { total: announcements.length, unread: unreadCount },
      }),
    );
  }, [announcements.length, unreadCount]);

  const isParticipantWindow = currentView !== 'admin' && currentView !== 'projector';
  const pStyle = broadcast ? PRIORITY_CONFIG[broadcast.priority] || PRIORITY_CONFIG.INFO : PRIORITY_CONFIG.INFO;

  return (
    <>
      {/* 1. 5-SECOND AUTO-DISMISSING POP-UP NOTIFICATION */}
      {broadcast && isParticipantWindow && (
        <aside
          className="broadcast-notice-container"
          role="alert"
          aria-live="assertive"
          id="live-broadcast-notice"
        >
          <div
            className="broadcast-flashing-card"
            style={{
              borderColor: pStyle.borderColor,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Animated glowing border effect */}
            <div className="broadcast-glow-aura" aria-hidden="true" />

            <div className="broadcast-header">
              <div className="broadcast-title-group">
                <span className="broadcast-beacon">
                  <span className="beacon-ping" style={{ backgroundColor: pStyle.borderColor }} />
                  <span className="beacon-dot" style={{ backgroundColor: pStyle.borderColor }} />
                </span>
                <span
                  className="broadcast-tag"
                  style={{
                    backgroundColor: pStyle.tagBg,
                    color: pStyle.tagColor,
                    border: `1px solid ${pStyle.borderColor}`,
                    padding: '3px 9px',
                    borderRadius: '6px',
                  }}
                >
                  {pStyle.label}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#E2E8F0',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {formatAmPmTime(broadcast.timestamp)}
                </span>
                <button
                  type="button"
                  className="broadcast-close-button"
                  onClick={() => handleDismiss(broadcast.timestamp)}
                  aria-label="Close broadcast notice"
                  title="Dismiss notice (Available in Announcement Centre)"
                  id="btn-close-broadcast"
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
            </div>

            {/* Subject Line & Announcement Message Below It */}
            <div className="broadcast-body">
              <div
                style={{
                  fontWeight: 800,
                  fontSize: '15px',
                  color: '#FFFFFF',
                  marginBottom: '8px',
                  paddingBottom: '7px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.14)',
                  lineHeight: 1.35,
                }}
              >
                {broadcast.title}
              </div>
              <p className="broadcast-message-text" style={{ margin: 0 }}>
                {broadcast.message}
              </p>
            </div>

            <div className="broadcast-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <span className="broadcast-source">Auto-moves to Announcement Centre in 5s</span>
              <button
                type="button"
                onClick={() => {
                  handleDismiss(broadcast.timestamp);
                  setIsCentreOpen(true);
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#FFFFFF',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '4px 9px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                View Centre →
              </button>
            </div>

            {/* 5-Second Visual Countdown Bar */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: 'rgba(255, 255, 255, 0.12)',
              }}
            >
              <div
                key={broadcast.timestamp}
                style={{
                  height: '100%',
                  background: pStyle.accentColor,
                  animation: 'broadcastCountdownBar 5s linear forwards',
                }}
              />
            </div>
          </div>
        </aside>
      )}

      {/* 2. FLOATING ANNOUNCEMENT CENTRE LAUNCHER PILL (On Participant Windows when pop-up is hidden) */}
      {isParticipantWindow && !broadcast && (
        <button
          type="button"
          onClick={() => setIsCentreOpen(true)}
          id="btn-floating-announcement-centre"
          aria-label="Open Participant Announcement Centre"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 9990,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '9px',
            padding: '10px 16px',
            borderRadius: '999px',
            background: unreadCount > 0
              ? 'linear-gradient(135deg, #8E233B 0%, #E11D48 100%)'
              : 'rgba(15, 23, 42, 0.92)',
            border: unreadCount > 0
              ? '1.5px solid #FDA4AF'
              : '1px solid rgba(255, 255, 255, 0.18)',
            color: '#FFFFFF',
            boxShadow: unreadCount > 0
              ? '0 10px 28px rgba(225, 29, 72, 0.45)'
              : '0 8px 24px rgba(15, 23, 42, 0.35)',
            backdropFilter: 'blur(12px)',
            cursor: 'pointer',
            fontSize: '12.5px',
            fontWeight: 800,
            transition: 'all 0.2s ease',
          }}
        >
          <Icon name="bell" size={16} />
          <span>Announcement Centre</span>
          {announcements.length > 0 && (
            <span
              style={{
                padding: '2px 7px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 800,
                background: unreadCount > 0 ? '#FFFFFF' : 'rgba(255, 255, 255, 0.16)',
                color: unreadCount > 0 ? '#9F1239' : '#E2E8F0',
              }}
            >
              {unreadCount > 0 ? `${unreadCount} NEW` : announcements.length}
            </span>
          )}
        </button>
      )}

      {/* 3. PARTICIPANT ANNOUNCEMENT CENTRE DRAWER / MODAL */}
      {isCentreOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Participant Announcement Centre"
          onClick={() => setIsCentreOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(9, 13, 22, 0.68)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(460px, 100vw)',
              height: '100%',
              background: 'linear-gradient(180deg, #0F172A 0%, #131B2E 100%)',
              borderLeft: '1px solid rgba(255, 255, 255, 0.14)',
              boxShadow: '-16px 0 48px rgba(0, 0, 0, 0.55)',
              display: 'flex',
              flexDirection: 'column',
              color: '#FFFFFF',
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: '20px 22px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
                background: 'rgba(142, 35, 59, 0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #8E233B, #B94B68)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    boxShadow: '0 6px 16px rgba(142, 35, 59, 0.4)',
                  }}
                >
                  <Icon name="bell" size={20} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#FFFFFF' }}>
                    Announcement Centre
                  </h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#CBD5E1', fontWeight: 500 }}>
                    Official tournament broadcasts & proctor updates
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCentreOpen(false)}
                aria-label="Close Announcement Centre"
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '9px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: '#CBD5E1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            {/* Drawer Body: List of Announcements */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {announcements.length === 0 ? (
                <div
                  style={{
                    margin: 'auto 0',
                    padding: '36px 20px',
                    textAlign: 'center',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '14px',
                    border: '1px dashed rgba(255, 255, 255, 0.12)',
                  }}
                >
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.06)',
                      color: '#94A3B8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px auto',
                    }}
                  >
                    <Icon name="bell" size={22} />
                  </div>
                  <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#FFFFFF', marginBottom: '4px' }}>
                    No Announcements Yet
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#94A3B8', lineHeight: 1.5 }}>
                    When the tournament host shares an announcement, it will pop up for 5 seconds and remain saved here for your reference.
                  </div>
                </div>
              ) : (
                announcements.map((item, idx) => {
                  const meta = PRIORITY_CONFIG[item.priority || 'INFO'] || PRIORITY_CONFIG.INFO;
                  const subjectLine = item.title?.trim() || meta.defaultSubject;
                  return (
                    <div
                      key={item.id || idx}
                      style={{
                        padding: '16px 18px',
                        borderRadius: '14px',
                        background: idx === 0 ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.75)',
                        border: idx === 0
                          ? `1.5px solid ${meta.borderColor}`
                          : '1px solid rgba(255, 255, 255, 0.12)',
                        boxShadow: idx === 0 ? '0 10px 25px rgba(0, 0, 0, 0.3)' : 'none',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          marginBottom: '10px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              letterSpacing: '0.07em',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: meta.tagBg,
                              color: meta.tagColor,
                              border: `1px solid ${meta.borderColor}`,
                            }}
                          >
                            {meta.label}
                          </span>
                          {idx === 0 && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '2px 7px',
                                borderRadius: '999px',
                                background: 'rgba(255, 255, 255, 0.12)',
                                color: '#F8FAFC',
                              }}
                            >
                              LATEST
                            </span>
                          )}
                        </div>

                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            color: '#94A3B8',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {formatAmPmTime(item.createdAt)}
                        </span>
                      </div>

                      {/* Subject Line */}
                      <div
                        style={{
                          fontSize: '14.5px',
                          fontWeight: 800,
                          color: '#FFFFFF',
                          marginBottom: '8px',
                          paddingBottom: '7px',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                          lineHeight: 1.35,
                        }}
                      >
                        {subjectLine}
                      </div>

                      {/* Announcement Message Below Subject Line */}
                      <div
                        style={{
                          fontSize: '13.5px',
                          fontWeight: 500,
                          color: '#E2E8F0',
                          lineHeight: 1.55,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {item.message}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer */}
            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(9, 13, 22, 0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: '#94A3B8',
              }}
            >
              <span>Synced live with Event Control</span>
              <button
                type="button"
                onClick={() => setIsCentreOpen(false)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

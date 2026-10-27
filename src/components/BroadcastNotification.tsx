import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { apiRequest } from '../services/apiClient';

interface CompetitionStateResponse {
  broadcastMessage?: string | null;
  broadcastTimestamp?: string | null;
}

export const BroadcastNotification: React.FC = () => {
  const [broadcast, setBroadcast] = useState<{ message: string; timestamp: string } | null>(null);
  const [dismissedTimestamp, setDismissedTimestamp] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('bb_dismissed_broadcast_ts');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let isMounted = true;

    const checkBroadcast = async () => {
      try {
        const state = await apiRequest<CompetitionStateResponse>('/competition/state');
        if (!isMounted) return;

        if (state?.broadcastMessage && state?.broadcastTimestamp) {
          const ts = state.broadcastTimestamp;
          // Only show if not previously dismissed by the user for this exact broadcast timestamp
          if (ts !== dismissedTimestamp) {
            setBroadcast({
              message: state.broadcastMessage,
              timestamp: ts,
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
    const interval = setInterval(checkBroadcast, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [dismissedTimestamp]);

  const handleDismiss = () => {
    if (!broadcast) return;
    try {
      sessionStorage.setItem('bb_dismissed_broadcast_ts', broadcast.timestamp);
    } catch {}
    setDismissedTimestamp(broadcast.timestamp);
    setBroadcast(null);
  };

  if (!broadcast) return null;

  const formattedTime = (() => {
    try {
      return new Date(broadcast.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return 'Just now';
    }
  })();

  return (
    <aside
      className="broadcast-notice-container"
      role="alert"
      aria-live="assertive"
      id="live-broadcast-notice"
    >
      <div className="broadcast-flashing-card">
        {/* Animated glowing border effect */}
        <div className="broadcast-glow-aura" aria-hidden="true" />

        <div className="broadcast-header">
          <div className="broadcast-title-group">
            <span className="broadcast-beacon">
              <span className="beacon-ping" />
              <span className="beacon-dot" />
            </span>
            <span className="broadcast-tag">OFFICIAL BROADCAST</span>
          </div>

          <button
            type="button"
            className="broadcast-close-button"
            onClick={handleDismiss}
            aria-label="Close broadcast notice"
            title="Dismiss notice"
            id="btn-close-broadcast"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="broadcast-body">
          <p className="broadcast-message-text">{broadcast.message}</p>
        </div>

        <div className="broadcast-footer">
          <span className="broadcast-source">Event Administration • Proctors</span>
          <span className="broadcast-timestamp">{formattedTime}</span>
        </div>
      </div>
    </aside>
  );
};

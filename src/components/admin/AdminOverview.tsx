import React, { useState } from 'react';
import { Icon } from '../Icon';
import type { AdminSettings, RoundStatus } from '../../types/competition';
import { ADMIN_AUDIT_LOGS } from '../../data/adminMockData';
import { resetRoundState } from '../../services/competitionStateService';

interface AdminOverviewProps {
  settings: AdminSettings;
  onUpdateSettings: (newSettings: AdminSettings) => void;
  onNavigateTab: (tabId: string) => void;
  onOpenProjector: () => void;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({
  settings,
  onUpdateSettings,
  onNavigateTab,
  onOpenProjector,
}) => {
  const [broadcastMessage, setBroadcastMessage] = useState<string | null>(null);

  const handleSetRoundState = (roundId: 1 | 2 | 3, newStatus: RoundStatus) => {
    onUpdateSettings({
      ...settings,
      roundStates: {
        ...settings.roundStates,
        [roundId]: newStatus,
      },
    });
  };

  const handleBroadcast = () => {
    const msg = prompt('Enter announcement for participant terminals:', 'Notice: 3 minutes remaining in current round.');
    if (msg) {
      setBroadcastMessage(msg);
      setTimeout(() => setBroadcastMessage(null), 8000);
    }
  };

  const r1State = settings.roundStates[1];
  const r2State = settings.roundStates[2];
  const r3State = settings.roundStates[3];

  const currentRoundNumber = r1State === 'active' ? 1 : r2State === 'active' ? 2 : r3State === 'active' ? 3 : 1;
  const currentRoundName =
    currentRoundNumber === 1 ? 'Round 1 — Data MCQ' : currentRoundNumber === 2 ? 'Round 2 — Graph Challenge' : 'Round 3 — Rapid Fire';
  const currentRoundStatus = settings.roundStates[currentRoundNumber] || 'locked';

  return (
    <div className="overview-container">
      {/* Active Broadcast Alert */}
      {broadcastMessage && (
        <div className="admin-broadcast-banner">
          <div className="broadcast-left">
            <Icon name="message-square" size={16} />
            <span><strong>Broadcast Active:</strong> &quot;{broadcastMessage}&quot;</span>
          </div>
          <button
            type="button"
            className="btn-dismiss-broadcast"
            onClick={() => setBroadcastMessage(null)}
            aria-label="Dismiss broadcast"
          >
            ✕
          </button>
        </div>
      )}

      {/* 4 Clear Summary Cards */}
      <section className="overview-kpis-grid" aria-label="Competition Summary">
        {/* Card 1: Registered Participants */}
        <div
          className="overview-kpi-card"
          onClick={() => onNavigateTab('participants')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') onNavigateTab('participants'); }}
        >
          <div className="kpi-card-header">
            <span>REGISTERED PARTICIPANTS</span>
            <span className="kpi-tag">REGISTRY</span>
          </div>
          <div className="kpi-card-number">342</div>
          <div className="kpi-card-subtext">Verified competitors enrolled (demo baseline)</div>
          <div className="kpi-card-footer">
            <span>Auditorium Hall B</span>
            <span className="kpi-action-link">View Roster →</span>
          </div>
        </div>

        {/* Card 2: Active Attempts */}
        <div
          className="overview-kpi-card"
          onClick={() => onNavigateTab('participants')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') onNavigateTab('participants'); }}
        >
          <div className="kpi-card-header">
            <span>ACTIVE ATTEMPTS</span>
            <span className="kpi-tag-maroon">IN-SESSION</span>
          </div>
          <div className="kpi-card-number" style={{ color: 'var(--maroon-highlight)' }}>128</div>
          <div className="kpi-card-subtext">Candidates actively attempting round</div>
          <div className="kpi-card-footer">
            <span>Real-time sessions</span>
            <span className="kpi-action-link">Inspect →</span>
          </div>
        </div>

        {/* Card 3: Completed Attempts */}
        <div
          className="overview-kpi-card"
          onClick={() => onNavigateTab('results')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') onNavigateTab('results'); }}
        >
          <div className="kpi-card-header">
            <span>COMPLETED ATTEMPTS</span>
            <span className="kpi-tag">SUBMISSIONS</span>
          </div>
          <div className="kpi-card-number">194</div>
          <div className="kpi-card-subtext">Evaluations submitted and scored</div>
          <div className="kpi-card-footer">
            <span>Avg score: 15.00 pts</span>
            <span className="kpi-action-link">Reports →</span>
          </div>
        </div>

        {/* Card 4: Current Round */}
        <div
          className="overview-kpi-card kpi-card-current-round"
          onClick={() => onNavigateTab('round-control')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') onNavigateTab('round-control'); }}
        >
          <div className="kpi-card-header">
            <span>CURRENT ROUND</span>
            <span className={currentRoundStatus === 'active' ? 'kpi-tag-active' : 'kpi-tag'}>
              {currentRoundStatus === 'active' ? 'GATE: ACTIVE' : 'LOCKED'}
            </span>
          </div>
          <div className="kpi-card-number kpi-round-title">{currentRoundName}</div>
          <div className="kpi-card-subtext">
            {currentRoundNumber === 3 ? '3 minutes limit' : '10 minutes limit'} • {currentRoundStatus === 'active' ? '07m 42s remaining' : 'Ready to start'}
          </div>
          <div className="kpi-card-footer">
            <span>Round Control</span>
            <span className="kpi-action-link">Manage →</span>
          </div>
        </div>
      </section>

      {/* Main Overview Body: Progress Chart + Current Round Status + Recent Activity */}
      <div className="overview-main-grid">
        {/* Column 1: Competition Progress Chart & Overview */}
        <div className="admin-panel-card">
          <div className="panel-card-header">
            <div className="panel-title-group">
              <Icon name="bar-chart-2" size={17} className="panel-header-icon" />
              <div>
                <h3 className="panel-title">Competition Progress</h3>
                <span className="panel-subtitle">Candidate progression across competition stages (demo figures)</span>
              </div>
            </div>
            <button
              type="button"
              className="btn-card-action"
              onClick={onOpenProjector}
            >
              <Icon name="monitor" size={14} />
              <span>Projector</span>
            </button>
          </div>

          <div className="progress-bars-container">
            {/* Round 1 Progress */}
            <div className="progress-bar-row">
              <div className="progress-bar-label-group">
                <span className="bar-round-name">Round 1 — Data MCQ (10 mins)</span>
                <span className="bar-round-stats">194 / 342 completed <strong>(57%)</strong></span>
              </div>
              <div className="progress-track-bg">
                <div className="progress-track-fill" style={{ width: '57%', backgroundColor: 'var(--maroon-primary)' }} />
              </div>
            </div>

            {/* Round 2 Progress */}
            <div className="progress-bar-row">
              <div className="progress-bar-label-group">
                <span className="bar-round-name">Round 2 — Graph Challenge (10 mins)</span>
                <span className="bar-round-stats">42 / 128 qualified <strong>(33%)</strong></span>
              </div>
              <div className="progress-track-bg">
                <div className="progress-track-fill" style={{ width: '33%', backgroundColor: 'var(--maroon-highlight)' }} />
              </div>
            </div>

            {/* Round 3 Progress */}
            <div className="progress-bar-row">
              <div className="progress-bar-label-group">
                <span className="bar-round-name">Round 3 — Rapid Fire (3 mins)</span>
                <span className="bar-round-stats">0 / 30 finalists <strong>(Standby)</strong></span>
              </div>
              <div className="progress-track-bg">
                <div className="progress-track-fill" style={{ width: '0%', backgroundColor: 'var(--border-strong)' }} />
              </div>
            </div>
          </div>

          <div className="panel-card-footer-stats">
            <div>Total Evaluation Throughput: <strong>194 Candidates Scored</strong></div>
            <div>Top Candidate Cutoff: <strong>14.25 PTS</strong></div>
          </div>
        </div>

        {/* Column 2: Current Round Status Details */}
        <div className="admin-panel-card">
          <div className="panel-card-header">
            <div className="panel-title-group">
              <Icon name="sliders" size={17} className="panel-header-icon" />
              <div>
                <h3 className="panel-title">Current Round Status</h3>
                <span className="panel-subtitle">Live control & operational status for active stage</span>
              </div>
            </div>
            <span className={`status-pill ${currentRoundStatus === 'active' ? 'is-active' : 'is-locked'}`}>
              {currentRoundStatus === 'active' ? 'Active' : 'Locked'}
            </span>
          </div>

          <div className="round-status-details-box">
            <div className="status-detail-item">
              <span className="detail-label">Active Round</span>
              <span className="detail-value">{currentRoundName}</span>
            </div>
            <div className="status-detail-item">
              <span className="detail-label">Duration</span>
              <span className="detail-value">{currentRoundNumber === 3 ? '3 minutes' : '10 minutes'}</span>
            </div>
            <div className="status-detail-item">
              <span className="detail-label">Gate Access</span>
              <span className="detail-value" style={{ color: currentRoundStatus === 'active' ? 'var(--color-success)' : 'var(--text-muted)' }}>
                {currentRoundStatus === 'active' ? 'Open for candidate login' : 'Entry restricted'}
              </span>
            </div>
            <div className="status-detail-item">
              <span className="detail-label">Time Remaining (Cohort)</span>
              <span className="detail-value" style={{ color: 'var(--maroon-highlight)' }}>07m 42s</span>
            </div>
          </div>

          <div className="round-quick-actions">
            {currentRoundStatus === 'active' ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleSetRoundState(currentRoundNumber as 1 | 2 | 3, 'locked')}
              >
                <Icon name="lock" size={14} />
                <span>Lock Round Entry</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleSetRoundState(currentRoundNumber as 1 | 2 | 3, 'active')}
              >
                <Icon name="play" size={14} />
                <span>Commence Round</span>
              </button>
            )}

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleBroadcast}
            >
              <Icon name="message-square" size={14} />
              <span>Broadcast Notice</span>
            </button>

            <button
              type="button"
              className="btn btn-danger-outline"
              onClick={() => {
                if (window.confirm(`CONFIRM RESET: Are you sure you want to reset all entries and participant progress for ${currentRoundName}?`)) {
                  resetRoundState(currentRoundNumber as 1 | 2 | 3);
                  alert(`${currentRoundName} has been reset. All entries and candidate progress cleared.`);
                }
              }}
              title="Reset entries and participant progress for this round"
            >
              <Icon name="refresh-cw" size={14} />
              <span>Reset Round</span>
            </button>
          </div>
        </div>
      </div>

      {/* Short Recent Activity List */}
      <section className="admin-panel-card" aria-label="Recent Activity">
        <div className="panel-card-header">
          <div className="panel-title-group">
            <Icon name="activity" size={17} className="panel-header-icon" />
            <div>
              <h3 className="panel-title">Recent Activity</h3>
              <span className="panel-subtitle">Official tournament log and competitor events</span>
            </div>
          </div>
          <span className="badge-demo-label">Audit Log (Demo Data)</span>
        </div>

        <div className="recent-activity-list">
          {ADMIN_AUDIT_LOGS.map((log, idx) => (
            <div key={idx} className="activity-item-row">
              <span className="activity-time">{log.time}</span>
              <span className="activity-node">[{log.node}]</span>
              <span className="activity-message">{log.message}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

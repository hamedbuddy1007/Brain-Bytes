import React, { useState } from 'react';
import { Icon } from '../Icon';
import type { AdminSettings } from '../../types/competition';
import { resetRoundState } from '../../services/competitionStateService';

interface AdminSettingsViewProps {
  settings: AdminSettings;
  onUpdateSettings: (newSettings: AdminSettings) => void;
  onResetAll?: () => void;
}

export const AdminSettingsView: React.FC<AdminSettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onResetAll,
}) => {
  const [eventName, setEventName] = useState('DATA MANIA — BRAIN BYTES');
  const [auditorium, setAuditorium] = useState('Auditorium Hall B // Cluster 01');
  const [newCodeInput, setNewCodeInput] = useState('');
  const [isPublicLeaderboard, setIsPublicLeaderboard] = useState(true);
  const [selectedResetRound, setSelectedResetRound] = useState<1 | 2 | 3>(1);

  // Join Code Handlers
  const handleAddCode = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCodeInput.trim().toUpperCase();
    if (!trimmed) return;
    if (settings.activeJoinCodes.includes(trimmed)) {
      alert('This join code is already registered.');
      return;
    }
    onUpdateSettings({
      ...settings,
      activeJoinCodes: [...settings.activeJoinCodes, trimmed],
    });
    setNewCodeInput('');
  };

  const handleRemoveCode = (code: string) => {
    if (settings.activeJoinCodes.length <= 1) {
      alert('At least one join code must remain active for participant authentication.');
      return;
    }
    onUpdateSettings({
      ...settings,
      activeJoinCodes: settings.activeJoinCodes.filter((c) => c !== code),
    });
  };

  const handleSaveMetadata = () => {
    alert('Tournament metadata and stage configuration saved.');
  };

  return (
    <div className="overview-container">
      {/* Header */}
      <div className="screen-header-block">
        <div className="screen-pretitle">
          <span className="red-square" />
          <span>ADMINISTRATIVE CONFIGURATION & TOURNAMENT PARAMETERS</span>
        </div>
        <h1 className="screen-maintitle">SYSTEM & EVENT SETTINGS</h1>
      </div>

      <div className="overview-bottom-split">
        {/* Left Column: Metadata & Timing Defaults */}
        <div className="admin-subpanel-card">
          <div className="subpanel-header">
            <div className="subpanel-title-group">
              <Icon name="settings" size={16} style={{ color: '#8E233B' }} />
              <span>COMPETITION METADATA</span>
            </div>
            <span style={{ color: '#22C55E', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.74rem', fontWeight: 800 }}>
              CONFIG: ACTIVE
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '8px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#B8B2B7', display: 'block', marginBottom: '6px' }}>
                TOURNAMENT TITLE
              </label>
              <input
                type="text"
                className="search-input-field"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: '#B8B2B7', display: 'block', marginBottom: '6px' }}>
                LOCATION / AUDITORIUM CLUSTER
              </label>
              <input
                type="text"
                className="search-input-field"
                value={auditorium}
                onChange={(e) => setAuditorium(e.target.value)}
              />
            </div>

            <div style={{ background: '#202124', border: '1px solid #414047', borderRadius: '6px', padding: '14px' }}>
              <div style={{ fontSize: '0.75rem', color: '#F5F3F4', fontWeight: 700, marginBottom: '8px' }}>
                STANDARD ROUND DURATIONS
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontFamily: 'JetBrains Mono, monospace', color: '#B8B2B7' }}>
                <span>Round 1: 10 mins</span>
                <span>Round 2: 10 mins</span>
                <span>Round 3: 3 mins</span>
              </div>
            </div>

            <button
              type="button"
              className="btn-admin-primary"
              style={{ alignSelf: 'flex-start' }}
              onClick={handleSaveMetadata}
            >
              SAVE METADATA
            </button>
          </div>
        </div>

        {/* Right Column: Join Codes & Arena Visibility */}
        <div className="admin-subpanel-card">
          <div className="subpanel-header">
            <div className="subpanel-title-group">
              <Icon name="key" size={16} style={{ color: '#8E233B' }} />
              <span>EVENT JOIN CODES</span>
            </div>
            <span style={{ color: '#B94B68', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.74rem', fontWeight: 800 }}>
              {settings.activeJoinCodes.length} REGISTERED
            </span>
          </div>

          <form onSubmit={handleAddCode} style={{ display: 'flex', gap: '8px', margin: '8px 0' }}>
            <input
              type="text"
              className="search-input-field"
              placeholder="New Join Code (e.g. BRAIN2026)"
              value={newCodeInput}
              onChange={(e) => setNewCodeInput(e.target.value)}
            />
            <button type="submit" className="btn-admin-primary">
              ADD
            </button>
          </form>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', minHeight: '60px', marginTop: '6px' }}>
            {settings.activeJoinCodes.map((code) => (
              <div
                key={code}
                style={{
                  background: '#202124',
                  border: '1px solid #414047',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <span style={{ color: '#F5F3F4', fontWeight: 700 }}>{code}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveCode(code)}
                  style={{ background: 'transparent', border: 'none', color: '#B8B2B7', cursor: 'pointer', padding: 0, fontSize: '0.85rem' }}
                  title="Remove code"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Public Arena Leaderboard Publishing */}
          <div style={{
            borderTop: '1px solid #414047',
            paddingTop: '16px',
            marginTop: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#F5F3F4' }}>
                ARENA LEADERBOARD VISIBILITY
              </div>
              <div style={{ fontSize: '0.74rem', color: '#B8B2B7', marginTop: '2px' }}>
                Controls whether participants can view the live standings
              </div>
            </div>
            <button
              type="button"
              className={`state-toggle-btn ${isPublicLeaderboard ? 'is-active-live' : 'is-active-paused'}`}
              onClick={() => setIsPublicLeaderboard(!isPublicLeaderboard)}
            >
              {isPublicLeaderboard ? 'PUBLIC' : 'MUTED'}
            </button>
          </div>
        </div>
      </div>

      {/* Stage-Specific Reset Panel */}
      <div style={{
        marginTop: '20px',
        background: '#202124',
        border: '1px solid #414047',
        borderLeft: '4px solid #EF4444',
        borderRadius: '8px',
        padding: '18px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ color: '#F5F3F4', fontWeight: 800, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="refresh-cw" size={15} style={{ color: '#EF4444' }} />
              <span>RESET SELECTED EVENT / STAGE</span>
            </div>
            <div style={{ color: '#B8B2B7', fontSize: '0.78rem', marginTop: '3px' }}>
              Purges all submissions, candidate progress, and timers for the selected stage without affecting other rounds.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <select
              value={selectedResetRound}
              onChange={(e) => setSelectedResetRound(Number(e.target.value) as 1 | 2 | 3)}
              style={{
                background: '#292A2E',
                color: '#F5F3F4',
                border: '1px solid #414047',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '0.82rem',
                fontFamily: 'Inter, sans-serif',
                cursor: 'pointer'
              }}
            >
              <option value={1}>Round 1 — Data MCQ</option>
              <option value={2}>Round 2 — Graph Challenge</option>
              <option value={3}>Round 3 — Rapid Fire</option>
            </select>

            <button
              type="button"
              className="btn-admin-danger"
              onClick={() => {
                const roundTitle =
                  selectedResetRound === 1
                    ? 'Round 1 (Data MCQ)'
                    : selectedResetRound === 2
                    ? 'Round 2 (Graph Challenge)'
                    : 'Round 3 (Rapid Fire)';
                if (window.confirm(`CONFIRM STAGE RESET: Reset all entries and candidate progress for ${roundTitle}?`)) {
                  const res = resetRoundState(selectedResetRound);
                  alert(`Successfully reset ${roundTitle}! Cleared ${res.deletedSubmissionsCount} submissions and ${res.clearedProgressCount} in-progress candidate sheets.`);
                }
              }}
            >
              <Icon name="refresh-cw" size={14} />
              <span>RESET ROUND {selectedResetRound}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dangerous Action Area */}
      <div style={{
        marginTop: '20px',
        background: 'rgba(239, 68, 68, 0.06)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '8px',
        padding: '18px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div>
          <div style={{ color: '#EF4444', fontWeight: 800, fontSize: '0.9rem' }}>
            RESET SIMULATED SESSION
          </div>
          <div style={{ color: '#B8B2B7', fontSize: '0.76rem', marginTop: '3px' }}>
            Purges locally cached simulated participant state and restarts the demo environment.
          </div>
        </div>
        <button
          type="button"
          className="btn-admin-danger"
          onClick={() => {
            if (window.confirm('CONFIRM PURGE: Are you sure you want to reset all local mock session data?')) {
              if (onResetAll) onResetAll();
              window.location.reload();
            }
          }}
        >
          <Icon name="refresh-cw" size={14} />
          <span>RESET LOCAL SESSION</span>
        </button>
      </div>
    </div>
  );
};

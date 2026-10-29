import React, { useState, useEffect } from 'react';
import { Icon } from '../Icon';
import type { AdminSettings } from '../../types/competition';
import { resetRoundState, purgeAllTournamentData } from '../../services/competitionStateService';
import { apiRequest } from '../../services/apiClient';

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
  const [eventName, setEventName] = useState(() => {
    try {
      return localStorage.getItem('bb_admin_event_name') || 'DATA MANIA — BRAIN BYTES';
    } catch {
      return 'DATA MANIA — BRAIN BYTES';
    }
  });
  const [auditorium, setAuditorium] = useState(() => {
    try {
      return localStorage.getItem('bb_admin_auditorium') || 'Auditorium Hall B // Cluster 01';
    } catch {
      return 'Auditorium Hall B // Cluster 01';
    }
  });
  const [isRegistrationOpen, setIsRegistrationOpen] = useState<boolean>(settings.isRegistrationOpen ?? true);
  const [isPublicLeaderboard, setIsPublicLeaderboard] = useState<boolean>(() => Boolean(settings.leaderboardPublished));

  // Admin password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [durationsMin, setDurationsMin] = useState<{ 1: number; 2: number; 3: number }>(() => {
    try {
      const saved = localStorage.getItem('bb_admin_durations');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          1: Number(parsed['1']) || 10,
          2: Number(parsed['2']) || 10,
          3: Number(parsed['3']) || 3,
        };
      }
    } catch {
      // ignore
    }
    return { 1: 10, 2: 10, 3: 3 };
  });

  const [selectedResetRound, setSelectedResetRound] = useState<1 | 2 | 3>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isResettingRound, setIsResettingRound] = useState(false);
  const [isPurgingAttempts, setIsPurgingAttempts] = useState(false);
  const [isPurgingDb, setIsPurgingDb] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    setIsRegistrationOpen(settings.isRegistrationOpen ?? true);
  }, [settings.isRegistrationOpen]);

  useEffect(() => {
    setIsPublicLeaderboard(Boolean(settings.leaderboardPublished));
  }, [settings.leaderboardPublished]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const sanitizeSettingText = (val: string, maxLen = 100) =>
    val.replace(/[\x00-\x1F\x7F<>]/g, '').slice(0, maxLen);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const r1Min = Math.min(120, Math.max(1, Number(durationsMin[1]) || 10));
      const r2Min = Math.min(120, Math.max(1, Number(durationsMin[2]) || 10));
      const r3Min = Math.min(120, Math.max(1, Number(durationsMin[3]) || 3));
      const cleanEventName = sanitizeSettingText(eventName, 100).trim() || 'DATA MANIA — BRAIN BYTES';
      const cleanAuditorium = sanitizeSettingText(auditorium, 100).trim() || 'Auditorium Hall B // Cluster 01';

      try {
        localStorage.setItem('bb_admin_event_name', cleanEventName);
        localStorage.setItem('bb_admin_auditorium', cleanAuditorium);
        localStorage.setItem('bb_admin_public_leaderboard', String(isPublicLeaderboard));
        localStorage.setItem(
          'bb_admin_durations',
          JSON.stringify({ '1': r1Min, '2': r2Min, '3': r3Min }),
        );
      } catch {
        // ignore storage quota errors
      }

      const nextSettings: AdminSettings = {
        ...settings,
        isRegistrationOpen,
        leaderboardPublished: isPublicLeaderboard,
      };
      onUpdateSettings(nextSettings);

      await apiRequest('/admin/competition/state', {
        method: 'PATCH',
        body: JSON.stringify({
          registrationOpen: isRegistrationOpen,
          leaderboardPublished: isPublicLeaderboard,
          roundDurations: {
            '1': r1Min * 60,
            '2': r2Min * 60,
            '3': r3Min * 60,
          },
        }),
      });

      showToast('All tournament settings and round durations saved to database!');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save settings.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdminPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isChangingPassword) return;
    if (!currentPassword) {
      showToast('Please enter your current admin password.', 'error');
      return;
    }
    if (!newPassword || newPassword.length < 12) {
      showToast('New password must contain at least 12 characters.', 'error');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showToast('New password and confirmation do not match.', 'error');
      return;
    }

    setIsChangingPassword(true);
    try {
      await apiRequest('/auth/admin/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      showToast('Admin password rotated and bcrypt-hashed successfully!');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update admin password.', 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleResetSelectedRound = async () => {
    const roundTitle =
      selectedResetRound === 1
        ? 'Round 1 (Data MCQ)'
        : selectedResetRound === 2
          ? 'Round 2 (Graph Challenge)'
          : 'Round 3 (Rapid Fire)';

    if (!window.confirm(`CONFIRM STAGE RESET: Reset all database entries, submissions, and candidate progress for ${roundTitle}?`)) {
      return;
    }

    setIsResettingRound(true);
    try {
      await apiRequest(`/admin/rounds/${selectedResetRound}/reset`, { method: 'POST' });
      resetRoundState(selectedResetRound);
      showToast(`Successfully reset ${roundTitle}! All attempts and progress for this round were cleared.`);
    } catch (err) {
      showToast(`Reset failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setIsResettingRound(false);
    }
  };

  const handleResetAllAttemptsOnly = async () => {
    if (!window.confirm('CONFIRM ATTEMPTS RESET: Clear all round attempts, answers, and scores while keeping registered participants and their access codes intact?')) {
      return;
    }

    setIsPurgingAttempts(true);
    try {
      await apiRequest('/admin/reset-attempts', { method: 'POST' });
      resetRoundState(1);
      resetRoundState(2);
      resetRoundState(3);
      showToast('All round attempts and scores cleared! Registered participants are retained.');
    } catch (err) {
      showToast(`Failed to reset attempts: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setIsPurgingAttempts(false);
    }
  };

  const handlePurgeDatabase = async () => {
    if (
      !window.confirm(
        'CONFIRM FULL DATABASE PURGE: Are you sure you want to completely purge the tournament database (all participants, access codes, attempts, scores, and qualification records)? This action cannot be undone.',
      )
    ) {
      return;
    }

    setIsPurgingDb(true);
    try {
      await apiRequest('/admin/reset-all', { method: 'POST' });
      purgeAllTournamentData();
      if (onResetAll) onResetAll();
      showToast('Tournament database completely purged! Reloading console...');
      setTimeout(() => {
        window.location.reload();
      }, 900);
    } catch (err) {
      showToast(`Database purge failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      setIsPurgingDb(false);
    }
  };

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
            background: toast.type === 'error' ? 'rgba(127, 29, 29, 0.96)' : 'rgba(6, 78, 59, 0.96)',
            border: `1px solid ${toast.type === 'error' ? 'rgba(248, 113, 113, 0.55)' : 'rgba(52, 211, 153, 0.55)'}`,
            color: '#FFFFFF',
            padding: '14px 20px',
            borderRadius: '12px',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.55)',
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

      {/* Header */}
      <div
        className="screen-header-block"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div>
          <div className="screen-pretitle">
            <span className="red-square" />
            <span>ADMINISTRATIVE CONFIGURATION & DATABASE MANAGEMENT</span>
          </div>
          <h1 className="screen-maintitle" style={{ margin: 0 }}>
            SYSTEM & EVENT SETTINGS
          </h1>
        </div>

        <button
          type="button"
          onClick={() => void handleSaveSettings()}
          disabled={isSaving}
          id="btn-save-settings-top"
          style={{
            padding: '12px 22px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'linear-gradient(135deg, var(--admin-maroon-primary, #8E233B), var(--admin-maroon-highlight, #B94B68))',
            color: '#FFFFFF',
            fontSize: '13.5px',
            fontWeight: 800,
            cursor: isSaving ? 'wait' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 8px 24px rgba(142, 35, 59, 0.45)',
          }}
        >
          <Icon name="check-circle" size={16} />
          <span>{isSaving ? 'Saving Settings...' : 'Save Settings'}</span>
        </button>
      </div>

      <div className="overview-bottom-split">
        {/* Left Column: Metadata & Timing Defaults */}
        <div className="admin-subpanel-card">
          <div className="subpanel-header">
            <div className="subpanel-title-group">
              <Icon name="settings" size={16} style={{ color: '#B94B68' }} />
              <span>COMPETITION METADATA & TIMERS</span>
            </div>
            <span style={{ color: '#22C55E', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.74rem', fontWeight: 800 }}>
              CONFIG: ACTIVE
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#CBD5E1', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                TOURNAMENT TITLE
              </label>
              <input
                type="text"
                className="search-input-field"
                maxLength={100}
                value={eventName}
                onChange={(e) => setEventName(sanitizeSettingText(e.target.value, 100))}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: '#CBD5E1', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                LOCATION / AUDITORIUM CLUSTER
              </label>
              <input
                type="text"
                className="search-input-field"
                maxLength={100}
                value={auditorium}
                onChange={(e) => setAuditorium(sanitizeSettingText(e.target.value, 100))}
                style={{ width: '100%' }}
              />
            </div>

            <div
              style={{
                background: 'var(--admin-bg-inset, rgba(12, 15, 24, 0.65))',
                border: '1px solid var(--admin-border-subtle, rgba(255, 255, 255, 0.12))',
                borderRadius: '10px',
                padding: '14px',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#FFFFFF', fontWeight: 800, marginBottom: '10px', letterSpacing: '0.05em' }}>
                ROUND DURATION CONFIGURATION (MINUTES)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {([1, 2, 3] as const).map((rId) => (
                  <div key={rId}>
                    <label style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                      Round {rId} (mins)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={durationsMin[rId]}
                      onChange={(e) =>
                        setDurationsMin((prev) => ({
                          ...prev,
                          [rId]: Number(e.target.value) || 1,
                        }))
                      }
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: 'rgba(20, 24, 38, 0.9)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#FFFFFF',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        fontFamily: 'var(--admin-mono-font)',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleSaveSettings()}
              disabled={isSaving}
              id="btn-save-settings-card"
              style={{
                padding: '12px 20px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: 'linear-gradient(135deg, var(--admin-maroon-primary, #8E233B), var(--admin-maroon-highlight, #B94B68))',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 800,
                cursor: isSaving ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 6px 20px rgba(142, 35, 59, 0.4)',
                width: '100%',
              }}
            >
              <Icon name="check-circle" size={16} />
              <span>{isSaving ? 'SAVING SETTINGS...' : 'SAVE SETTINGS'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Registration, Access Codes & Arena Visibility */}
        <div className="admin-subpanel-card">
          <div className="subpanel-header">
            <div className="subpanel-title-group">
              <Icon name="key" size={16} style={{ color: '#B94B68' }} />
              <span>ACCESS & PORTAL CONTROLS</span>
            </div>
            <span style={{ color: '#22C55E', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.74rem', fontWeight: 800 }}>
              INDIVIDUAL CODES
            </span>
          </div>

          <div
            style={{
              background: 'var(--admin-bg-inset, rgba(12, 15, 24, 0.65))',
              border: '1px solid var(--admin-border-subtle, rgba(255, 255, 255, 0.12))',
              borderRadius: '10px',
              padding: '14px',
              marginTop: '8px',
            }}
          >
            <div style={{ fontSize: '0.8rem', color: '#FFFFFF', fontWeight: 700, marginBottom: '6px' }}>
              INDIVIDUAL PARTICIPANT ACCESS CODES
            </div>
            <p style={{ fontSize: '0.76rem', color: '#CBD5E1', lineHeight: 1.5, margin: 0 }}>
              Each participant receives a unique proctor-approved Access Code (e.g. <code>DS-XXXX</code>) upon registration. Participants log in with their Access Code to enter the Competition Arena.
            </p>
          </div>

          {/* Participant Registration Portal Toggle */}
          <div
            style={{
              borderTop: '1px solid var(--admin-border-subtle, rgba(255, 255, 255, 0.12))',
              paddingTop: '16px',
              marginTop: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#FFFFFF' }}>
                PARTICIPANT REGISTRATION PORTAL
              </div>
              <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '2px' }}>
                Allow new participants to submit registration requests
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsRegistrationOpen((prev) => !prev)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '0.76rem',
                cursor: 'pointer',
                border: isRegistrationOpen
                  ? '1px solid rgba(34, 197, 94, 0.5)'
                  : '1px solid rgba(239, 68, 68, 0.5)',
                background: isRegistrationOpen
                  ? 'rgba(34, 197, 94, 0.18)'
                  : 'rgba(239, 68, 68, 0.18)',
                color: isRegistrationOpen ? '#4ADE80' : '#FCA5A5',
              }}
            >
              {isRegistrationOpen ? 'OPEN' : 'CLOSED'}
            </button>
          </div>

          {/* Public Arena Leaderboard Publishing */}
          <div
            style={{
              borderTop: '1px solid var(--admin-border-subtle, rgba(255, 255, 255, 0.12))',
              paddingTop: '16px',
              marginTop: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#FFFFFF' }}>
                ARENA LEADERBOARD VISIBILITY
              </div>
              <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '2px' }}>
                Controls whether participants can view the live standings
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPublicLeaderboard((prev) => !prev)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '0.76rem',
                cursor: 'pointer',
                border: isPublicLeaderboard
                  ? '1px solid rgba(34, 197, 94, 0.5)'
                  : '1px solid rgba(245, 158, 11, 0.5)',
                background: isPublicLeaderboard
                  ? 'rgba(34, 197, 94, 0.18)'
                  : 'rgba(245, 158, 11, 0.18)',
                color: isPublicLeaderboard ? '#4ADE80' : '#FCD34D',
              }}
            >
              {isPublicLeaderboard ? 'PUBLIC' : 'MUTED'}
            </button>
          </div>

          {/* Admin Password Rotation (bcrypt cost-12) */}
          <form
            onSubmit={(e) => void handleAdminPasswordChange(e)}
            style={{
              borderTop: '1px solid var(--admin-border-subtle, rgba(255, 255, 255, 0.12))',
              paddingTop: '16px',
              marginTop: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icon name="lock" size={14} style={{ color: '#38BDF8' }} />
              <span>ROTATE ADMIN PASSWORD (BCRYPT-12)</span>
            </div>
            <input
              type="password"
              className="search-input-field"
              placeholder="Current admin password"
              autoComplete="current-password"
              maxLength={256}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input
                type="password"
                className="search-input-field"
                placeholder="New password (min 12 chars)"
                autoComplete="new-password"
                minLength={12}
                maxLength={256}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ width: '100%' }}
              />
              <input
                type="password"
                className="search-input-field"
                placeholder="Confirm new password"
                autoComplete="new-password"
                minLength={12}
                maxLength={256}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <button
              type="submit"
              disabled={isChangingPassword}
              className="btn btn-secondary btn-sm"
              style={{ alignSelf: 'flex-start', borderColor: '#38BDF8', color: '#38BDF8', fontWeight: 700 }}
            >
              <Icon name="shield" size={13} />
              <span>{isChangingPassword ? 'Updating Password...' : 'Update Admin Password'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Stage-Specific Reset Panel */}
      <div
        style={{
          background: 'var(--admin-bg-panel, rgba(20, 24, 38, 0.72))',
          border: '1px solid var(--admin-border-subtle, rgba(255, 255, 255, 0.12))',
          borderLeft: '4px solid #F59E0B',
          borderRadius: '14px',
          padding: '20px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ flex: 1, minWidth: '240px' }}>
          <div style={{ color: '#FFFFFF', fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="refresh-cw" size={16} style={{ color: '#F59E0B' }} />
            <span>RESET SELECTED ROUND / STAGE</span>
          </div>
          <div style={{ color: '#CBD5E1', fontSize: '0.8rem', marginTop: '4px' }}>
            Clears all submissions, candidate progress, and qualification records for the selected stage without affecting other rounds.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <select
            value={selectedResetRound}
            onChange={(e) => setSelectedResetRound(Number(e.target.value) as 1 | 2 | 3)}
            style={{
              background: 'rgba(12, 15, 24, 0.9)',
              color: '#FFFFFF',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '9px',
              padding: '10px 14px',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <option value={1}>Round 1 — Data MCQ</option>
            <option value={2}>Round 2 — Graph Challenge</option>
            <option value={3}>Round 3 — Rapid Fire</option>
          </select>

          <button
            type="button"
            disabled={isResettingRound}
            onClick={() => void handleResetSelectedRound()}
            style={{
              padding: '10px 18px',
              borderRadius: '9px',
              border: '1px solid rgba(245, 158, 11, 0.5)',
              background: 'rgba(245, 158, 11, 0.2)',
              color: '#FDE68A',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: isResettingRound ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Icon name="refresh-cw" size={14} />
            <span>{isResettingRound ? 'RESETTING...' : `RESET ROUND ${selectedResetRound}`}</span>
          </button>
        </div>
      </div>

      {/* Database Purge & Rehearsal Cleanup Panel */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(127, 29, 29, 0.24) 0%, rgba(20, 24, 38, 0.85) 100%)',
          border: '1.5px solid rgba(239, 68, 68, 0.45)',
          borderRadius: '14px',
          padding: '22px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <div style={{ color: '#FCA5A5', fontWeight: 800, fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="alert-triangle" size={18} style={{ color: '#EF4444' }} />
              <span>DATABASE PURGE & RESET CONTROLS</span>
            </div>
            <div style={{ color: '#CBD5E1', fontSize: '0.82rem', marginTop: '4px', lineHeight: 1.5 }}>
              Reset all round attempts while keeping registered participants, or completely purge the entire PostgreSQL tournament database (participants, attempts, scores, and audit logs) before starting a fresh event.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={isPurgingAttempts}
              onClick={() => void handleResetAllAttemptsOnly()}
              id="btn-reset-all-attempts"
              style={{
                padding: '12px 18px',
                borderRadius: '10px',
                border: '1px solid rgba(248, 113, 113, 0.45)',
                background: 'rgba(239, 68, 68, 0.16)',
                color: '#FECACA',
                fontSize: '0.82rem',
                fontWeight: 800,
                cursor: isPurgingAttempts ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Icon name="refresh-cw" size={15} />
              <span>{isPurgingAttempts ? 'CLEARING ATTEMPTS...' : 'RESET ALL ATTEMPTS'}</span>
            </button>

            <button
              type="button"
              disabled={isPurgingDb}
              onClick={() => void handlePurgeDatabase()}
              id="btn-purge-tournament-database"
              style={{
                padding: '12px 20px',
                borderRadius: '10px',
                border: '1px solid rgba(252, 165, 165, 0.5)',
                background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
                color: '#FFFFFF',
                fontSize: '0.84rem',
                fontWeight: 800,
                cursor: isPurgingDb ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 8px 24px rgba(220, 38, 38, 0.4)',
              }}
            >
              <Icon name="trash" size={15} />
              <span>{isPurgingDb ? 'PURGING DATABASE...' : 'PURGE TOURNAMENT DATABASE'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../Icon';
import type { RegistryParticipant } from '../../types/competition';

import { apiRequest } from '../../services/apiClient';
import { clearAllAttemptsOnly, purgeAllTournamentData } from '../../services/competitionStateService';

interface AdminParticipantsProps {
  onReturnToOverview?: () => void;
  onInspectParticipantAnswers?: (participantId: string) => void;
}

export const AdminParticipants: React.FC<AdminParticipantsProps> = ({
  onInspectParticipantAnswers,
}) => {
  const [participants, setParticipants] = useState<RegistryParticipant[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roundFilter, setRoundFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [extendingRound, setExtendingRound] = useState<number | null>(null);
  const [extendToast, setExtendToast] = useState<string | null>(null);
  const [selectedExtendRound, setSelectedExtendRound] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    if (!extendToast) return;
    const t = setTimeout(() => setExtendToast(null), 6000);
    return () => clearTimeout(t);
  }, [extendToast]);

  const handleExtendTimeIndividual = async (participantId: string | number, roundId: 1 | 2 | 3, minutes: number) => {
    if (extendingRound !== null) return;
    setExtendingRound(roundId);
    try {
      const res = await apiRequest<{
        success: boolean;
        participantId: number;
        roundId: number;
        additionalMinutes: number;
        message?: string;
      }>(`/admin/participants/${participantId}/extend-time`, {
        method: 'POST',
        body: JSON.stringify({ roundId, additionalMinutes: minutes }),
      });
      setExtendToast(res?.message || `Successfully added +${minutes} minute(s) to candidate for Round ${roundId}!`);
      void loadParticipants();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to extend time.';
      alert(`Could not extend time: ${msg}`);
    } finally {
      setExtendingRound(null);
    }
  };

  const loadParticipants = useCallback(async () => {
    try {
      const data = await apiRequest<RegistryParticipant[]>('/admin/participants');
      setParticipants(data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve participants from database.';
      setError(message);
      setParticipants([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Used by the Refresh buttons
  const fetchParticipants = () => {
    setIsLoading(true);
    setError(null);
    void loadParticipants();
  };

  useEffect(() => {
    let active = true;
    apiRequest<RegistryParticipant[]>('/admin/participants')
      .then((data) => {
        if (active) setParticipants(data || []);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to retrieve participants from database.');
        setParticipants([]);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Selected participant object (if any selected)
  const selectedParticipant = participants.find((p) => p.id === selectedId) || null;

  // Filter participants
  const filteredList = participants.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      (p.campus || '').toLowerCase().includes(q) ||
      p.rollNumber.toLowerCase().includes(q);

    const matchesRound =
      roundFilter === 'ALL' ||
      (p.participatingRounds ? p.participatingRounds.includes(roundFilter) : (p.round || '').includes(roundFilter));

    let matchesStatus = statusFilter === 'ALL';
    if (!matchesStatus) {
      const activeRoundKey = roundFilter === 'R-01' ? 1 : roundFilter === 'R-02' ? 2 : roundFilter === 'R-03' ? 3 : null;
      if (activeRoundKey && p.rounds?.[activeRoundKey]) {
        const r = p.rounds[activeRoundKey];
        matchesStatus =
          (statusFilter === 'IN_PROGRESS' && r.status === 'IN_PROGRESS') ||
          (statusFilter === 'COMPLETED' && r.status === 'COMPLETED');
      } else {
        matchesStatus =
          (statusFilter === 'FLAGGED' && p.statusType.startsWith('flagged')) ||
          (statusFilter === 'IN_PROGRESS' && p.statusType === 'in-progress') ||
          (statusFilter === 'COMPLETED' && p.statusType === 'completed');
      }
    }

    return matchesSearch && matchesRound && matchesStatus;
  });

  const handleRowClick = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  const handleApproveParticipant = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await apiRequest<{ success: boolean; participant: { id: number; access_code: string; approval_status: string } }>(
        `/admin/participants/${id}/approve`,
        { method: 'POST' }
      );
      if (res?.success) {
        setParticipants((prev) =>
          prev.map((p) =>
            p.id === id ? { ...p, approvalStatus: 'APPROVED', accessCode: res.participant.access_code } : p
          )
        );
      }
    } catch (err) {
      alert(`Failed to approve participant: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleRejectParticipant = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm('Are you sure you want to reject this participant registration?')) return;
    try {
      const res = await apiRequest<{ success: boolean }>(`/admin/participants/${id}/reject`, { method: 'POST' });
      if (res?.success) {
        setParticipants((prev) =>
          prev.map((p) => (p.id === id ? { ...p, approvalStatus: 'REJECTED' } : p))
        );
      }
    } catch (err) {
      alert(`Failed to reject participant: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleQualifyOverride = async (id: string, targetRound: 2 | 3, qualified: boolean) => {
    try {
      await apiRequest(`/admin/participants/${id}/qualify-override`, {
        method: 'POST',
        body: JSON.stringify({ targetRound, qualified }),
      });
      await fetchParticipants();
    } catch (err) {
      alert(`Failed to update qualification status: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleApproveAll = async () => {
    const pendingCount = participants.filter((p) => (p.approvalStatus || 'PENDING') === 'PENDING').length;
    if (pendingCount === 0) {
      alert('There are no pending participant registrations to approve.');
      return;
    }
    if (!window.confirm(`Approve all ${pendingCount} pending participant registrations? Access codes will be issued to their screens.`)) {
      return;
    }
    try {
      setIsLoading(true);
      await apiRequest('/admin/participants/approve-all', { method: 'POST' });
      await loadParticipants();
    } catch (err) {
      alert(`Failed to approve all participants: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  const handleResetAttemptsKeepParticipants = async () => {
    if (window.confirm('RESET ALL ATTEMPTS: Are you sure you want to reset all round attempts? Registered participants will remain in the database, but all round scores and attempt answers will be cleared so they can take the rounds again.')) {
      try {
        setIsLoading(true);
        await apiRequest('/admin/reset-attempts', { method: 'POST' });
        clearAllAttemptsOnly();
        await loadParticipants();
        alert('All participant attempts have been successfully reset. Participants remain registered.');
      } catch (err) {
        alert(`Failed to reset attempts: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleResetAllParticipantsAndAttempts = async () => {
    if (window.confirm('DANGER PURGE: Are you sure you want to completely purge ALL participants and attempts? This removes all participant registrations, attempts, answers, and scores from the database.')) {
      try {
        setIsLoading(true);
        await apiRequest('/admin/reset-all', { method: 'POST' });
        purgeAllTournamentData();
        await loadParticipants();
        alert('All participants and attempts have been completely reset.');
      } catch (err) {
        alert(`Failed to reset tournament: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="overview-container">
      {/* Header */}
      <div className="screen-header-block" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="screen-maintitle">Participants</h1>
          <p className="screen-subtitle">Authoritative Neon PostgreSQL participant registry & live round submissions</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleApproveAll}
            disabled={isLoading}
            style={{
              borderColor: '#16A34A',
              color: '#22C55E',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              fontWeight: 700,
            }}
            title="Approve all waiting registrations and issue access codes"
          >
            <Icon name="check-circle" size={14} />
            <span>Approve All Pending {participants.filter((p) => (p.approvalStatus || 'PENDING') === 'PENDING').length > 0 ? `(${participants.filter((p) => (p.approvalStatus || 'PENDING') === 'PENDING').length})` : ''}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleResetAttemptsKeepParticipants}
            disabled={isLoading}
            style={{
              borderColor: '#F59E0B',
              color: '#F59E0B',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              fontWeight: 700,
            }}
            title="Reset all attempts, submissions, and scores while keeping participant registrations"
          >
            <Icon name="refresh-cw" size={14} />
            <span>Keep Participants & Reset Attempts</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleResetAllParticipantsAndAttempts}
            disabled={isLoading}
            style={{
              borderColor: '#EF4444',
              color: '#EF4444',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              fontWeight: 700,
            }}
            title="Purge all participant entries, attempts, answers, and qualifications"
          >
            <Icon name="trash" size={14} />
            <span>Reset Participants Entry & Attempts</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={fetchParticipants}
            disabled={isLoading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Icon name="refresh" size={15} />
            <span>{isLoading ? 'Syncing...' : 'Refresh Registry'}</span>
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="form-error-alert" role="alert" style={{ marginBottom: '16px' }}>
          <Icon name="alert-circle" size={18} />
          <div style={{ flex: 1 }}>
            <strong>Database synchronization error:</strong> {error}
          </div>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={fetchParticipants}
            style={{ marginLeft: '12px' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="registry-filter-bar">
        <div className="filter-left-cluster">
          <div className="search-input-wrapper">
            <Icon name="search" size={15} className="search-icon-inside" />
            <input
              type="text"
              className="search-input-field"
              placeholder="Search by name, roll number, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search participants"
            />
          </div>

          <div className="state-toggles-group" role="group" aria-label="Round filter">
            <button
              type="button"
              className={`state-toggle-btn ${roundFilter === 'ALL' ? 'is-active-btn' : ''}`}
              onClick={() => setRoundFilter('ALL')}
            >
              All Rounds
            </button>
            <button
              type="button"
              className={`state-toggle-btn ${roundFilter === 'R-01' ? 'is-active-btn' : ''}`}
              onClick={() => setRoundFilter('R-01')}
            >
              Round 1
            </button>
            <button
              type="button"
              className={`state-toggle-btn ${roundFilter === 'R-02' ? 'is-active-btn' : ''}`}
              onClick={() => setRoundFilter('R-02')}
            >
              Round 2
            </button>
            <button
              type="button"
              className={`state-toggle-btn ${roundFilter === 'R-03' ? 'is-active-btn' : ''}`}
              onClick={() => setRoundFilter('R-03')}
            >
              Round 3
            </button>
          </div>

          <div className="state-toggles-group" role="group" aria-label="Status filter">
            <button
              type="button"
              className={`state-toggle-btn ${statusFilter === 'ALL' ? 'is-active-btn' : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              All Statuses
            </button>
            <button
              type="button"
              className={`state-toggle-btn ${statusFilter === 'IN_PROGRESS' ? 'is-active-btn' : ''}`}
              onClick={() => setStatusFilter('IN_PROGRESS')}
            >
              In-Progress
            </button>
            <button
              type="button"
              className={`state-toggle-btn ${statusFilter === 'FLAGGED' ? 'is-active-btn' : ''}`}
              onClick={() => setStatusFilter('FLAGGED')}
            >
              Flagged
            </button>
            <button
              type="button"
              className={`state-toggle-btn ${statusFilter === 'COMPLETED' ? 'is-active-btn' : ''}`}
              onClick={() => setStatusFilter('COMPLETED')}
            >
              Completed
            </button>
          </div>
        </div>

        <div className="filter-right-cluster">
          <span className="registry-count-label">
            Showing <strong>{filteredList.length}</strong> of {participants.length} candidates
          </span>
        </div>
      </div>

      {/* Extension Toast Notification */}
      {extendToast && (
        <div style={{
          background: 'rgba(34, 197, 94, 0.15)',
          border: '1px solid rgba(34, 197, 94, 0.4)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#4ADE80',
          fontWeight: 600,
          fontSize: '0.9rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="check-circle" size={18} />
            <span>{extendToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setExtendToast(null)}
            style={{ background: 'none', border: 'none', color: '#4ADE80', cursor: 'pointer', fontSize: '1rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Table + Optional Side Panel Layout */}
      <div className={`participants-layout-split ${selectedParticipant ? 'has-side-panel' : ''}`}>
        {/* Table Container */}
        <div className="registry-table-card">
          <div className="table-top-meta">
            <div>Neon PostgreSQL Live Registry</div>
            <div className="table-hint-text">Click any row to inspect candidate attempts and details</div>
          </div>

          <div className="table-scroll-wrapper">
            <table className="custom-data-table" aria-label="Participants table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Roll Number</th>
                  <th>Dept / Year</th>
                  <th>Access Code</th>
                  <th>Approval Status</th>
                  <th>Round Progress (R1 / R2 / R3)</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <Icon name="refresh" size={16} />
                        <span>Querying Neon PostgreSQL participants...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                      {participants.length === 0 ? (
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                            No participants registered yet in Neon PostgreSQL database.
                          </div>
                          <div>Once participants register through the registration page, their records will appear here live.</div>
                        </div>
                      ) : (
                        'No participants match the specified search or filter criteria.'
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredList.map((p) => {
                    const isSelected = p.id === selectedId;

                    return (
                      <tr
                        key={p.id}
                        className={`table-row-clickable ${isSelected ? 'is-row-selected' : ''}`}
                        onClick={() => handleRowClick(p.id)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRowClick(p.id);
                        }}
                      >
                        <td>
                          <span className="cell-candidate-name">{p.name}</span>
                        </td>
                        <td>
                          <span className="cell-roll-number">{p.rollNumber}</span>
                        </td>
                        <td>
                          <span className="cell-campus-name" style={{ fontSize: '0.8rem' }}>
                            {p.department || 'CSE'} • {p.yearOfStudy || '1st Year'}
                          </span>
                        </td>
                        <td>
                          <code style={{
                            background: '#1E293B',
                            color: '#38BDF8',
                            padding: '3px 7px',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            letterSpacing: '0.05em'
                          }}>
                            {p.accessCode || '—'}
                          </code>
                        </td>
                        <td>
                          {p.approvalStatus === 'APPROVED' ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'rgba(34, 197, 94, 0.15)',
                              color: '#22C55E',
                              border: '1px solid rgba(34, 197, 94, 0.35)',
                              borderRadius: '12px',
                              padding: '2px 8px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                            }}>
                              ✓ APPROVED
                            </span>
                          ) : p.approvalStatus === 'REJECTED' ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#EF4444',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              borderRadius: '12px',
                              padding: '2px 8px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                            }}>
                              ✕ REJECTED
                            </span>
                          ) : (
                            <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={(e) => handleApproveParticipant(p.id, e)}
                                style={{
                                  background: '#16A34A',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '4px 10px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                                title="Approve candidate and issue access code"
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleRejectParticipant(p.id, e)}
                                style={{
                                  background: 'transparent',
                                  color: '#EF4444',
                                  border: '1px solid #EF4444',
                                  borderRadius: '4px',
                                  padding: '3px 8px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                                title="Reject registration"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                        <td>
                          {/* Dedicated R1, R2, R3 Badges */}
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span
                              className={`round-pill-badge ${p.rounds?.[1]?.status === 'COMPLETED'
                                  ? 'is-completed'
                                  : p.rounds?.[1]?.status === 'IN_PROGRESS'
                                    ? 'is-in-progress'
                                    : 'is-eligible'
                                }`}
                              title={`Round 1: ${p.rounds?.[1]?.status || 'READY'}`}
                            >
                              R1: {p.rounds?.[1]?.status === 'COMPLETED' ? 'SUBMITTED' : p.rounds?.[1]?.status || 'READY'}
                            </span>
                            <span
                              className={`round-pill-badge ${p.rounds?.[2]?.status === 'COMPLETED'
                                  ? 'is-completed'
                                  : p.rounds?.[2]?.status === 'IN_PROGRESS'
                                    ? 'is-in-progress'
                                    : p.rounds?.[2]?.status === 'ELIGIBLE'
                                      ? 'is-eligible'
                                      : 'is-locked'
                                }`}
                              style={
                                p.rounds?.[2]?.status === 'NOT_QUALIFIED'
                                  ? { background: 'rgba(239, 68, 68, 0.14)', color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.35)' }
                                  : undefined
                              }
                              title={`Round 2: ${p.rounds?.[2]?.status || 'LOCKED'}`}
                            >
                              R2: {p.rounds?.[2]?.status === 'COMPLETED'
                                ? 'SUBMITTED'
                                : p.rounds?.[2]?.status === 'ELIGIBLE'
                                  ? 'QUALIFIED'
                                  : p.rounds?.[2]?.status === 'NOT_QUALIFIED'
                                    ? 'NOT QUALIFIED'
                                    : p.rounds?.[2]?.status || 'LOCKED'}
                            </span>
                            <span
                              className={`round-pill-badge ${p.rounds?.[3]?.status === 'COMPLETED'
                                  ? 'is-completed'
                                  : p.rounds?.[3]?.status === 'IN_PROGRESS'
                                    ? 'is-in-progress'
                                    : p.rounds?.[3]?.status === 'ELIGIBLE'
                                      ? 'is-eligible'
                                      : 'is-locked'
                                }`}
                              style={
                                p.rounds?.[3]?.status === 'NOT_QUALIFIED'
                                  ? { background: 'rgba(239, 68, 68, 0.14)', color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.35)' }
                                  : undefined
                              }
                              title={`Round 3: ${p.rounds?.[3]?.status || 'LOCKED'}`}
                            >
                              R3: {p.rounds?.[3]?.status === 'COMPLETED'
                                ? 'SUBMITTED'
                                : p.rounds?.[3]?.status === 'ELIGIBLE'
                                  ? 'QUALIFIED'
                                  : p.rounds?.[3]?.status === 'NOT_QUALIFIED'
                                    ? 'NOT QUALIFIED'
                                    : p.rounds?.[3]?.status || 'LOCKED'}
                            </span>
                          </div>
                        </td>
                        <td>
                          {(() => {
                            const r1 = p.rounds?.[1];
                            const r2 = p.rounds?.[2];
                            const r3 = p.rounds?.[3];

                            if (roundFilter === 'R-01') {
                              return (
                                <span className="cell-score-value">
                                  {r1 && r1.score !== null ? `${r1.score} pts` : ' '}
                                  {r1 && r1.score !== null && (
                                    <small style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>
                                      ({r1.solvedCount}/20)
                                    </small>
                                  )}
                                </span>
                              );
                            }
                            if (roundFilter === 'R-02') {
                              return (
                                <span className="cell-score-value">
                                  {r2 && r2.score !== null ? `${r2.score} pts` : ' '}
                                  {r2 && r2.score !== null && (
                                    <small style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>
                                      ({r2.solvedCount}/5)
                                    </small>
                                  )}
                                </span>
                              );
                            }
                            if (roundFilter === 'R-03') {
                              return (
                                <span className="cell-score-value">
                                  {r3 && r3.score !== null ? `${r3.score} pts` : ' '}
                                  {r3 && r3.score !== null && (
                                    <small style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>
                                      ({r3.solvedCount}/5)
                                    </small>
                                  )}
                                </span>
                              );
                            }
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div>
                                  <span className="cell-score-value">{p.totalScore ?? 0} pts</span>
                                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    R1: {r1 && r1.score !== null ? `${r1.score}` : '—'} | R2: {r2 && r2.score !== null ? `${r2.score}` : '—'} | R3: {r3 && r3.score !== null ? `${r3.score}` : '—'}
                                  </div>
                                </div>
                                {onInspectParticipantAnswers && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onInspectParticipantAnswers(p.id);
                                    }}
                                    style={{
                                      alignSelf: 'flex-start',
                                      background: 'rgba(56, 189, 248, 0.14)',
                                      border: '1px solid rgba(56, 189, 248, 0.35)',
                                      color: '#38BDF8',
                                      borderRadius: '6px',
                                      padding: '3px 8px',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Check Answers →
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side Panel: Shown ONLY when a participant row is selected */}
        {selectedParticipant && (
          <aside className="participant-side-panel" aria-label="Participant details">
            <div className="side-panel-header">
              <div className="side-panel-title-group">
                <h3 className="side-panel-title">Participant Details</h3>
                <span className="side-panel-subtitle">ID: {selectedParticipant.rollNumber}</span>
              </div>
              <button
                type="button"
                className="btn-close-side-panel"
                onClick={() => setSelectedId(null)}
                aria-label="Close participant details panel"
              >
                ✕
              </button>
            </div>

            <div className="side-panel-body">
              {/* Participant Profile Card */}
              <div className="side-profile-summary">
                <div className="side-avatar-circle">
                  {selectedParticipant.name.charAt(0)}
                </div>
                <div className="side-profile-text">
                  <h4 className="side-profile-name">{selectedParticipant.name}</h4>
                  <span className="side-profile-campus">{selectedParticipant.campus}</span>
                </div>
              </div>

              {onInspectParticipantAnswers && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => onInspectParticipantAnswers(selectedParticipant.id)}
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    marginBottom: '14px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 800,
                  }}
                >
                  <Icon name="file-text" size={15} />
                  <span>Check Individual Question Answers</span>
                </button>
              )}

              {/* Information Grid */}
              <div className="side-info-list">
                <div className="side-info-row">
                  <span className="info-row-label">Roll Number:</span>
                  <span className="info-row-value">{selectedParticipant.rollNumber}</span>
                </div>
                <div className="side-info-row">
                  <span className="info-row-label">Department / Year:</span>
                  <span className="info-row-value">{selectedParticipant.department || 'CSE'} • {selectedParticipant.yearOfStudy || '1st Year'}</span>
                </div>
                <div className="side-info-row">
                  <span className="info-row-label">Access Code:</span>
                  <span className="info-row-value" style={{ fontFamily: 'monospace', fontWeight: 800, color: '#38BDF8' }}>
                    {selectedParticipant.accessCode || '—'}
                  </span>
                </div>
                <div className="side-info-row">
                  <span className="info-row-label">Approval Status:</span>
                  <span className="info-row-value">
                    {selectedParticipant.approvalStatus === 'APPROVED' ? (
                      <span style={{ color: '#22C55E', fontWeight: 700 }}>✓ Approved</span>
                    ) : selectedParticipant.approvalStatus === 'REJECTED' ? (
                      <span style={{ color: '#EF4444', fontWeight: 700 }}>✕ Rejected</span>
                    ) : (
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleApproveParticipant(selectedParticipant.id)}
                          style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px 8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Approve Now
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectParticipant(selectedParticipant.id)}
                          style={{ background: 'transparent', color: '#EF4444', border: '1px solid #EF4444', borderRadius: '4px', padding: '2px 6px', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </span>
                </div>
                <div className="side-info-row">
                  <span className="info-row-label">Assigned Station:</span>
                  <span className="info-row-value">{selectedParticipant.node}</span>
                </div>
                <div className="side-info-row">
                  <span className="info-row-label">Total Verified Score:</span>
                  <span className="info-row-value" style={{ color: 'var(--admin-emerald)', fontWeight: 800 }}>
                    {selectedParticipant.totalScore ?? 0} pts
                  </span>
                </div>

                {/* Round 1 Breakdown */}
                {(() => {
                  const spR1 = selectedParticipant.rounds?.[1];
                  const spR2 = selectedParticipant.rounds?.[2];
                  const spR3 = selectedParticipant.rounds?.[3];

                  const formatTimerValue = (seconds?: number | null) => {
                    if (seconds === null || seconds === undefined || isNaN(Number(seconds))) return '--';
                    const totalMs = Math.round(Number(seconds) * 1000);
                    const minutes = Math.floor(totalMs / 60000);
                    const sec = Math.floor((totalMs % 60000) / 1000);
                    const ms = totalMs % 1000;
                    return `${String(minutes).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
                  };

                  return (
                    <>
                      <div className="side-round-card">
                        <div className="side-round-card-header">
                          <strong>Round 1: Data MCQ</strong>
                          <span className={`status-badge ${spR1?.status === 'COMPLETED'
                              ? 'badge-completed'
                              : spR1?.status === 'IN_PROGRESS'
                                ? 'badge-in-progress'
                                : 'badge-eligible'
                            }`}>
                            {spR1?.status === 'COMPLETED' ? 'SUBMITTED' : spR1?.status || 'READY'}
                          </span>
                        </div>
                        <div className="side-round-card-body">
                          <div>Score: <strong>{spR1 && spR1.score !== null ? `${spR1.score} / 20 pts` : 'Not submitted'}</strong></div>
                          {spR1?.submitted && (
                            <div>Correct: {spR1.solvedCount}/20 &nbsp;•&nbsp; Time: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{formatTimerValue(spR1.timeTakenSeconds)}</span></div>
                          )}
                        </div>
                      </div>

                      {/* Round 2 Breakdown */}
                      <div className="side-round-card">
                        <div className="side-round-card-header">
                          <strong>Round 2: Graph Challenge</strong>
                          <span className={`status-badge ${spR2?.status === 'COMPLETED'
                              ? 'badge-completed'
                              : spR2?.status === 'IN_PROGRESS'
                                ? 'badge-in-progress'
                                : spR2?.status === 'ELIGIBLE'
                                  ? 'badge-eligible'
                                  : 'badge-locked'
                            }`}>
                            {spR2?.status === 'COMPLETED'
                              ? 'SUBMITTED'
                              : spR2?.status === 'ELIGIBLE'
                                ? 'QUALIFIED'
                                : spR2?.status === 'NOT_QUALIFIED'
                                  ? 'NOT QUALIFIED'
                                  : spR2?.status || 'LOCKED'}
                          </span>
                        </div>
                        <div className="side-round-card-body">
                          <div>Score: <strong>{spR2 && spR2.score !== null ? `${spR2.score} / 30 pts` : spR2?.eligible ? 'Qualified (Not attempted)' : spR2?.status === 'NOT_QUALIFIED' ? 'Not Qualified' : 'Locked'}</strong></div>
                          {spR2?.submitted && (
                            <div>Correct: {spR2.solvedCount}/30 &nbsp;•&nbsp; Time: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{formatTimerValue(spR2.timeTakenSeconds)}</span></div>
                          )}
                          <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
                            {!spR2?.eligible ? (
                              <button
                                type="button"
                                onClick={() => handleQualifyOverride(selectedParticipant.id, 2, true)}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #16A34A',
                                  background: '#ECFDF5',
                                  color: '#15803D',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                + Qualify for Round 2
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleQualifyOverride(selectedParticipant.id, 2, false)}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #EF4444',
                                  background: '#FEF2F2',
                                  color: '#DC2626',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                Revoke Round 2 Qualification
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Round 3 Breakdown */}
                      <div className="side-round-card">
                        <div className="side-round-card-header">
                          <strong>Round 3: Rapid Fire</strong>
                          <span className={`status-badge ${spR3?.status === 'COMPLETED'
                              ? 'badge-completed'
                              : spR3?.status === 'IN_PROGRESS'
                                ? 'badge-in-progress'
                                : spR3?.status === 'ELIGIBLE'
                                  ? 'badge-eligible'
                                  : 'badge-locked'
                            }`}>
                            {spR3?.status === 'COMPLETED'
                              ? 'SUBMITTED'
                              : spR3?.status === 'ELIGIBLE'
                                ? 'QUALIFIED'
                                : spR3?.status === 'NOT_QUALIFIED'
                                  ? 'NOT QUALIFIED'
                                  : spR3?.status || 'LOCKED'}
                          </span>
                        </div>
                        <div className="side-round-card-body">
                          <div>Score: <strong>{spR3 && spR3.score !== null ? `${spR3.score} pts` : spR3?.eligible ? 'Qualified (Not attempted)' : spR3?.status === 'NOT_QUALIFIED' ? 'Not Qualified' : 'Locked'}</strong></div>
                          {spR3?.submitted && (
                            <div>Correct: {spR3.solvedCount}/30 &nbsp;•&nbsp; Time: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{formatTimerValue(spR3.timeTakenSeconds)}</span></div>
                          )}
                          <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
                            {!spR3?.eligible ? (
                              <button
                                type="button"
                                onClick={() => handleQualifyOverride(selectedParticipant.id, 3, true)}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #16A34A',
                                  background: '#ECFDF5',
                                  color: '#15803D',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                + Qualify for Round 3
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleQualifyOverride(selectedParticipant.id, 3, false)}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #EF4444',
                                  background: '#FEF2F2',
                                  color: '#DC2626',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                Revoke Round 3 Qualification
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Individual Time Extension Section */}
                      <div className="side-round-card" style={{ border: '1px solid rgba(56, 189, 248, 0.4)', background: 'rgba(15, 23, 42, 0.5)' }}>
                        <div className="side-round-card-header" style={{ borderBottom: '1px solid rgba(56, 189, 248, 0.2)', paddingBottom: '6px' }}>
                          <strong style={{ color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Icon name="clock" size={14} />
                            <span>Individual Time Extension</span>
                          </strong>
                          <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>ALL 3 ROUNDS</span>
                        </div>
                        <div className="side-round-card-body" style={{ marginTop: '8px' }}>
                          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                            {([1, 2, 3] as const).map((rId) => (
                              <button
                                key={rId}
                                type="button"
                                onClick={() => setSelectedExtendRound(rId)}
                                style={{
                                  flex: 1,
                                  padding: '4px 6px',
                                  fontSize: '0.75rem',
                                  fontWeight: selectedExtendRound === rId ? 700 : 500,
                                  background: selectedExtendRound === rId ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                                  border: `1px solid ${selectedExtendRound === rId ? '#38BDF8' : 'rgba(255, 255, 255, 0.1)'}`,
                                  color: selectedExtendRound === rId ? '#38BDF8' : '#CBD5E1',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                }}
                              >
                                Round {rId}
                              </button>
                            ))}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginBottom: '8px' }}>
                            Add extra minutes to active attempt for <strong>Round {selectedExtendRound}</strong>:
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {[1, 2, 5, 10].map((mins) => (
                              <button
                                key={mins}
                                type="button"
                                disabled={extendingRound !== null}
                                onClick={() => handleExtendTimeIndividual(selectedParticipant.id, selectedExtendRound, mins)}
                                style={{
                                  flex: 1,
                                  background: 'rgba(56, 189, 248, 0.15)',
                                  border: '1px solid rgba(56, 189, 248, 0.4)',
                                  color: '#38BDF8',
                                  padding: '5px 4px',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: extendingRound !== null ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {extendingRound === selectedExtendRound ? '...' : `+${mins}m`}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

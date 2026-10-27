import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../Icon';
import type { RegistryParticipant } from '../../types/competition';

import { apiRequest } from '../../services/apiClient';

interface AdminParticipantsProps {
  onReturnToOverview?: () => void;
}

export const AdminParticipants: React.FC<AdminParticipantsProps> = () => {
  const [participants, setParticipants] = useState<RegistryParticipant[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roundFilter, setRoundFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

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

  return (
    <div className="overview-container">
      {/* Header */}
      <div className="screen-header-block" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="screen-maintitle">Participants</h1>
          <p className="screen-subtitle">Authoritative Neon PostgreSQL participant registry & live round submissions</p>
        </div>
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
              placeholder="Search by name, roll number, or campus..."
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
                  <th>Campus / Institution</th>
                  <th>Round Progress (R1 / R2 / R3)</th>
                  <th>Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <Icon name="refresh" size={16} />
                        <span>Querying Neon PostgreSQL participants...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                      {participants.length === 0 ? (
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                            No participants registered yet in Neon PostgreSQL database.
                          </div>
                          <div>Once participants register through the entry modal, their records will appear here live.</div>
                        </div>
                      ) : (
                        'No participants match the specified search or filter criteria.'
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredList.map((p) => {
                    const isSelected = p.id === selectedId;

                    // Derive active round details based on roundFilter
                    const activeRoundKey = roundFilter === 'R-01' ? 1 : roundFilter === 'R-02' ? 2 : roundFilter === 'R-03' ? 3 : null;
                    const roundDetail = activeRoundKey ? p.rounds?.[activeRoundKey] : null;

                    let statusClass =
                      p.statusType.startsWith('flagged')
                        ? 'badge-flagged'
                        : p.statusType === 'completed'
                          ? 'badge-completed'
                          : 'badge-in-progress';
                    let statusText = p.statusLabel;

                    if (roundDetail) {
                      if (roundDetail.status === 'COMPLETED') {
                        statusClass = 'badge-completed';
                        statusText = `${roundFilter}: SUBMITTED`;
                      } else if (roundDetail.status === 'IN_PROGRESS') {
                        statusClass = 'badge-in-progress';
                        statusText = `${roundFilter}: IN-PROGRESS`;
                      } else if (roundDetail.status === 'ELIGIBLE') {
                        statusClass = 'badge-eligible';
                        statusText = `${roundFilter}: ELIGIBLE`;
                      } else {
                        statusClass = 'badge-locked';
                        statusText = `${roundFilter}: LOCKED`;
                      }
                    }

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
                          <span className="cell-campus-name">{p.campus}</span>
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
                              title={`Round 2: ${p.rounds?.[2]?.status || 'LOCKED'}`}
                            >
                              R2: {p.rounds?.[2]?.status === 'COMPLETED' ? 'SUBMITTED' : p.rounds?.[2]?.status || 'LOCKED'}
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
                              title={`Round 3: ${p.rounds?.[3]?.status || 'LOCKED'}`}
                            >
                              R3: {p.rounds?.[3]?.status === 'COMPLETED' ? 'SUBMITTED' : p.rounds?.[3]?.status || 'LOCKED'}
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
                              <div>
                                <span className="cell-score-value">{p.totalScore ?? 0} pts</span>
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  R1: {r1 && r1.score !== null ? `${r1.score}` : ' '} | R2: {r2 && r2.score !== null ? `${r2.score}` : ' '} | R3: {r3 && r3.score !== null ? `${r3.score}` : ' '}
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td>
                          <span className={`status-badge ${statusClass}`}>{statusText}</span>
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

              {/* Information Grid */}
              <div className="side-info-list">
                <div className="side-info-row">
                  <span className="info-row-label">Roll Number:</span>
                  <span className="info-row-value">{selectedParticipant.rollNumber}</span>
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
                            <div>Correct: {spR1.solvedCount}/20 &nbsp;•&nbsp; Time: {spR1.timeTakenSeconds}s</div>
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
                            {spR2?.status === 'COMPLETED' ? 'SUBMITTED' : spR2?.status || 'LOCKED'}
                          </span>
                        </div>
                        <div className="side-round-card-body">
                          <div>Score: <strong>{spR2 && spR2.score !== null ? `${spR2.score} / 5 pts` : spR2?.eligible ? 'Eligible (Not attempted)' : 'Locked'}</strong></div>
                          {spR2?.submitted && (
                            <div>Correct: {spR2.solvedCount}/5 &nbsp;•&nbsp; Time: {spR2.timeTakenSeconds}s</div>
                          )}
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
                            {spR3?.status === 'COMPLETED' ? 'SUBMITTED' : spR3?.status || 'LOCKED'}
                          </span>
                        </div>
                        <div className="side-round-card-body">
                          <div>Score: <strong>{spR3 && spR3.score !== null ? `${spR3.score} / 5 pts` : spR3?.eligible ? 'Eligible (Not attempted)' : 'Locked'}</strong></div>
                          {spR3?.submitted && (
                            <div>Correct: {spR3.solvedCount}/5 &nbsp;•&nbsp; Time: {spR3.timeTakenSeconds}s</div>
                          )}
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

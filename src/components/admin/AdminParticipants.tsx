import React, { useState, useEffect } from 'react';
import { Icon } from '../Icon';
import type { RegistryParticipant } from '../../data/adminMockData';
import {
  getRegistryParticipants,
  saveRegistryParticipants,
  subscribeToCompetitionSync,
} from '../../services/competitionStateService';

interface AdminParticipantsProps {
  onReturnToOverview?: () => void;
}

export const AdminParticipants: React.FC<AdminParticipantsProps> = () => {
  const [participants, setParticipantsState] = useState<RegistryParticipant[]>(getRegistryParticipants);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roundFilter, setRoundFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const setParticipants = (updater: React.SetStateAction<RegistryParticipant[]>) => {
    setParticipantsState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveRegistryParticipants(next);
      return next;
    });
  };

  useEffect(() => {
    const handleSync = () => {
      setParticipantsState(getRegistryParticipants());
    };
    const unsubscribe = subscribeToCompetitionSync(handleSync);
    return () => unsubscribe();
  }, []);

  // Selected participant object (if any selected)
  const selectedParticipant = participants.find((p) => p.id === selectedId) || null;

  // Filter participants
  const filteredList = participants.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      p.campus.toLowerCase().includes(q) ||
      p.rollNumber.toLowerCase().includes(q);

    const matchesRound = roundFilter === 'ALL' || p.round.includes(roundFilter);
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'FLAGGED' && p.statusType.startsWith('flagged')) ||
      (statusFilter === 'IN_PROGRESS' && p.statusType === 'in-progress') ||
      (statusFilter === 'COMPLETED' && p.statusType === 'completed');

    return matchesSearch && matchesRound && matchesStatus;
  });

  const handleRowClick = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  const handleGrantWaiver = (id: string) => {
    if (!selectedParticipant) return;
    alert(`Granted +3 Minutes Time Waiver to candidate ${selectedParticipant.name}.`);
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, statusLabel: `${p.statusLabel} [+3M]` } : p))
    );
  };

  const handleResetLock = (id: string) => {
    if (!selectedParticipant) return;
    alert(`Candidate session lock reset for ${selectedParticipant.name}. New access token generated.`);
    setParticipants((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, statusType: 'in-progress', statusLabel: 'IN-PROGRESS [18/20]' } : p
      )
    );
  };

  const handleForceSubmit = (id: string) => {
    if (!selectedParticipant) return;
    const confirmed = window.confirm(`Confirm: Force submit attempt and close active session for ${selectedParticipant.name}?`);
    if (confirmed) {
      alert(`Session for ${selectedParticipant.name} submitted. Progress: ${selectedParticipant.solvedCount}/${selectedParticipant.totalQuestions}.`);
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, statusType: 'completed', statusLabel: 'SUBMITTED (FORCED)' } : p
        )
      );
    }
  };

  return (
    <div className="overview-container">
      {/* Header */}
      <div className="screen-header-block">
        <h1 className="screen-maintitle">Participants</h1>
        <p className="screen-subtitle">Registered candidate registry, live session status, and candidate details</p>
      </div>

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
            <div>Candidate Registry Table</div>
            <div className="table-hint-text">Click any row to view candidate details and actions</div>
          </div>

          <div className="table-scroll-wrapper">
            <table className="custom-data-table" aria-label="Participants table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Roll Number</th>
                  <th>Campus / Institution</th>
                  <th>Round</th>
                  <th>Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No participants match the specified search or filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredList.map((p) => {
                    const isSelected = p.id === selectedId;
                    const statusClass =
                      p.statusType.startsWith('flagged')
                        ? 'badge-flagged'
                        : p.statusType === 'completed'
                        ? 'badge-completed'
                        : 'badge-in-progress';

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
                          <span className="cell-round-pill">{p.round}</span>
                        </td>
                        <td>
                          <span className="cell-score-value">{p.solvedCount}/{p.totalQuestions}</span>
                        </td>
                        <td>
                          <span className={`status-badge ${statusClass}`}>{p.statusLabel}</span>
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
                  <span className="info-row-label">Current Round:</span>
                  <span className="info-row-value">{selectedParticipant.round}</span>
                </div>
                <div className="side-info-row">
                  <span className="info-row-label">Current Score:</span>
                  <span className="info-row-value" style={{ color: 'var(--maroon-highlight)', fontWeight: 700 }}>
                    {selectedParticipant.solvedCount}/{selectedParticipant.totalQuestions} ({selectedParticipant.accuracy}%)
                  </span>
                </div>
                <div className="side-info-row">
                  <span className="info-row-label">Accuracy:</span>
                  <span className="info-row-value">{selectedParticipant.accuracy}%</span>
                </div>
                <div className="side-info-row">
                  <span className="info-row-label">Current Status:</span>
                  <span className={`status-badge ${
                    selectedParticipant.statusType.startsWith('flagged')
                      ? 'badge-flagged'
                      : selectedParticipant.statusType === 'completed'
                      ? 'badge-completed'
                      : 'badge-in-progress'
                  }`}>
                    {selectedParticipant.statusLabel}
                  </span>
                </div>
              </div>

              {/* Administrative Actions for Candidate */}
              <div className="side-actions-group">
                <h5 className="side-actions-heading">Candidate Actions</h5>

                <button
                  type="button"
                  className="btn btn-secondary w-full"
                  onClick={() => handleGrantWaiver(selectedParticipant.id)}
                >
                  <Icon name="clock" size={14} />
                  <span>Grant +3 Min Time Waiver</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary w-full"
                  onClick={() => handleResetLock(selectedParticipant.id)}
                >
                  <Icon name="key" size={14} />
                  <span>Reset Login Session Lock</span>
                </button>

                <button
                  type="button"
                  className="btn btn-danger-outline w-full"
                  onClick={() => handleForceSubmit(selectedParticipant.id)}
                >
                  <Icon name="log-out" size={14} />
                  <span>Force Submit Attempt</span>
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

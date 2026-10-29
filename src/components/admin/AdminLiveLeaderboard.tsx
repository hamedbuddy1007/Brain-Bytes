import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '../Icon';
import {
  getUnifiedLeaderboard,
  refreshLeaderboardFromServer,
  subscribeToCompetitionSync,
  getAdminSettings,
  saveAdminSettings,
} from '../../services/competitionStateService';
import { compareRound3Rankings } from '../../services/scoringService';
import { apiRequest } from '../../services/apiClient';
import type { LeaderboardEntry, AdminSettings } from '../../types/competition';

interface AdminLiveLeaderboardProps {
  settings?: AdminSettings;
  onUpdateSettings?: (newSettings: AdminSettings) => void;
  onOpenProjector?: () => void;
}

export const AdminLiveLeaderboard: React.FC<AdminLiveLeaderboardProps> = ({
  settings,
  onUpdateSettings,
  onOpenProjector,
}) => {
  const [rawEntries, setRawEntries] = useState<LeaderboardEntry[]>(() => getUnifiedLeaderboard());
  const [selectedRound, setSelectedRound] = useState<'ALL' | 'R1' | 'R2' | 'R3'>('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [isPublished, setIsPublished] = useState<boolean>(() =>
    Boolean(settings?.leaderboardPublished ?? getAdminSettings().leaderboardPublished ?? false)
  );
  const [isUpdatingPublish, setIsUpdatingPublish] = useState(false);

  useEffect(() => {
    if (settings?.leaderboardPublished !== undefined) {
      setIsPublished(Boolean(settings.leaderboardPublished));
    }
  }, [settings?.leaderboardPublished]);

  // Sync with live competition submissions and leaderboard_published state from server
  useEffect(() => {
    let active = true;
    const fetchLatest = () => {
      refreshLeaderboardFromServer()
        .then(() => {
          if (active) setRawEntries(getUnifiedLeaderboard());
        })
        .catch(() => {});

      apiRequest<{ leaderboard_published?: boolean; leaderboardPublished?: boolean }>('/competition/state')
        .then((st) => {
          if (!active || !st) return;
          const pub = st.leaderboard_published ?? st.leaderboardPublished;
          if (pub !== undefined) {
            setIsPublished(Boolean(pub));
          }
        })
        .catch(() => {});
    };
    fetchLatest();

    const handleSync = () => {
      if (active) {
        setRawEntries(getUnifiedLeaderboard());
        const currentSettings = getAdminSettings();
        if (currentSettings.leaderboardPublished !== undefined) {
          setIsPublished(Boolean(currentSettings.leaderboardPublished));
        }
      }
    };
    const unsubscribe = subscribeToCompetitionSync(handleSync);
    const interval = setInterval(fetchLatest, 4000);
    return () => {
      active = false;
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Sort and rank entries according to selected round filter
  const sortedEntries = useMemo(() => {
    const list = [...rawEntries];

    if (selectedRound === 'R3') {
      // Round 3 leaderboard: rank strictly by total Round 3 score with tiebreakers
      list.sort((a, b) => compareRound3Rankings(a, b));
    } else if (selectedRound === 'R2') {
      list.sort((a, b) => {
        if (b.round2Score !== a.round2Score) return b.round2Score - a.round2Score;
        const timeA = a.timeTakenSeconds ?? 999999;
        const timeB = b.timeTakenSeconds ?? 999999;
        if (timeA !== timeB) return timeA - timeB;
        return (a.name || '').localeCompare(b.name || '');
      });
    } else if (selectedRound === 'R1') {
      list.sort((a, b) => {
        if (b.round1Score !== a.round1Score) return b.round1Score - a.round1Score;
        const timeA = a.timeTakenSeconds ?? 999999;
        const timeB = b.timeTakenSeconds ?? 999999;
        if (timeA !== timeB) return timeA - timeB;
        return (a.name || '').localeCompare(b.name || '');
      });
    } else {
      list.sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        const timeA = a.timeTakenSeconds ?? 999999;
        const timeB = b.timeTakenSeconds ?? 999999;
        if (timeA !== timeB) return timeA - timeB;
        if (b.round3Score !== a.round3Score) return b.round3Score - a.round3Score;
        return (a.name || '').localeCompare(b.name || '');
      });
    }

    return list.map((item, idx) => {
      const rank = idx + 1;
      const roundScore =
        selectedRound === 'R3'
          ? item.round3Score
          : selectedRound === 'R2'
          ? item.round2Score
          : selectedRound === 'R1'
          ? item.round1Score
          : item.totalScore;

      return {
        rank,
        rankStr: String(rank).padStart(2, '0'),
        name: item.name,
        systemId: item.rollNumber,
        institution: item.collegeName || 'CAMPUS',
        score: roundScore,
        scoreStr: `${roundScore} PTS`,
        status: item.stage,
      };
    });
  }, [rawEntries, selectedRound]);

  const filteredEntries = sortedEntries.filter((e) => {
    const q = searchFilter.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.institution.toLowerCase().includes(q) ||
      e.systemId.toLowerCase().includes(q)
    );
  });

  const togglePublishing = async () => {
    if (isUpdatingPublish) return;
    const next = !isPublished;
    setIsUpdatingPublish(true);
    setIsPublished(next);

    try {
      await apiRequest('/admin/competition/state', {
        method: 'PATCH',
        body: JSON.stringify({ leaderboardPublished: next }),
      });
      const baseSettings = settings || getAdminSettings();
      const updatedSettings: AdminSettings = {
        ...baseSettings,
        leaderboardPublished: next,
      };
      saveAdminSettings(updatedSettings);
      if (onUpdateSettings) {
        onUpdateSettings(updatedSettings);
      }
    } catch (err) {
      setIsPublished(!next);
      alert(`Failed to update leaderboard visibility: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsUpdatingPublish(false);
    }
  };

  return (
    <div className="overview-container">
      {/* Header */}
      <div className="screen-header-block">
        <h1 className="screen-maintitle">Live Leaderboard</h1>
        <p className="screen-subtitle">
          Real-time candidate standings, verified scores, and participant leaderboard visibility control
        </p>
      </div>

      {/* Filter and Publishing Bar */}
      <div className="registry-filter-bar">
        <div className="filter-left-cluster">
          <div className="search-input-wrapper">
            <Icon name="search" size={15} className="search-icon-inside" />
            <input
              type="text"
              className="search-input-field"
              placeholder="Search competitor, roll number, or department..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              aria-label="Search leaderboard"
            />
          </div>

          <div className="state-toggles-group" role="group" aria-label="Round filter">
            <button
              type="button"
              className={`state-toggle-btn ${selectedRound === 'ALL' ? 'is-active-btn' : ''}`}
              onClick={() => setSelectedRound('ALL')}
            >
              All Rounds
            </button>
            <button
              type="button"
              className={`state-toggle-btn ${selectedRound === 'R1' ? 'is-active-btn' : ''}`}
              onClick={() => setSelectedRound('R1')}
            >
              Round 1
            </button>
            <button
              type="button"
              className={`state-toggle-btn ${selectedRound === 'R2' ? 'is-active-btn' : ''}`}
              onClick={() => setSelectedRound('R2')}
            >
              Round 2
            </button>
            <button
              type="button"
              className={`state-toggle-btn ${selectedRound === 'R3' ? 'is-active-btn' : ''}`}
              onClick={() => setSelectedRound('R3')}
            >
              Round 3
            </button>
          </div>
        </div>

        <div className="filter-right-cluster">
          {/* Unobtrusive Live/Publish Status */}
          <span className={`status-pill ${isPublished ? 'is-active' : 'is-locked'}`}>
            {isPublished ? '● Visible to Participants' : '🔒 Hidden from Participants'}
          </span>

          <button
            type="button"
            className={`btn ${isPublished ? 'btn-secondary' : 'btn-primary'} btn-sm`}
            onClick={togglePublishing}
            disabled={isUpdatingPublish}
            style={
              isPublished
                ? { borderColor: '#EF4444', color: '#F87171' }
                : { background: '#16A34A', borderColor: '#22C55E', color: '#FFFFFF' }
            }
          >
            <Icon name={isPublished ? 'lock' : 'unlock'} size={13} />
            <span>
              {isUpdatingPublish
                ? 'Updating...'
                : isPublished
                  ? 'Hide Leaderboard from Participants'
                  : 'Display Leaderboard to Participants'}
            </span>
          </button>

          {onOpenProjector && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onOpenProjector}
            >
              <Icon name="monitor" size={14} />
              <span>Projector Display</span>
            </button>
          )}
        </div>
      </div>

      {/* Leaderboard Table Card */}
      <div className="registry-table-card">
        <div className="table-top-meta">
          <div>Tournament Standings Ledger</div>
          <div className="table-hint-text">Ranked deterministically by score with latency tiebreaker</div>
        </div>

        <div className="table-scroll-wrapper">
          <table className="custom-data-table" aria-label="Live Leaderboard Table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Rank</th>
                <th>Participant</th>
                <th>Roll Number</th>
                <th>Round</th>
                <th>Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No competitors match the search query.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((e) => {
                  const isTop3 = e.rank <= 3;
                  const rankBadgeClass =
                    e.rank === 1 ? 'rank-gold' : e.rank === 2 ? 'rank-silver' : e.rank === 3 ? 'rank-bronze' : 'rank-normal';

                  return (
                    <tr key={e.rank} className={isTop3 ? 'table-row-highlight' : ''}>
                      <td>
                        <span className={`cell-rank-pill ${rankBadgeClass}`}>#{e.rankStr}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className="cell-candidate-name">{e.name}</span>
                          <span className="cell-institution-sub">{e.institution}</span>
                        </div>
                      </td>
                      <td>
                        <span className="cell-roll-number">{e.systemId}</span>
                      </td>
                      <td>
                        <span className="cell-round-pill">
                          {selectedRound === 'R2'
                            ? 'Round 2'
                            : selectedRound === 'R3'
                              ? 'Round 3'
                              : selectedRound === 'R1'
                                ? 'Round 1'
                                : 'All Rounds'}
                        </span>
                      </td>
                      <td>
                        <span className="cell-score-value" style={{ color: isTop3 ? 'var(--maroon-highlight)' : 'var(--text-main)', fontWeight: 800 }}>
                          {e.scoreStr}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${e.rank <= 3 ? 'badge-completed' : 'badge-in-progress'}`}>
                          {e.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '../Icon';
import type { AdminLeaderboardEntry, LeaderboardEntry } from '../../types/competition';
import {
  getUnifiedLeaderboard,
  refreshLeaderboardFromServer,
  subscribeToCompetitionSync,
} from '../../services/competitionStateService';



interface AdminProjectorDisplayProps {
  onReturnToAdmin?: () => void;
  onReturnToArena?: () => void;
}

function mapToProjectorEntries(unified: LeaderboardEntry[]): AdminLeaderboardEntry[] {
  return unified.map((u, idx) => {
    const rank = idx + 1;
    const tier: AdminLeaderboardEntry['tier'] =
      rank === 1 ? 'champion' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'qualifier';
    // Total maximum achievable score across all 3 rounds: R1(50) + R2(30) + R3(25) = 105
    const maxScore = 105;
    const accuracy = Math.min(100, Math.max(0, Math.round((u.totalScore / maxScore) * 100)));
    const latency = u.timeTakenSeconds
      ? `${String(Math.floor(u.timeTakenSeconds / 60)).padStart(2, '0')}m ${String(u.timeTakenSeconds % 60).padStart(2, '0')}s`
      : u.lastActive === 'Verified' ? 'LIVE' : 'SYNC';

    return {
      rank,
      rankStr: String(rank).padStart(2, '0'),
      name: u.name,
      systemId: u.rollNumber,
      institution: (u.collegeName || 'CAMPUS').toUpperCase(),
      score: u.totalScore,
      scoreStr: `${u.totalScore.toFixed(2)} PTS`,
      accuracy,
      accuracyStr: `${accuracy}%`,
      latency,
      tier,
    };
  });
}


export const AdminProjectorDisplay: React.FC<AdminProjectorDisplayProps> = ({
  onReturnToAdmin,
  onReturnToArena,
}) => {
  const [unifiedList, setUnifiedList] = useState<LeaderboardEntry[]>(() => getUnifiedLeaderboard());
  const [clockStr, setClockStr] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync with live competition submissions from PostgreSQL database
  useEffect(() => {
    let active = true;
    const fetchLatest = () => {
      refreshLeaderboardFromServer()
        .then(() => {
          if (active) setUnifiedList(getUnifiedLeaderboard());
        })
        .catch(() => {});
    };

    fetchLatest();
    const handleSync = () => {
      if (active) setUnifiedList(getUnifiedLeaderboard());
    };
    const unsubscribe = subscribeToCompetitionSync(handleSync);
    // Continuous auditorium polling every 3 seconds
    const pollInterval = setInterval(fetchLatest, 3000);
    return () => {
      active = false;
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, []);

  const entries: AdminLeaderboardEntry[] = useMemo(() => {
    return mapToProjectorEntries(unifiedList);
  }, [unifiedList]);

  // Live master clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      setClockStr(`${h}:${m}:${s}`);
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  const rank1: AdminLeaderboardEntry = entries.find((e) => e.rank === 1) || entries[0] || {
    rank: 1,
    rankStr: '01',
    name: 'Awaiting Competitor',
    systemId: '---',
    institution: 'TOURNAMENT STANDBY',
    score: 0,
    scoreStr: '0.00 PTS',
    accuracy: 0,
    accuracyStr: '0%',
    latency: 'PENDING',
    tier: 'champion',
  };
  const rank2: AdminLeaderboardEntry = entries.find((e) => e.rank === 2) || entries[1] || {
    rank: 2,
    rankStr: '02',
    name: 'Awaiting Competitor',
    systemId: '---',
    institution: 'TOURNAMENT STANDBY',
    score: 0,
    scoreStr: '0.00 PTS',
    accuracy: 0,
    accuracyStr: '0%',
    latency: 'PENDING',
    tier: 'silver',
  };
  const rank3: AdminLeaderboardEntry = entries.find((e) => e.rank === 3) || entries[2] || {
    rank: 3,
    rankStr: '03',
    name: 'Awaiting Competitor',
    systemId: '---',
    institution: 'TOURNAMENT STANDBY',
    score: 0,
    scoreStr: '0.00 PTS',
    accuracy: 0,
    accuracyStr: '0%',
    latency: 'PENDING',
    tier: 'bronze',
  };
  const restEntries = entries.filter((e) => e.rank >= 4 && e.rank <= 10);

  return (
    <div className="projector-stage-root">
      {/* Top Stream Strip */}
      <header className="projector-top-strip">
        <div className="projector-brand-header">
          <span className="projector-live-indicator-dot" />
          <span className="projector-stream-title">Brain Bytes • Live Leaderboard Broadcast</span>
          <span className="projector-stream-sep">•</span>
          <span className="projector-stream-tag">Auditorium Display Feed</span>
        </div>

        <div className="projector-top-actions">
          <div className="projector-live-clock">{clockStr}</div>
          <button
            type="button"
            className="btn-projector-action"
            onClick={toggleFullscreen}
            aria-label="Toggle Fullscreen"
          >
            <Icon name="maximize" size={14} />
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>
          {onReturnToAdmin && (
            <button
              type="button"
              className="btn-projector-action"
              onClick={onReturnToAdmin}
              aria-label="Return to Admin"
            >
              <Icon name="settings" size={14} />
              <span>Admin Console</span>
            </button>
          )}
          {onReturnToArena && (
            <button
              type="button"
              className="btn-projector-action btn-arena-return"
              onClick={onReturnToArena}
              aria-label="Return to Arena"
            >
              <Icon name="arrow-right" size={14} />
              <span>Arena</span>
            </button>
          )}
        </div>
      </header>

      <main className="projector-stage-container">
        {/* Stage Main Heading */}
        <div className="stage-main-title-row">
          <div className="stage-title-left">
            <span className="stage-sub-system-tag">
              DATA MANIA CHAMPIONSHIP • AUDITORIUM STAGE
            </span>
            <h1 className="stage-giant-heading">
              Brain Bytes <span className="heading-accent">Tournament Standings</span>
            </h1>
          </div>

          <div className="stage-title-right">
            <div className="stage-live-board-title">Official Leaderboard</div>
            <span className="stage-session-sub">Top Competitors Ranked by Cumulative Score</span>
          </div>
        </div>

        {/* Top 3 Podium Grid (Rank 2, Rank 1, Rank 3) */}
        <section className="stage-podium-grid" aria-label="Top 3 Finalists">
          {/* Rank 2 (Silver) */}
          <div className="stage-podium-card podium-silver">
            <div className="podium-card-top-tag">
              <span>RANK 02 • RUNNER-UP</span>
              <Icon name="award" size={20} style={{ color: '#D1D5DB' }} />
            </div>
            <div className="podium-big-rank-row">
              <span className="podium-big-rank-num">02</span>
              <div className="podium-name-block">
                <h3 className="podium-candidate-title">{rank2.name}</h3>
                <span className="podium-campus-sub">{rank2.institution}</span>
              </div>
            </div>
            <div className="podium-stats-box">
              <div className="podium-stat-unit">
                <span className="podium-stat-lbl">Score</span>
                <span className="podium-stat-val">{rank2.scoreStr}</span>
              </div>
              <div className="podium-stat-unit">
                <span className="podium-stat-lbl">Accuracy</span>
                <span className="podium-stat-val text-success">{rank2.accuracyStr}</span>
              </div>
              <div className="podium-stat-unit">
                <span className="podium-stat-lbl">Time</span>
                <span className="podium-stat-val">{rank2.latency}</span>
              </div>
            </div>
          </div>

          {/* Rank 1 (Gold - Center) */}
          <div className="stage-podium-card podium-gold">
            <div className="podium-card-top-tag">
              <span style={{ color: '#F59E0B', fontWeight: 800 }}>RANK 01 • TOURNAMENT LEADER</span>
              <Icon name="trophy" size={24} style={{ color: '#F59E0B' }} />
            </div>
            <div className="podium-big-rank-row">
              <span className="podium-big-rank-num podium-rank-gold">01</span>
              <div className="podium-name-block">
                <h3 className="podium-candidate-title podium-title-gold">
                  {rank1.name}
                </h3>
                <span className="podium-campus-sub" style={{ color: '#F59E0B' }}>
                  {rank1.institution}
                </span>
              </div>
            </div>
            <div className="podium-stats-box podium-stats-gold">
              <div className="podium-stat-unit">
                <span className="podium-stat-lbl">Score</span>
                <span className="podium-stat-val" style={{ color: '#F59E0B', fontSize: '1.45rem' }}>
                  {rank1.scoreStr}
                </span>
              </div>
              <div className="podium-stat-unit">
                <span className="podium-stat-lbl">Accuracy</span>
                <span className="podium-stat-val text-success" style={{ fontSize: '1.45rem' }}>
                  {rank1.accuracyStr}
                </span>
              </div>
              <div className="podium-stat-unit">
                <span className="podium-stat-lbl">Time</span>
                <span className="podium-stat-val" style={{ color: 'var(--text-main)', fontSize: '1.45rem' }}>
                  {rank1.latency}
                </span>
              </div>
            </div>
          </div>

          {/* Rank 3 (Bronze) */}
          <div className="stage-podium-card podium-bronze">
            <div className="podium-card-top-tag">
              <span>RANK 03 • 2ND RUNNER-UP</span>
              <Icon name="award" size={20} style={{ color: '#CD7F32' }} />
            </div>
            <div className="podium-big-rank-row">
              <span className="podium-big-rank-num">03</span>
              <div className="podium-name-block">
                <h3 className="podium-candidate-title">{rank3.name}</h3>
                <span className="podium-campus-sub">{rank3.institution}</span>
              </div>
            </div>
            <div className="podium-stats-box">
              <div className="podium-stat-unit">
                <span className="podium-stat-lbl">Score</span>
                <span className="podium-stat-val">{rank3.scoreStr}</span>
              </div>
              <div className="podium-stat-unit">
                <span className="podium-stat-lbl">Accuracy</span>
                <span className="podium-stat-val text-success">{rank3.accuracyStr}</span>
              </div>
              <div className="podium-stat-unit">
                <span className="podium-stat-lbl">Time</span>
                <span className="podium-stat-val">{rank3.latency}</span>
              </div>
            </div>
          </div>
        </section>

        {/* High-Contrast Standings Table (Ranks 4-10) */}
        <section className="stage-standings-card" aria-label="Tournament Rankings 4 to 10">
          <table className="standings-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Rank</th>
                <th>Candidate / Institution</th>
                <th style={{ width: '42%' }}>Accuracy Rating</th>
                <th style={{ textAlign: 'right', width: '160px' }}>Total Points</th>
              </tr>
            </thead>
            <tbody>
              {restEntries.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: '#9CA3AF' }}>
                    {entries.length === 0 ? 'Tournament underway — awaiting verified round submissions.' : 'Top competitors displayed on stage podium above.'}
                  </td>
                </tr>
              ) : (
                restEntries.map((row) => (
                  <tr key={row.rank}>
                    <td>
                      <span className="standings-pos-num">#{row.rankStr}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="standings-candidate-name">{row.name}</span>
                        <span className="standings-campus-name">
                          {row.institution}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="standings-bar-cell">
                        <div className="standings-bar-track">
                          <div
                            className="standings-bar-fill"
                            style={{ width: `${row.accuracy}%` }}
                          />
                        </div>
                        <span className="standings-accuracy-text">
                          {row.accuracyStr}
                        </span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="standings-pts-val">{row.scoreStr}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {/* Bottom Announcement Strip */}
        <footer className="stage-announcement-banner">
          <div className="announcement-left">
            <Icon name="volume-2" size={22} className="announcement-icon" />
            <div className="announcement-title-row">
              <span className="announcement-tag">AUDITORIUM ANNOUNCEMENT</span>
              <span className="announcement-body-text">
                Official Leaderboard Broadcast • Tie-Breaking: 1. Points (Desc) • 2. Time Taken (Asc) • 3. Final Round Weight.
              </span>
            </div>
          </div>

          <div className="announcement-right-badge">
            <span className="status-dot-pulse" />
            <span>Scores Verified</span>
          </div>
        </footer>
      </main>
    </div>
  );
};

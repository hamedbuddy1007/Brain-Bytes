import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '../Icon';
import type { LeaderboardEntry } from '../../types/competition';
import { apiRequest } from '../../services/apiClient';

interface ApiLeaderboardRow {
  name: string;
  roll_number: string;
  college_name: string | null;
  round1_score: number | string | null;
  round2_score: number | string | null;
  round3_score: number | string | null;
  total_score: number | string | null;
  total_time_seconds: number | string | null;
}

export const AdminResultsReports: React.FC = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const loadLeaderboard = () => {
    apiRequest<ApiLeaderboardRow[]>('/leaderboard')
      .then((rows) => {
        const mapped: LeaderboardEntry[] = rows.map((r, idx) => {
          const r1 = r.round1_score === null ? null : Number(r.round1_score);
          const r2 = r.round2_score === null ? null : Number(r.round2_score);
          const r3 = r.round3_score === null ? null : Number(r.round3_score);
          let stage: LeaderboardEntry['stage'] = 'Participant';
          if (r3 !== null) stage = 'Podium Winner';
          else if (r2 !== null) stage = 'Top 8 Finalist';
          else if (r1 !== null) stage = 'Qualified R1';

          return {
            id: `rep-${r.roll_number}`,
            rank: idx + 1,
            name: r.name,
            rollNumber: r.roll_number,
            collegeName: r.college_name || 'CAMPUS',
            round1Score: r1 ?? 0,
            round2Score: r2 ?? 0,
            round3Score: r3 ?? 0,
            totalScore: Number(r.total_score ?? 0),
            timeTakenSeconds: Number(r.total_time_seconds ?? 0),
            stage,
            lastActive: r1 !== null || r2 !== null || r3 !== null ? 'Verified' : 'Ready',
          };
        });
        setEntries(mapped);
      })
      .catch((err) => console.warn('Failed to load leaderboard for reports:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadLeaderboard();
    const interval = setInterval(loadLeaderboard, 5000);
    return () => clearInterval(interval);
  }, []);

  // Summary Metrics calculated from REAL database entries
  const metrics = useMemo(() => {
    const scoredList = entries.filter((e) => e.totalScore > 0 || e.round1Score > 0 || e.round2Score > 0 || e.round3Score > 0);
    const totalCount = entries.length;
    const scoredCount = scoredList.length;
    const topEntry = entries[0] || null;
    const r2QualifiersCount = entries.filter((e) => e.round2Score > 0 || e.stage === 'Top 8 Finalist' || e.stage === 'Podium Winner').length;

    return {
      totalParticipants: totalCount,
      totalEvaluations: scoredCount,
      topScore: topEntry ? topEntry.totalScore.toFixed(2) : '0.00',
      championName: topEntry ? topEntry.name : '—',
      championCollege: topEntry ? topEntry.collegeName : '—',
      r2Qualifiers: r2QualifiersCount,
    };
  }, [entries]);

  // Generate and download a real CSV file in the browser using REAL participants and scores
  const handleExportCSV = () => {
    setIsExporting(true);
    try {
      const headers = [
        'Rank',
        'Participant Name',
        'Roll Number',
        'Institution',
        'Round 1 Score',
        'Round 2 Score',
        'Round 3 Score',
        'Total Score (PTS)',
        'Total Time (Seconds)',
        'Stage Status',
      ];
      const rows = entries.map((e, idx) => [
        idx + 1,
        `"${e.name.replace(/"/g, '""')}"`,
        `"${e.rollNumber.replace(/"/g, '""')}"`,
        `"${(e.collegeName || 'CAMPUS').replace(/"/g, '""')}"`,
        e.round1Score,
        e.round2Score,
        e.round3Score,
        e.totalScore,
        e.timeTakenSeconds || 0,
        `"${e.stage}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `BRAIN_BYTES_DATA_MANIA_RESULTS_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to generate CSV export.');
    } finally {
      setTimeout(() => setIsExporting(false), 500);
    }
  };

  return (
    <div className="overview-container">
      {/* Header */}
      <div className="screen-header-block">
        <div className="screen-pretitle">
          <span className="red-square" />
          <span>TOURNAMENT EVALUATION & EXPORT ARCHIVE</span>
        </div>
        <h1 className="screen-maintitle">RESULTS & PERFORMANCE REPORTS</h1>
      </div>

      {/* Summary KPI Cards Row */}
      <div className="overview-kpis-grid">
        <div className="overview-kpi-card">
          <div className="kpi-card-header">
            <span>REGISTERED CANDIDATES</span>
            <span className="kpi-tag">REGISTRY</span>
          </div>
          <div className="kpi-card-number">{metrics.totalParticipants}</div>
          <div className="kpi-card-footer">
            <span>TOTAL ENROLLED</span>
            <span>LIVE ROSTER</span>
          </div>
        </div>

        <div className="overview-kpi-card">
          <div className="kpi-card-header">
            <span>COMPLETED SUBMISSIONS</span>
            <span className="kpi-tag">SCORED</span>
          </div>
          <div className="kpi-card-number" style={{ color: '#22C55E' }}>
            {metrics.totalEvaluations}
          </div>
          <div className="kpi-card-footer">
            <span>DATABASE COMMITTED</span>
            <span>CRC-VERIFIED</span>
          </div>
        </div>

        <div className="overview-kpi-card">
          <div className="kpi-card-header">
            <span>TOP TOURNAMENT SCORE</span>
            <span className="kpi-tag">LEADER</span>
          </div>
          <div className="kpi-card-number" style={{ color: '#F59E0B' }}>
            {metrics.topScore}
          </div>
          <div className="kpi-card-footer">
            <span>{metrics.championName}</span>
            <span>{metrics.championCollege}</span>
          </div>
        </div>

        <div className="overview-kpi-card">
          <div className="kpi-card-header">
            <span>ROUND 2 QUALIFIERS</span>
            <span className="kpi-tag">CUTOFF</span>
          </div>
          <div className="kpi-card-number" style={{ color: '#B94B68' }}>
            {metrics.r2Qualifiers}
          </div>
          <div className="kpi-card-footer">
            <span>STAGE 2 ADVANCEMENT</span>
            <span>PROMOTED</span>
          </div>
        </div>
      </div>

      {/* Main Results Table Panel */}
      <div className="admin-panel-card" style={{ marginTop: '20px' }}>
        <div className="panel-card-header">
          <div className="panel-title-group">
            <Icon name="file-text" size={17} className="panel-header-icon" />
            <div>
              <h3 className="panel-title">Official Tournament Standings & Score Archive</h3>
              <span className="panel-subtitle">Authoritative Neon PostgreSQL leaderboard records</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={loadLeaderboard}
              title="Refresh results from server"
            >
              <Icon name="refresh-cw" size={14} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExportCSV}
              disabled={isExporting || entries.length === 0}
            >
              <Icon name="download" size={14} />
              <span>{isExporting ? 'Generating CSV...' : 'Export Verified CSV'}</span>
            </button>
          </div>
        </div>

        <div className="reports-table-wrapper" style={{ overflowX: 'auto', marginTop: '12px' }}>
          {isLoading ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#888888' }}>
              Loading competition results from database...
            </div>
          ) : entries.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#888888' }}>
              No participant attempts recorded yet. Results will populate here as candidates submit their rounds.
            </div>
          ) : (
            <table className="admin-data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #414047', textAlign: 'left', fontSize: '0.75rem', color: '#B8B2B7' }}>
                  <th style={{ padding: '10px 14px' }}>RANK</th>
                  <th style={{ padding: '10px 14px' }}>PARTICIPANT</th>
                  <th style={{ padding: '10px 14px' }}>ROLL NO</th>
                  <th style={{ padding: '10px 14px' }}>INSTITUTION</th>
                  <th style={{ padding: '10px 14px' }}>R1 SCORE</th>
                  <th style={{ padding: '10px 14px' }}>R2 SCORE</th>
                  <th style={{ padding: '10px 14px' }}>R3 SCORE</th>
                  <th style={{ padding: '10px 14px' }}>TOTAL SCORE</th>
                  <th style={{ padding: '10px 14px' }}>STAGE</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, idx) => (
                  <tr
                    key={e.id}
                    style={{
                      borderBottom: '1px solid rgba(65, 64, 71, 0.4)',
                      background: idx % 2 === 0 ? 'rgba(41, 42, 46, 0.4)' : 'transparent',
                      fontSize: '0.85rem',
                    }}
                  >
                    <td style={{ padding: '10px 14px', fontWeight: 800, color: idx === 0 ? '#F59E0B' : idx === 1 ? '#D1D5DB' : idx === 2 ? '#B45309' : '#F5F3F4' }}>
                      #{String(idx + 1).padStart(2, '0')}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#FFFFFF' }}>{e.name}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#B8B2B7' }}>{e.rollNumber}</td>
                    <td style={{ padding: '10px 14px', color: '#D1D5DB' }}>{e.collegeName || 'CAMPUS'}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{e.round1Score}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{e.round2Score}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{e.round3Score}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 800, color: '#22C55E', fontFamily: 'monospace' }}>
                      {e.totalScore.toFixed(2)} PTS
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: e.stage === 'Podium Winner' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(142, 35, 59, 0.15)',
                          color: e.stage === 'Podium Winner' ? '#F59E0B' : '#B94B68',
                          border: '1px solid currentColor',
                        }}
                      >
                        {e.stage}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

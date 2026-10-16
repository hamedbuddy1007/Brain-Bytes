import React, { useState } from 'react';
import { Icon } from '../Icon';
import { ADMIN_PROJECTOR_LEADERBOARD, type AdminLeaderboardEntry } from '../../data/adminMockData';

export const AdminResultsReports: React.FC = () => {
  const [entries] = useState<AdminLeaderboardEntry[]>(ADMIN_PROJECTOR_LEADERBOARD);
  const [isExporting, setIsExporting] = useState(false);

  // Generate and download a real CSV file in the browser
  const handleExportCSV = () => {
    setIsExporting(true);
    try {
      const headers = ['Rank', 'Participant Name', 'Roll Number', 'Institution', 'Score (PTS)', 'Accuracy (%)', 'Completion Latency', 'Tier Status'];
      const rows = entries.map((e) => [
        e.rank,
        `"${e.name}"`,
        `"${e.systemId}"`,
        `"${e.institution}"`,
        e.score,
        e.accuracy,
        `"${e.latency}"`,
        `"${e.tier.toUpperCase()}"`,
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
            <span>TOTAL EVALUATIONS</span>
            <span className="kpi-tag">FINAL</span>
          </div>
          <div className="kpi-card-number">194</div>
          <div className="kpi-card-footer">
            <span>OFFICIAL ATTEMPTS</span>
            <span>CRC-VERIFIED</span>
          </div>
        </div>

        <div className="overview-kpi-card">
          <div className="kpi-card-header">
            <span>MEDIAN ACCURACY</span>
            <span className="kpi-tag">STATISTICS</span>
          </div>
          <div className="kpi-card-number" style={{ color: '#22C55E' }}>
            88.5<span style={{ fontSize: '1.2rem' }}>%</span>
          </div>
          <div className="kpi-card-footer">
            <span>IQR SPREAD: 8.4%</span>
            <span>GAUSSIAN FIT</span>
          </div>
        </div>

        <div className="overview-kpi-card">
          <div className="kpi-card-header">
            <span>TOP TOURNAMENT SCORE</span>
            <span className="kpi-tag">CHAMPION</span>
          </div>
          <div className="kpi-card-number" style={{ color: '#F59E0B' }}>
            {entries[0]?.score ? entries[0].score.toFixed(2) : '20.00'}
          </div>
          <div className="kpi-card-footer">
            <span>A. SHARMA</span>
            <span>IIT BOMBAY</span>
          </div>
        </div>

        <div className="overview-kpi-card">
          <div className="kpi-card-header">
            <span>ROUND 2 QUALIFIERS</span>
            <span className="kpi-tag">CUTOFF</span>
          </div>
          <div className="kpi-card-number" style={{ color: '#B94B68' }}>
            30
          </div>
          <div className="kpi-card-footer">
            <span>THRESHOLD: 14.25 PTS</span>
            <span>GATE READY</span>
          </div>
        </div>
      </div>

      {/* Export Bar */}
      <div className="registry-filter-bar">
        <div className="filter-left-cluster">
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', color: '#F5F3F4', fontWeight: 600 }}>
            COMPETITION SUMMARY AUDIT // DATA MANIA CHAMPIONSHIP
          </span>
        </div>

        <div className="filter-right-cluster">
          <button
            type="button"
            className="btn-admin-primary"
            onClick={handleExportCSV}
            disabled={isExporting}
          >
            <Icon name="download" size={15} />
            <span>{isExporting ? 'GENERATING CSV...' : 'EXPORT OFFICIAL CSV REPORT'}</span>
          </button>
        </div>
      </div>

      {/* Standings Summary Table */}
      <div className="registry-table-card">
        <div className="table-top-meta">
          <div>TOP 10 TOURNAMENT CANDIDATES REPORT</div>
          <div style={{ color: '#22C55E' }}>OFFICIAL VERIFIED LEDGER</div>
        </div>

        <table className="custom-data-table">
          <thead>
            <tr>
              <th>RANK</th>
              <th>CANDIDATE</th>
              <th>ROLL NUMBER</th>
              <th>CAMPUS</th>
              <th>ACCURACY</th>
              <th>LATENCY</th>
              <th style={{ textAlign: 'right' }}>TOTAL SCORE</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.rank}>
                <td>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 800,
                    color: e.rank === 1 ? '#F59E0B' : e.rank <= 3 ? '#B94B68' : '#F5F3F4'
                  }}>
                    #{e.rankStr}
                  </span>
                </td>
                <td>
                  <span style={{ fontWeight: 600, color: '#F5F3F4' }}>{e.name}</span>
                </td>
                <td>
                  <span className="cell-roll-number">{e.systemId}</span>
                </td>
                <td>
                  <span style={{ color: '#B8B2B7', fontSize: '0.8rem' }}>{e.institution}</span>
                </td>
                <td>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#22C55E', fontWeight: 600 }}>
                    {e.accuracyStr}
                  </span>
                </td>
                <td>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#F59E0B' }}>
                    {e.latency}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#F5F3F4' }}>
                    {e.scoreStr}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

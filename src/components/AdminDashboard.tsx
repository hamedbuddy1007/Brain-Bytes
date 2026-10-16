import React, { useState } from 'react';
import { Icon } from './Icon';
import type {
  AdminSettings,
  Participant,
  LeaderboardEntry,
} from '../types/competition';
import { AdminOverview } from './admin/AdminOverview';
import { AdminRoundControl } from './admin/AdminRoundControl';
import { AdminParticipants } from './admin/AdminParticipants';
import { AdminQuestionBank } from './admin/AdminQuestionBank';
import { AdminLiveLeaderboard } from './admin/AdminLiveLeaderboard';
import { AdminProjectorDisplay } from './admin/AdminProjectorDisplay';
import { AdminResultsReports } from './admin/AdminResultsReports';
import { AdminSettingsView } from './admin/AdminSettingsView';
import './admin/AdminControlCenter.css';

interface AdminDashboardProps {
  settings: AdminSettings;
  onUpdateSettings: (newSettings: AdminSettings) => void;
  participants: Participant[];
  onRemoveParticipant: (rollNumber: string) => void;
  onResetParticipants: () => void;
  onResetRounds: () => void;
  onReturnToArena: () => void;
  onOpenProjector: () => void;
  onSignOut?: () => void;
  leaderboard: LeaderboardEntry[];
}

export type AdminTab =
  | 'overview'
  | 'round-control'
  | 'participants'
  | 'question-bank'
  | 'leaderboard'
  | 'projector'
  | 'results'
  | 'settings';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  settings,
  onUpdateSettings,
  onResetParticipants,
  onResetRounds,
  onReturnToArena,
  onOpenProjector,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const r1Active = settings.roundStates[1] === 'active';

  const handleSignOutClick = () => {
    if (window.confirm('Are you sure you want to sign out of the Admin Control Center?')) {
      if (onSignOut) {
        onSignOut();
      } else {
        onReturnToArena();
      }
    }
  };

  return (
    <div className="admin-console-root">
      {/* 1. LEFT SIDEBAR (ESSENTIAL NAVIGATION ONLY) */}
      <aside className="admin-sidebar">
        <div className="sidebar-top">
          {/* Brand Header */}
          <div className="sidebar-brand-block">
            <div className="sidebar-brand-icon">
              <Icon name="shield" size={18} />
            </div>
            <div>
              <div className="sidebar-brand-title">BRAIN BYTES</div>
              <div className="sidebar-brand-sub">Admin Control Center</div>
            </div>
          </div>

          {/* Essential Navigation Items */}
          <nav className="sidebar-nav-menu" aria-label="Admin Navigation">
            {/* 1. Overview */}
            <button
              type="button"
              className={`sidebar-nav-item ${activeTab === 'overview' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <Icon name="grid" size={16} />
              <span>Overview</span>
            </button>

            {/* 2. Round Control */}
            <button
              type="button"
              className={`sidebar-nav-item ${activeTab === 'round-control' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('round-control')}
            >
              <Icon name="sliders" size={16} />
              <span>Round Control</span>
            </button>

            {/* 3. Participants */}
            <button
              type="button"
              className={`sidebar-nav-item ${activeTab === 'participants' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('participants')}
            >
              <Icon name="users" size={16} />
              <span>Participants</span>
            </button>

            {/* 4. Question Bank */}
            <button
              type="button"
              className={`sidebar-nav-item ${activeTab === 'question-bank' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('question-bank')}
            >
              <Icon name="help-circle" size={16} />
              <span>Question Bank</span>
            </button>

            {/* 5. Live Leaderboard */}
            <button
              type="button"
              className={`sidebar-nav-item ${activeTab === 'leaderboard' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('leaderboard')}
            >
              <Icon name="bar-chart-2" size={16} />
              <span>Live Leaderboard</span>
            </button>

            {/* 6. Projector Display */}
            <button
              type="button"
              className={`sidebar-nav-item ${activeTab === 'projector' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('projector')}
            >
              <Icon name="monitor" size={16} />
              <span>Projector Display</span>
            </button>

            {/* 7. Results & Reports */}
            <button
              type="button"
              className={`sidebar-nav-item ${activeTab === 'results' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('results')}
            >
              <Icon name="file-text" size={16} />
              <span>Results & Reports</span>
            </button>
          </nav>
        </div>

        {/* Bottom Sidebar: 8. Settings & 9. Sign Out */}
        <div className="sidebar-bottom">
          {/* 8. Settings */}
          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'settings' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Icon name="settings" size={16} />
            <span>Settings</span>
          </button>

          {/* 9. Sign Out */}
          <button
            type="button"
            className="sidebar-nav-item sidebar-sign-out"
            onClick={handleSignOutClick}
          >
            <Icon name="log-out" size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* 2. MAIN CANVAS */}
      <main className="admin-main-canvas">
        {/* Simplified Header: Branding, Status, Current Round, Projector, Admin Profile */}
        <header className="admin-top-bar">
          <div className="admin-top-left">
            <div className="admin-header-brand">
              <span className="admin-header-logo-badge">BB</span>
              <div>
                <span className="admin-header-title">Brain Bytes Control Center</span>
                <span className="admin-header-subtitle">Data Mania Championship</span>
              </div>
            </div>
          </div>

          <div className="admin-top-right">
            {/* Competition Status */}
            <div className="admin-status-indicator">
              <span className="status-dot-pulse" />
              <span>Status: <strong>Live</strong></span>
            </div>

            {/* Current Round */}
            <div className="admin-round-indicator">
              <span className="round-indicator-label">Current:</span>
              <span className="round-indicator-value">
                {r1Active
                  ? 'Round 1 (Data MCQ)'
                  : settings.roundStates[2] === 'active'
                  ? 'Round 2 (Graph Challenge)'
                  : settings.roundStates[3] === 'active'
                  ? 'Round 3 (Rapid Fire)'
                  : 'All Rounds Standby'}
              </span>
            </div>

            {/* Projector Shortcut */}
            <button
              type="button"
              className="btn-projector-shortcut"
              onClick={onOpenProjector}
              aria-label="Open Projector Display"
            >
              <Icon name="monitor" size={15} />
              <span>Projector Display</span>
            </button>

            {/* Admin Profile */}
            <div className="admin-profile-pill">
              <div className="admin-avatar-circle">
                <Icon name="user" size={14} />
              </div>
              <span className="admin-profile-name">Admin</span>
            </div>
          </div>
        </header>

        {/* Tab Content Display */}
        {activeTab === 'overview' && (
          <AdminOverview
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            onNavigateTab={(tab) => setActiveTab(tab as AdminTab)}
            onOpenProjector={onOpenProjector}
          />
        )}

        {activeTab === 'round-control' && (
          <AdminRoundControl
            settings={settings}
            onUpdateSettings={onUpdateSettings}
          />
        )}

        {activeTab === 'participants' && (
          <AdminParticipants onReturnToOverview={() => setActiveTab('overview')} />
        )}

        {activeTab === 'question-bank' && (
          <AdminQuestionBank />
        )}

        {activeTab === 'leaderboard' && (
          <AdminLiveLeaderboard
            onOpenProjector={onOpenProjector}
          />
        )}

        {activeTab === 'projector' && (
          <AdminProjectorDisplay
            onReturnToAdmin={() => setActiveTab('overview')}
            onReturnToArena={onReturnToArena}
          />
        )}

        {activeTab === 'results' && (
          <AdminResultsReports />
        )}

        {activeTab === 'settings' && (
          <AdminSettingsView
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            onResetAll={() => {
              onResetParticipants();
              onResetRounds();
            }}
          />
        )}
      </main>
    </div>
  );
};

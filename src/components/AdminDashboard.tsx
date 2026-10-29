import React, { useState, useEffect } from 'react';
import { Icon, type IconName } from './Icon';
import type {
  AdminSettings,
} from '../types/competition';
import { AdminOverview } from './admin/AdminOverview';
import { AdminRoundControl } from './admin/AdminRoundControl';
import { AdminParticipants } from './admin/AdminParticipants';
import { AdminQuestionBank } from './admin/AdminQuestionBank';
import { AdminLiveLeaderboard } from './admin/AdminLiveLeaderboard';
import { AdminProjectorDisplay } from './admin/AdminProjectorDisplay';
import { AdminResultsReports } from './admin/AdminResultsReports';
import { AdminSettingsView } from './admin/AdminSettingsView';
import { AdminBroadcasts } from './admin/AdminBroadcasts';
import './admin/AdminControlCenter.css';

interface AdminDashboardProps {
  settings: AdminSettings;
  onUpdateSettings: (newSettings: AdminSettings) => void;
  onResetParticipants: () => void;
  onResetRounds: () => void;
  onReturnToArena: () => void;
  onOpenProjector: () => void;
  onSignOut?: () => void;
  onReturnToLanding?: () => void;
}


export type AdminTab =
  | 'overview'
  | 'round-control'
  | 'participants'
  | 'broadcasts'
  | 'question-bank'
  | 'leaderboard'
  | 'projector'
  | 'results'
  | 'settings';

interface AdminNavItem {
  id: AdminTab;
  label: string;
  subtitle: string;
  icon: IconName;
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { id: 'overview', label: 'Overview', subtitle: 'KPIs & Live Status', icon: 'grid' },
  { id: 'round-control', label: 'Round Control', subtitle: 'Start, Lock & Qualify', icon: 'sliders' },
  { id: 'participants', label: 'Participants', subtitle: 'Roster & Approvals', icon: 'users' },
  { id: 'broadcasts', label: 'Announcements', subtitle: 'Live Broadcast Console', icon: 'bell' },
  { id: 'question-bank', label: 'Question Bank', subtitle: 'Manage Questions', icon: 'help-circle' },
  { id: 'leaderboard', label: 'Live Leaderboard', subtitle: 'Real-Time Standings', icon: 'bar-chart-2' },
  { id: 'projector', label: 'Projector Display', subtitle: 'Auditorium View', icon: 'monitor' },
  { id: 'results', label: 'Results & Reports', subtitle: 'Exports & Analytics', icon: 'file-text' },
  { id: 'settings', label: 'Settings', subtitle: 'Codes, Security & Reset', icon: 'settings' },
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  settings,
  onUpdateSettings,
  onResetParticipants,
  onResetRounds,
  onReturnToArena,
  onOpenProjector,
  onSignOut,
  onReturnToLanding,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [isBurgerMenuOpen, setIsBurgerMenuOpen] = useState(false);
  const r1Active = settings.roundStates[1] === 'active';

  const currentRoundLabel = r1Active
    ? 'Round 1 (Data MCQ)'
    : settings.roundStates[2] === 'active'
    ? 'Round 2 (Graph Challenge)'
    : settings.roundStates[3] === 'active'
    ? 'Round 3 (Rapid Fire)'
    : 'All Rounds Standby';

  const activeNavMeta = ADMIN_NAV_ITEMS.find((item) => item.id === activeTab) || ADMIN_NAV_ITEMS[0];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isBurgerMenuOpen) {
        setIsBurgerMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBurgerMenuOpen]);

  const handleSelectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    setIsBurgerMenuOpen(false);
  };

  const handleSignOutClick = () => {
    setIsBurgerMenuOpen(false);
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
      {/* SLIDE-OUT BURGER MENU DRAWER (Accessible on Mobile, Tablet & Desktop Mode) */}
      {isBurgerMenuOpen && (
        <div
          className="admin-burger-backdrop"
          onClick={() => setIsBurgerMenuOpen(false)}
          role="presentation"
        >
          <aside
            className="admin-burger-drawer"
            onClick={(e) => e.stopPropagation()}
            aria-label="Admin All Controls Menu"
          >
            {/* Drawer Header */}
            <div className="burger-drawer-header">
              <div className="burger-drawer-brand">
                <div className="sidebar-brand-icon">
                  <Icon name="shield" size={18} />
                </div>
                <div>
                  <div className="sidebar-brand-title">BRAIN BYTES</div>
                  <div className="sidebar-brand-sub">Admin Control Center</div>
                </div>
              </div>
              <button
                type="button"
                className="burger-drawer-close-btn"
                onClick={() => setIsBurgerMenuOpen(false)}
                aria-label="Close Menu"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            {/* Live Status Card inside Drawer */}
            <div className="burger-drawer-status-box">
              <div className="burger-status-row">
                <span className="status-dot-pulse" />
                <span className="burger-status-text">
                  Tournament Status: <strong>Live</strong>
                </span>
              </div>
              <div className="burger-round-pill">
                <span>Active Stage:</span>
                <strong>{currentRoundLabel}</strong>
              </div>
            </div>

            {/* All 9 Control Modules */}
            <div className="burger-drawer-section-label">ALL ADMIN CONTROLS</div>
            <nav className="burger-drawer-nav" aria-label="Admin Controls Drawer Navigation">
              {ADMIN_NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`burger-drawer-nav-item ${activeTab === item.id ? 'is-active' : ''}`}
                  onClick={() => handleSelectTab(item.id)}
                >
                  <div className="burger-nav-icon-box">
                    <Icon name={item.icon} size={17} />
                  </div>
                  <div className="burger-nav-text">
                    <span className="burger-nav-title">{item.label}</span>
                    <span className="burger-nav-sub">{item.subtitle}</span>
                  </div>
                  {activeTab === item.id && <span className="burger-active-pill">Active</span>}
                </button>
              ))}
            </nav>

            {/* Quick System Actions & Sign Out */}
            <div className="burger-drawer-footer">
              <div className="burger-drawer-section-label">SYSTEM & SESSION</div>
              <div className="burger-quick-actions-grid">
                <button
                  type="button"
                  className="burger-action-btn"
                  onClick={() => {
                    setIsBurgerMenuOpen(false);
                    onOpenProjector();
                  }}
                >
                  <Icon name="monitor" size={16} />
                  <span>Launch Projector</span>
                </button>
                <button
                  type="button"
                  className="burger-action-btn"
                  onClick={() => {
                    setIsBurgerMenuOpen(false);
                    if (onReturnToLanding) onReturnToLanding();
                    else onReturnToArena();
                  }}
                >
                  <Icon name="arrow-left" size={16} />
                  <span>Return to Home</span>
                </button>
              </div>

              <div className="burger-auth-actions-row">
                <button
                  type="button"
                  className={`burger-settings-btn ${activeTab === 'settings' ? 'is-active' : ''}`}
                  onClick={() => handleSelectTab('settings')}
                >
                  <Icon name="settings" size={16} />
                  <span>Settings</span>
                </button>
                <button
                  type="button"
                  className="burger-signout-btn"
                  onClick={handleSignOutClick}
                >
                  <Icon name="log-out" size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* 1. LEFT SIDEBAR (DESKTOP & QUICK NAVIGATION) */}
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
            {ADMIN_NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`sidebar-nav-item ${activeTab === item.id ? 'is-active' : ''}`}
                onClick={() => handleSelectTab(item.id)}
              >
                <Icon name={item.icon} size={16} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Bottom Sidebar: Settings & Sign Out */}
        <div className="sidebar-bottom">
          <button
            type="button"
            className={`sidebar-nav-item ${activeTab === 'settings' ? 'is-active' : ''}`}
            onClick={() => handleSelectTab('settings')}
          >
            <Icon name="settings" size={16} />
            <span>Settings</span>
          </button>

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
        {/* Top Bar with Always-Visible Burger Menu Button, Settings & Sign Out */}
        <header className="admin-top-bar">
          <div className="admin-top-left">
            {/* Prominent Burger Menu Button - Always visible in mobile, tablet & desktop view */}
            <button
              type="button"
              className={`admin-burger-menu-btn ${isBurgerMenuOpen ? 'is-open' : ''}`}
              onClick={() => setIsBurgerMenuOpen((prev) => !prev)}
              aria-label="Open All Admin Controls Menu"
              aria-expanded={isBurgerMenuOpen}
              title="Open All Admin Controls & Navigation Menu"
            >
              <Icon name={isBurgerMenuOpen ? 'close' : 'menu'} size={20} />
              <span className="burger-btn-label">Menu</span>
            </button>

            <button
              type="button"
              className="admin-header-brand-btn"
              onClick={onReturnToLanding || onReturnToArena}
              title="Brain Bytes - Return to Landing Page"
            >
              <img
                src="/brand-logo.png"
                alt="Brain Bytes Logo"
                className="admin-header-logo-img"
              />
              <div className="admin-header-brand-text">
                <span className="admin-header-title">Brain Bytes Control Center</span>
                <span className="admin-header-subtitle">
                  {activeNavMeta.label} • {activeNavMeta.subtitle}
                </span>
              </div>
            </button>
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
              <span className="round-indicator-value">{currentRoundLabel}</span>
            </div>

            {/* Broadcast Shortcut */}
            <button
              type="button"
              className="btn-projector-shortcut"
              onClick={() => handleSelectTab('broadcasts')}
              aria-label="Open Broadcast Console"
              style={
                activeTab === 'broadcasts'
                  ? { background: '#FFF7ED', borderColor: '#F97316', color: '#EA580C' }
                  : undefined
              }
            >
              <Icon name="bell" size={15} />
              <span className="top-btn-text">Announcements</span>
            </button>

            {/* Projector Shortcut */}
            <button
              type="button"
              className="btn-projector-shortcut"
              onClick={onOpenProjector}
              aria-label="Open Projector Display"
            >
              <Icon name="monitor" size={15} />
              <span className="top-btn-text">Projector</span>
            </button>

            {/* Direct Settings Button in Top Bar (Always accessible on Mobile/Desktop View) */}
            <button
              type="button"
              className={`btn-top-admin-settings ${activeTab === 'settings' ? 'is-active' : ''}`}
              onClick={() => handleSelectTab('settings')}
              aria-label="Admin Settings"
              title="Admin Settings"
            >
              <Icon name="settings" size={15} />
              <span>Settings</span>
            </button>

            {/* Direct Sign Out Button in Top Bar (Always accessible on Mobile/Desktop View) */}
            <button
              type="button"
              className="btn-top-admin-signout"
              onClick={handleSignOutClick}
              aria-label="Sign Out of Admin Console"
              title="Sign Out"
            >
              <Icon name="log-out" size={15} />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Quick Mobile/Tablet Active Section Strip */}
        <div className="admin-mobile-quick-strip">
          <button
            type="button"
            className="mobile-strip-menu-trigger"
            onClick={() => setIsBurgerMenuOpen(true)}
          >
            <Icon name="menu" size={16} />
            <span>All Controls ({ADMIN_NAV_ITEMS.length})</span>
          </button>
          <div className="mobile-strip-tabs-scroll">
            {ADMIN_NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`mobile-strip-tab-chip ${activeTab === item.id ? 'is-active' : ''}`}
                onClick={() => handleSelectTab(item.id)}
              >
                <Icon name={item.icon} size={14} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content Display */}
        {activeTab === 'overview' && (
          <AdminOverview
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            onNavigateTab={(tab) => handleSelectTab(tab as AdminTab)}
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
          <AdminParticipants onReturnToOverview={() => handleSelectTab('overview')} />
        )}

        {activeTab === 'broadcasts' && (
          <AdminBroadcasts />
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
            onReturnToAdmin={() => handleSelectTab('overview')}
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

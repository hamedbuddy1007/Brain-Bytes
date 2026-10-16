import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import type { Participant } from '../types/competition';

interface NavbarProps {
  currentView: 'participant' | 'admin' | 'projector';
  onViewChange: (view: 'participant' | 'admin' | 'projector') => void;
  onOpenJoin: () => void;
  activeParticipant: Participant | null;
  onViewTicket: () => void;
  isRegistrationOpen: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onViewChange,
  onOpenJoin,
  activeParticipant,
  onViewTicket,
  isRegistrationOpen,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    if (currentView !== 'participant') {
      onViewChange('participant');
      setTimeout(() => {
        const element = document.getElementById(id);
        element?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return;
    }
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className={`navbar-wrapper ${isScrolled ? 'scrolled' : ''}`}>
      <div className="navbar-container">
        {/* Brand Group */}
        <div
          className="brand-logo"
          onClick={() => {
            onViewChange('participant');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          role="button"
          tabIndex={0}
          aria-label="DATA MANIA - BRAIN BYTES Home"
        >
          <div className="logo-badge solar-badge">
            <Icon name="flame" size={22} className="logo-icon-solar" />
          </div>
          <div className="brand-text-group">
            <div className="brand-title">
              DATA <span className="brand-primary-name">MANIA</span>
            </div>
            <div className="brand-competition-sub">
              <span className="sub-prefix">presents</span>
              <span className="sub-competition">BRAIN BYTES</span>
            </div>
          </div>
        </div>

        {/* View Switcher Pills */}
        <div className="view-mode-switcher" role="tablist" aria-label="Interface Mode">
          <button
            type="button"
            role="tab"
            aria-selected={currentView === 'participant'}
            className={`view-tab-btn ${currentView === 'participant' ? 'active' : ''}`}
            onClick={() => onViewChange('participant')}
          >
            <Icon name="zap" size={14} />
            <span>Arena View</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={currentView === 'projector'}
            className={`view-tab-btn ${currentView === 'projector' ? 'active' : ''}`}
            onClick={() => onViewChange('projector')}
          >
            <Icon name="monitor" size={14} />
            <span>Projector Board</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={currentView === 'admin'}
            className={`view-tab-btn admin-tab ${currentView === 'admin' ? 'active' : ''}`}
            onClick={() => onViewChange('admin')}
          >
            <Icon name="settings" size={14} />
            <span>Admin Console</span>
          </button>
        </div>

        {/* Desktop Navigation Links (when in participant view) */}
        {currentView === 'participant' && (
          <nav className="desktop-nav" aria-label="Participant Navigation">
            <button
              type="button"
              className="nav-link"
              onClick={() => scrollToSection('rounds-section')}
            >
              The 3 Rounds
            </button>
            <button
              type="button"
              className="nav-link"
              onClick={() => scrollToSection('timeline-section')}
            >
              Timeline
            </button>
            <button
              type="button"
              className="nav-link"
              onClick={() => scrollToSection('prizes-section')}
            >
              Prizes
            </button>
            <button
              type="button"
              className="nav-link"
              onClick={() => scrollToSection('rules-section')}
            >
              Rules & FAQs
            </button>
          </nav>
        )}

        {/* Actions / Status */}
        <div className="nav-actions">
          {activeParticipant ? (
            <button
              type="button"
              className="participant-status-pill solar-pill"
              onClick={onViewTicket}
              title="View your verified admit pass"
            >
              <span className="live-dot-solar" />
              <span className="participant-pill-text">
                <span className="pill-name">{activeParticipant.fullName.split(' ')[0]}</span>
                <span className="pill-code">({activeParticipant.rollNumber})</span>
              </span>
              <Icon name="ticket" size={15} />
            </button>
          ) : (
            isRegistrationOpen ? (
              <button
                type="button"
                className="btn btn-primary nav-cta-btn"
                onClick={onOpenJoin}
                id="navbar-join-btn"
              >
                <Icon name="terminal" size={16} />
                <span>Join Arena</span>
              </button>
            ) : (
              <span className="reg-closed-badge">
                <Icon name="lock" size={13} />
                <span>Reg. Paused</span>
              </span>
            )
          )}

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            className="mobile-toggle-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            <Icon name={mobileMenuOpen ? 'close' : 'menu'} size={22} />
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu-drawer">
          <div className="mobile-view-tabs">
            <button
              type="button"
              className={`mobile-view-btn ${currentView === 'participant' ? 'active' : ''}`}
              onClick={() => {
                onViewChange('participant');
                setMobileMenuOpen(false);
              }}
            >
              Arena
            </button>
            <button
              type="button"
              className={`mobile-view-btn ${currentView === 'projector' ? 'active' : ''}`}
              onClick={() => {
                onViewChange('projector');
                setMobileMenuOpen(false);
              }}
            >
              Projector
            </button>
            <button
              type="button"
              className={`mobile-view-btn ${currentView === 'admin' ? 'active' : ''}`}
              onClick={() => {
                onViewChange('admin');
                setMobileMenuOpen(false);
              }}
            >
              Admin Console
            </button>
          </div>

          <nav className="mobile-nav-list">
            <button
              type="button"
              className="mobile-nav-item"
              onClick={() => scrollToSection('rounds-section')}
            >
              <Icon name="zap" size={18} />
              <span>The 3 Rounds</span>
            </button>
            <button
              type="button"
              className="mobile-nav-item"
              onClick={() => scrollToSection('timeline-section')}
            >
              <Icon name="clock" size={18} />
              <span>Event Timeline</span>
            </button>
            <button
              type="button"
              className="mobile-nav-item"
              onClick={() => scrollToSection('prizes-section')}
            >
              <Icon name="trophy" size={18} />
              <span>Prize Honors</span>
            </button>
            <button
              type="button"
              className="mobile-nav-item"
              onClick={() => scrollToSection('rules-section')}
            >
              <Icon name="shield" size={18} />
              <span>Rules & FAQs</span>
            </button>
            <div className="mobile-menu-footer">
              {activeParticipant ? (
                <button
                  type="button"
                  className="btn btn-primary w-full"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onViewTicket();
                  }}
                >
                  <Icon name="ticket" size={18} />
                  <span>View Admit Pass ({activeParticipant.rollNumber})</span>
                </button>
              ) : isRegistrationOpen ? (
                <button
                  type="button"
                  className="btn btn-primary w-full"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenJoin();
                  }}
                >
                  <Icon name="terminal" size={18} />
                  <span>Join Competition</span>
                </button>
              ) : (
                <div className="mobile-closed-notice">Registration is currently closed by Host</div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

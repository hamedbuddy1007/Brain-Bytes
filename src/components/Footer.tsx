import React from 'react';
import { Icon } from './Icon';

interface FooterProps {
  onOpenJoin: () => void;
  onOpenAdmin: () => void;
  onOpenProjector: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenJoin,
  onOpenAdmin,
  onOpenProjector,
}) => {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <footer className="footer-wrapper solar-footer">
      <div className="footer-container">
        {/* Main Footer Row */}
        <div className="footer-main-grid">
          {/* Brand Col */}
          <div className="footer-brand-col">
            <div className="footer-brand-head">
              <div className="logo-badge solar-badge-sm">
                <Icon name="flame" size={18} className="text-molten" />
              </div>
              <div>
                <span className="brand-title">
                  DATA <span className="text-molten">MANIA</span>
                </span>
                <span className="footer-sub-brand">BRAIN BYTES</span>
              </div>
            </div>
            <p className="footer-tagline text-warm-white">
              "Think Smart. Decode Data. Win Big."
            </p>
            <p className="footer-desc text-muted">
              The flagship collegiate Data Science competition conducted under DATA MANIA.
              A high-stakes 3-stage challenge from screening to live stage buzzer showdown.
            </p>
            <div className="footer-venue-chip solar-chip">
              <Icon name="school" size={14} className="text-solar" />
              <span>Campus Auditorium & High Performance Computing Arena</span>
            </div>
          </div>

          {/* Quick Nav Col */}
          <div className="footer-links-col">
            <h4 className="footer-col-title text-warm-white">Tournament</h4>
            <ul className="footer-links-list">
              <li>
                <button type="button" onClick={() => scrollTo('rounds-section')}>
                  Round 1: Data MCQ (Screening)
                </button>
              </li>
              <li>
                <button type="button" onClick={() => scrollTo('rounds-section')}>
                  Round 2: Graph Challenge (Forensics)
                </button>
              </li>
              <li>
                <button type="button" onClick={() => scrollTo('rounds-section')}>
                  Round 3: Rapid Fire (Grand Finale)
                </button>
              </li>
              <li>
                <button type="button" onClick={() => scrollTo('timeline-section')}>
                  Synchronized Schedule
                </button>
              </li>
            </ul>
          </div>

          {/* Participants & Host Tools */}
          <div className="footer-links-col">
            <h4 className="footer-col-title text-warm-white">Portals & Views</h4>
            <ul className="footer-links-list">
              <li>
                <button type="button" onClick={onOpenJoin}>
                  Candidate Registration
                </button>
              </li>
              <li>
                <button type="button" onClick={onOpenProjector}>
                  Auditorium Projector Board
                </button>
              </li>
              <li>
                <button type="button" onClick={onOpenAdmin}>
                  Host Admin Console
                </button>
              </li>
              <li>
                <button type="button" onClick={() => scrollTo('rules-section')}>
                  Rules & Clarifications
                </button>
              </li>
            </ul>
          </div>

          {/* Fast Action Box */}
          <div className="footer-cta-col">
            <div className="footer-action-box solar-action-box">
              <div className="action-box-header">
                <Icon name="terminal" size={16} className="text-molten" />
                <span>Candidate Check-In</span>
              </div>
              <p className="text-muted">
                Have your college roll number and room join code ready to generate your workstation admit pass.
              </p>
              <button
                type="button"
                className="btn btn-primary w-full footer-join-btn"
                onClick={onOpenJoin}
              >
                <span>Enter Competition</span>
                <Icon name="arrow-right" size={15} />
              </button>
            </div>
          </div>
        </div>

        <div className="footer-divider solar-divider" />

        {/* Bottom Credits & Back to Top */}
        <div className="footer-bottom-row">
          <div className="footer-credits text-muted">
            <span>
              © 2026 <strong>DATA MANIA</strong> × <strong>BRAIN BYTES</strong>.
            </span>
            <span className="dot-sep">•</span>
            <span>Solar Flare Arena Edition</span>
            <span className="dot-sep">•</span>
            <span>Local Evaluation State</span>
          </div>

          <button
            type="button"
            className="back-to-top-btn text-muted"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Back to top"
          >
            <span>Back to Top</span>
            <Icon name="chevron-down" size={16} className="rotate-180 text-solar" />
          </button>
        </div>
      </div>
    </footer>
  );
};

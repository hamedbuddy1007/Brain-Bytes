import React, { useState } from 'react';
import { TIMELINE_EVENTS, PRIZES } from '../data/mockData';
import { Icon } from './Icon';

interface CompetitionInfoProps {
  onJoin: () => void;
}

export const CompetitionInfo: React.FC<CompetitionInfoProps> = ({ onJoin }) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'prizes' | 'rules'>('timeline');

  return (
    <section className="section-wrapper info-section" id="timeline-section">
      <div className="section-container">
        {/* Section Header */}
        <div className="section-header text-center">
          <div className="section-kicker solar-kicker">
            <Icon name="clock" size={14} className="text-molten" />
            <span>OPERATIONAL BRIEFING</span>
          </div>
          <h2 className="section-title">Schedule, Honors & Tournament Rules</h2>
          <p className="section-subtitle">
            Synchronized event timeline, podium distinctions, and strict fair-play standards
            governing Brain Bytes under Data Mania.
          </p>

          {/* Sub-nav Tabs */}
          <div className="info-tabs-nav solar-tabs-nav" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'timeline'}
              className={`info-nav-btn ${activeTab === 'timeline' ? 'active' : ''}`}
              onClick={() => setActiveTab('timeline')}
            >
              <Icon name="clock" size={15} />
              <span>Day Timeline</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'prizes'}
              className={`info-nav-btn ${activeTab === 'prizes' ? 'active' : ''}`}
              onClick={() => setActiveTab('prizes')}
              id="prizes-section"
            >
              <Icon name="trophy" size={15} />
              <span>Podium Honors</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'rules'}
              className={`info-nav-btn ${activeTab === 'rules' ? 'active' : ''}`}
              onClick={() => setActiveTab('rules')}
            >
              <Icon name="shield" size={15} />
              <span>Integrity & Code</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Event Timeline */}
        {activeTab === 'timeline' && (
          <div className="timeline-wrapper">
            <div className="timeline-track">
              {TIMELINE_EVENTS.map((item, index) => (
                <div
                  key={item.id}
                  className={`timeline-entry ${item.isCurrent ? 'current-phase' : ''}`}
                >
                  <div className="timeline-marker">
                    <div className="marker-dot solar-marker">
                      {item.isCurrent ? (
                        <span className="live-dot-solar" />
                      ) : (
                        <span className="index-num">{index + 1}</span>
                      )}
                    </div>
                    {index < TIMELINE_EVENTS.length - 1 && <div className="marker-line" />}
                  </div>

                  <div className="timeline-content-card solar-card">
                    <div className="timeline-card-header">
                      <span className="timeline-time-badge solar-time-badge">
                        <Icon name="clock" size={13} />
                        <span>{item.time}</span>
                      </span>
                      <span className="timeline-phase-tag">{item.phase}</span>
                      {item.isCurrent && (
                        <span className="live-now-badge solar-live-badge">
                          <span className="live-dot-solar" />
                          <span>Active Phase</span>
                        </span>
                      )}
                    </div>

                    <h4 className="timeline-event-title">{item.title}</h4>
                    <p className="timeline-event-desc text-muted">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Prizes & Rewards */}
        {activeTab === 'prizes' && (
          <div className="prizes-wrapper">
            <div className="prizes-intro-banner solar-banner-dark">
              <div className="banner-icon-area solar-gold-glow">
                <Icon name="trophy" size={32} className="text-gold" />
              </div>
              <div className="banner-text">
                <h3>Podium Trophies, Research Honors & Certificates</h3>
                <p className="text-muted">
                  Awarded to highest-ranking data science squads demonstrating statistical rigor and
                  rapid analytical execution across all 3 rounds.
                </p>
              </div>
            </div>

            <div className="prizes-grid">
              {PRIZES.map((prize, i) => (
                <div
                  key={i}
                  className={`prize-card solar-prize-card ${prize.isGrand ? 'grand-prize-card-solar' : ''}`}
                >
                  {prize.isGrand && (
                    <div className="grand-ribbon-solar">
                      <Icon name="sparkles" size={13} />
                      <span>GRAND CHAMPION</span>
                    </div>
                  )}

                  <div className="prize-rank-badge">
                    <Icon name="trophy" size={20} className={prize.isGrand ? 'text-gold' : 'text-solar'} />
                    <span className="font-bold">{prize.rank} Place</span>
                  </div>

                  <h4 className="prize-title">{prize.title}</h4>
                  <div className="prize-amount text-gold">{prize.reward}</div>

                  <ul className="prize-perks-list">
                    {prize.perks.map((perk, pIdx) => (
                      <li key={pIdx}>
                        <Icon name="check-circle" size={15} className="check-icon text-molten" />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    className="btn btn-outline-solar w-full"
                    onClick={onJoin}
                  >
                    <span>Compete for {prize.rank} Place</span>
                  </button>
                </div>
              ))}
            </div>

            <div className="all-qualifiers-card solar-qualifiers-card">
              <Icon name="school" size={24} className="text-solar" />
              <div>
                <strong>Certificate of Merit for All Elimination Qualifiers</strong>
                <p className="text-muted">
                  Every squad advancing through Round 1 receives a verified Data Mania × Brain Bytes
                  Digital Credential endorsed by the Technical Council.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Competition Rules */}
        {activeTab === 'rules' && (
          <div className="rules-wrapper">
            <div className="rules-grid">
              <div className="rule-card solar-card">
                <div className="rule-icon-box solar-icon-box">
                  <Icon name="users" size={20} className="text-molten" />
                </div>
                <h4>Team Eligibility & Composition</h4>
                <p className="text-muted">
                  Students may compete individually or in duos (teams of up to 2). Valid college roll
                  numbers and authorized event join codes are mandatory for admit voucher generation.
                </p>
              </div>

              <div className="rule-card solar-card">
                <div className="rule-icon-box solar-icon-box">
                  <Icon name="terminal" size={20} className="text-solar" />
                </div>
                <h4>Hardware & Workstations</h4>
                <p className="text-muted">
                  Competitors utilize their personal laptops with high-speed venue network access.
                  Calculators and standard scratchpads are permitted during Round 1 and Round 2.
                </p>
              </div>

              <div className="rule-card solar-card">
                <div className="rule-icon-box solar-icon-box">
                  <Icon name="shield" size={20} className="text-molten" />
                </div>
                <h4>Academic Integrity & Honor Code</h4>
                <p className="text-muted">
                  Unauthorized external communication or generation tools result in immediate
                  disqualification. Session logs are monitored by the Technical Jury.
                </p>
              </div>

              <div className="rule-card solar-card">
                <div className="rule-icon-box solar-icon-box">
                  <Icon name="award" size={20} className="text-gold" />
                </div>
                <h4>Scoring Rubric & Tie Breakers</h4>
                <p className="text-muted">
                  Round 1 and 2 award points on accuracy with time penalties for incorrect attempts.
                  Ties are resolved by total elapsed submission timestamp.
                </p>
              </div>
            </div>

            <div className="rules-cta-banner solar-cta-banner">
              <div>
                <h4>Ready to test your analytical intuition?</h4>
                <p className="text-muted">Register your student roll number and enter the competition arena.</p>
              </div>
              <button type="button" className="btn btn-primary" onClick={onJoin}>
                <Icon name="terminal" size={16} />
                <span>Join Arena</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

import React from 'react';
import { COMPETITION_ROUNDS } from '../data/mockData';
import { RoundCard } from './RoundCard';
import { Icon } from './Icon';
import type { RoundStateMap } from '../types/competition';

interface CompetitionRoundsProps {
  roundStates: RoundStateMap;
  isRegistered: boolean;
  onEnterRound: (roundId: number) => void;
  onOpenJoin: () => void;
}

export const CompetitionRounds: React.FC<CompetitionRoundsProps> = ({
  roundStates,
  isRegistered,
  onEnterRound,
  onOpenJoin,
}) => {
  return (
    <section className="section-wrapper rounds-section" id="rounds-section">
      <div className="section-container">
        {/* Section Header */}
        <div className="section-header text-center">
          <div className="section-kicker solar-kicker">
            <Icon name="flame" size={14} className="text-molten" />
            <span>BRAIN BYTES TOURNAMENT ARENA</span>
          </div>
          <h2 className="section-title">The Three Competition Rounds</h2>
          <p className="section-subtitle">
            Rounds are administered synchronously by event hosts. Once the admin unlocks a round,
            registered participants can enter the test environment directly.
          </p>
        </div>

        {/* Progression Flow Bar */}
        <div className="progression-flow-bar solar-flow" aria-label="Competition progression pathway">
          <div className="flow-step">
            <div className={`flow-dot ${roundStates[1] === 'active' ? 'active-molten' : ''}`} />
            <div className="flow-text">
              <span className="flow-title">Round 1: Data MCQ</span>
              <span className="flow-desc">
                {roundStates[1] === 'active' ? '⚡ Active Screening' : 'Elimination Stage'}
              </span>
            </div>
          </div>

          <div className="flow-divider">
            <span className="flow-rule">Top 40% Advance</span>
            <Icon name="arrow-right" size={16} />
          </div>

          <div className="flow-step">
            <div className={`flow-dot ${roundStates[2] === 'active' ? 'active-solar' : ''}`} />
            <div className="flow-text">
              <span className="flow-title">Round 2: Graph Challenge</span>
              <span className="flow-desc">
                {roundStates[2] === 'active' ? '⚡ Active Forensics' : 'Visual Analytics'}
              </span>
            </div>
          </div>

          <div className="flow-divider">
            <span className="flow-rule">Top 8 Advance</span>
            <Icon name="arrow-right" size={16} />
          </div>

          <div className="flow-step">
            <div className={`flow-dot gold ${roundStates[3] === 'active' ? 'active-gold' : ''}`} />
            <div className="flow-text">
              <span className="flow-title">Round 3: Rapid Fire</span>
              <span className="flow-desc">Live Stage Buzzer Finale</span>
            </div>
          </div>
        </div>

        {/* 3 Round Cards Grid */}
        <div className="rounds-grid">
          {COMPETITION_ROUNDS.map((round) => (
            <RoundCard
              key={round.id}
              round={round}
              status={roundStates[round.id] || 'locked'}
              isRegistered={isRegistered}
              onEnterRound={onEnterRound}
              onOpenJoin={onOpenJoin}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

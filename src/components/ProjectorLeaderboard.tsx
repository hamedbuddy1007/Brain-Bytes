import React from 'react';
import type { LeaderboardEntry } from '../types/competition';
import { AdminProjectorDisplay } from './admin/AdminProjectorDisplay';
import './admin/AdminControlCenter.css';

interface ProjectorLeaderboardProps {
  leaderboard: LeaderboardEntry[];
  onReturnToArena: () => void;
  onOpenAdmin: () => void;
}

export const ProjectorLeaderboard: React.FC<ProjectorLeaderboardProps> = ({
  onReturnToArena,
  onOpenAdmin,
}) => {
  return (
    <AdminProjectorDisplay
      onReturnToAdmin={onOpenAdmin}
      onReturnToArena={onReturnToArena}
    />
  );
};

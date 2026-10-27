import { AdminProjectorDisplay } from './admin/AdminProjectorDisplay';

import './admin/AdminControlCenter.css';

interface ProjectorLeaderboardProps {
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

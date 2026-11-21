import { useRecoilState } from 'recoil';
import { Clapperboard } from 'lucide-react';
import { Button, TooltipAnchor } from '@librechat/client';
import store from '~/store';

interface StudioLibraryButtonProps {
  side?: 'right' | 'bottom';
  onNavigate?: () => void;
}

export default function StudioLibraryButton({
  side = 'right',
  onNavigate,
}: StudioLibraryButtonProps) {
  const [showStudioLibrary, setShowStudioLibrary] = useRecoilState(store.showStudioLibraryPanel);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowStudioLibrary(!showStudioLibrary);
    onNavigate?.();
  };

  return (
    <TooltipAnchor
      side={side}
      description={showStudioLibrary ? "Close Studio Library" : "Open Studio Library Panel"}
      render={
        <Button
          variant={showStudioLibrary ? "surface" : "ghost"}
          size="icon"
          className="h-9 w-9 flex-shrink-0"
          data-testid="nav-studio-library-rail-button"
          aria-label="Studio Library"
          onClick={handleClick}
        >
          <Clapperboard
            className={`h-5 w-5 transition-colors ${
              showStudioLibrary ? 'text-primary' : 'text-text-primary'
            }`}
            aria-hidden="true"
          />
        </Button>
      }
    />
  );
}

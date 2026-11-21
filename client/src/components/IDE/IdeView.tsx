import { useEffect } from 'react';
import { Spinner } from '@librechat/client';
import { useNavigate } from 'react-router-dom';

/**
 * Redirects legacy shared `code-server` IDE route directly to Satchida Code (`/projects`),
 * enforcing per-user project isolation, concurrent seat-token attribution, and gateway policies.
 */
export default function IdeView() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/projects', { replace: true });
  }, [navigate]);

  return (
    <div className="flex h-full w-full items-center justify-center bg-surface-primary">
      <Spinner className="text-text-primary" />
    </div>
  );
}

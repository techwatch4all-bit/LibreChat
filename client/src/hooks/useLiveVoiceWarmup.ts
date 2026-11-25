import { useEffect } from 'react';
import { atom, useSetAtom } from 'jotai';

export interface LiveVoiceWarmState {
  ready: boolean;
  mode?: string;
  micPermission?: 'granted' | 'prompt' | 'denied' | 'unsupported';
  checkedAt?: number;
}

export const liveVoiceWarmAtom = atom<LiveVoiceWarmState>({
  ready: false,
});

const WARM_REFRESH_INTERVAL_MS = 45_000;

/**
 * Pre-tests Live Voice readiness (microphone API / permission status + backend ephemeral token)
 * as soon as the user logs in, and keeps the session warm while the tab is visible.
 */
export function useLiveVoiceWarmup(
  isAuthenticated: boolean,
  accountType?: string | null,
  token?: string | null,
) {
  const setWarmState = useSetAtom(liveVoiceWarmAtom);

  useEffect(() => {
    const normalizedTier = (accountType || '').toLowerCase();
    const isProVoice = ['pro', 'pro_family', 'enterprise', 'privacy'].includes(normalizedTier);
    if (!isAuthenticated || !isProVoice) {
      setWarmState({ ready: false });
      return;
    }

    let cancelled = false;

    const runWarmCheck = async () => {
      if (cancelled || document.visibilityState === 'hidden') {
        return;
      }

      let micPermission: LiveVoiceWarmState['micPermission'] =
        typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'
          ? 'prompt'
          : 'unsupported';

      if (typeof navigator !== 'undefined' && typeof navigator.permissions?.query === 'function') {
        try {
          const status = await navigator.permissions.query({
            name: 'microphone' as PermissionName,
          });
          if (status.state === 'granted' || status.state === 'prompt' || status.state === 'denied') {
            micPermission = status.state;
          }
        } catch {
          // Safari/some Android browsers do not support querying 'microphone'
        }
      }

      try {
        const headers: Record<string, string> = {};
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
        const res = await fetch('/api/voice/warm', {
          method: 'GET',
          headers,
          credentials: 'include',
        });
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as {
          ok?: boolean;
          warm?: boolean;
          mode?: string;
        };
        if (!cancelled) {
          setWarmState({
            ready: Boolean(data.ok && data.warm),
            mode: data.mode,
            micPermission,
            checkedAt: Date.now(),
          });
        }
      } catch {
        // Ignore transient network errors during background warmup
      }
    };

    void runWarmCheck();
    const timer = window.setInterval(() => {
      void runWarmCheck();
    }, WARM_REFRESH_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void runWarmCheck();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [accountType, isAuthenticated, setWarmState, token]);
}

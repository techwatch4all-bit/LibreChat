/* eslint-disable i18next/no-literal-string */
import React, { useState } from 'react';
import { getTokenHeader } from 'librechat-data-provider';
import { OGDialog, Button, OGDialogTemplate, useToastContext } from '@librechat/client';
import { useAuthContext } from '~/hooks/AuthContext';

interface FirstLoginClaimModalProps {
  open: boolean;
  onSuccess: () => void;
}

export default function FirstLoginClaimModal({ open, onSuccess }: FirstLoginClaimModalProps) {
  const { showToast } = useToastContext();
  const { token } = useAuthContext();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [challengeQuestion, setChallengeQuestion] = useState(
    'What was the name of your first school?',
  );
  const [challengeAnswer, setChallengeAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPassword || newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (!challengeAnswer.trim()) {
      setError('Please provide an answer to the security challenge question.');
      return;
    }

    setLoading(true);
    try {
      const authHeader = token ? `Bearer ${token}` : (getTokenHeader() ?? '');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }

      const res = await fetch('/api/auth/first-login-claim', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          currentPassword,
          newPassword,
          challengeQuestion,
          challengeAnswer,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to update credentials.');
      }

      showToast({ message: 'Security credentials updated successfully!', status: 'success' });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <OGDialog open={open} onOpenChange={() => {}}>
      <OGDialogTemplate
        title="Account Setup & Password Claim"
        className="w-full max-w-md"
        showCloseButton={false}
        main={
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
            <p className="text-sm text-text-secondary">
              Welcome to Satchida! Your account was created with a temporary password. You must set
              a new permanent password and a security recovery question to continue.
            </p>

            {error && (
              <div className="rounded border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-500">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-text-secondary">
                Current Temporary Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="focus:border-primary w-full rounded border border-border-light bg-surface-primary px-3 py-2 text-sm focus:outline-none"
                placeholder="Temporary password from your coordinator"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-text-secondary">
                New Permanent Password (8+ characters)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="focus:border-primary w-full rounded border border-border-light bg-surface-primary px-3 py-2 text-sm focus:outline-none"
                placeholder="Choose a strong password"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-text-secondary">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="focus:border-primary w-full rounded border border-border-light bg-surface-primary px-3 py-2 text-sm focus:outline-none"
                placeholder="Re-enter your new password"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-text-secondary">
                Security Recovery Question
              </label>
              <select
                value={challengeQuestion}
                onChange={(e) => setChallengeQuestion(e.target.value)}
                className="focus:border-primary w-full rounded border border-border-light bg-surface-primary px-3 py-2 text-sm focus:outline-none"
              >
                <option value="What was the name of your first school?">
                  What was the name of your first school?
                </option>
                <option value="In what city or town was your mother born?">
                  In what city or town was your mother born?
                </option>
                <option value="What was your favorite childhood food?">
                  What was your favorite childhood food?
                </option>
                <option value="What is the name of your first pet?">
                  What is the name of your first pet?
                </option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-text-secondary">Recovery Answer</label>
              <input
                type="text"
                required
                value={challengeAnswer}
                onChange={(e) => setChallengeAnswer(e.target.value)}
                className="focus:border-primary w-full rounded border border-border-light bg-surface-primary px-3 py-2 text-sm focus:outline-none"
                placeholder="Answer used if you ever forget your password"
              />
            </div>

            <div className="mt-2 flex justify-end">
              <Button type="submit" disabled={loading} className="w-full py-2">
                {loading ? 'Activating Account…' : 'Activate & Enter Workspace'}
              </Button>
            </div>
          </form>
        }
      />
    </OGDialog>
  );
}

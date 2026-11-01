import { useState } from 'react';
import { Spinner } from '@librechat/client';
import { useLocalize } from '~/hooks';
import {
  useCreateUserMutation,
  type CreateUserPayload,
} from '~/data-provider/admin/users';

interface CreateUserProps {
  onClose: () => void;
  onSaved: () => void;
}

export default function CreateUser({ onClose, onSaved }: CreateUserProps) {
  const localize = useLocalize();
  const createMutation = useCreateUserMutation();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('user');
  const [accountType, setAccountType] = useState('');
  const [quota, setQuota] = useState('100000');
  const [familyRole, setFamilyRole] = useState<string>('');
  const [familyAccountId, setFamilyAccountId] = useState('');
  const [useTempPassword, setUseTempPassword] = useState(true);
  const [password, setPassword] = useState('');
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  const submit = async () => {
    const payload: CreateUserPayload = {
      email,
      name: name || undefined,
      username: username || undefined,
      role: role || undefined,
      accountType: accountType || undefined,
      quota: quota ? parseInt(quota, 10) : undefined,
      familyRole: familyRole || null,
      familyAccountId: familyAccountId || null,
    };

    if (!useTempPassword && password) {
      payload.password = password;
    }

    try {
      const result = await createMutation.mutateAsync(payload);
      if (result.temporaryPassword) {
        setCreatedPassword(result.temporaryPassword);
      } else {
        onSaved();
        onClose();
      }
    } catch {}
  };

  if (createdPassword) {
    return (
      <div className="flex flex-col gap-4 text-text-primary">
        <div className="rounded-lg border border-border-light bg-surface-secondary p-4">
          <p className="text-sm font-semibold mb-2">User created successfully!</p>
          <p className="text-xs text-text-secondary mb-3">
            A temporary password was generated for <strong>{email}</strong>. Please copy and provide it to the user:
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={createdPassword}
              className="flex-1 rounded border border-border-light bg-surface-primary px-3 py-2 font-mono text-sm select-all"
            />
            <button
              className="rounded bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90"
              onClick={() => {
                navigator.clipboard.writeText(createdPassword);
                alert('Copied to clipboard');
              }}
            >
              Copy
            </button>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-white"
            onClick={() => {
              onSaved();
              onClose();
            }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 text-text-primary">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{localize('com_admin_users_email')} *</span>
          <input
            className="w-full rounded border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">{localize('com_admin_users_name')}</span>
          <input
            className="w-full rounded border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">{localize('com_admin_users_username')}</span>
          <input
            className="w-full rounded border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="jane.doe"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">{localize('com_admin_users_role')}</span>
          <select
            className="w-full rounded border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="user">{localize('com_admin_users_role_user') || 'User'}</option>
            <option value="admin">{localize('com_admin_users_role_admin') || 'Admin'}</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            {localize('com_admin_users_account_type') || 'Account Tier'}
          </span>
          <select
            className="w-full rounded border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary"
            value={accountType}
            onChange={(e) => setAccountType(e.target.value)}
          >
            <option value="">{localize('com_admin_users_no_account_type') || '— None —'}</option>
            <option value="basic">basic</option>
            <option value="pro">pro</option>
            <option value="family">family</option>
            <option value="enterprise">enterprise</option>
            <option value="privacy">privacy</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Token credits / month</span>
          <input
            className="w-full rounded border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary"
            type="number"
            min="1"
            value={quota}
            onChange={(e) => setQuota(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Family Role</span>
          <select
            className="w-full rounded border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary"
            value={familyRole}
            onChange={(e) => setFamilyRole(e.target.value)}
          >
            <option value="">— None —</option>
            <option value="owner">Owner (Primary)</option>
            <option value="adult">Adult (Secondary)</option>
            <option value="minor">Minor (Child / Supervised)</option>
          </select>
        </label>

        {familyRole === 'minor' && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Guardian Account ID / Email</span>
            <input
              className="w-full rounded border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary"
              value={familyAccountId}
              onChange={(e) => setFamilyAccountId(e.target.value)}
              placeholder="Parent/Guardian user ID"
            />
          </label>
        )}
      </div>

      <div className="border-t border-border-light pt-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer mb-3">
          <input
            type="checkbox"
            checked={!useTempPassword}
            onChange={(e) => setUseTempPassword(!e.target.checked)}
          />
          <span>Set a specific password (otherwise auto-generate secure temp password)</span>
        </label>

        {!useTempPassword && (
          <label className="block mb-2">
            <span className="mb-1 block text-sm font-medium">Initial Password</span>
            <input
              className="w-full rounded border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
            />
          </label>
        )}
      </div>

      {createMutation.isError && (
        <p className="text-sm text-red-500" role="alert">
          {(createMutation.error as Error)?.message}
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-border-light pt-3">
        <button
          className="rounded border border-border-light px-4 py-2 text-sm text-text-primary hover:bg-surface-secondary"
          onClick={onClose}
        >
          {localize('com_ui_cancel')}
        </button>
        <button
          className="flex items-center gap-1 rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={submit}
          disabled={createMutation.isPending || !email}
        >
          {createMutation.isPending ? <Spinner /> : 'Create User'}
        </button>
      </div>
    </div>
  );
}

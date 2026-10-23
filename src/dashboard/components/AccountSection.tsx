import React, { useCallback, useEffect, useState } from 'react';
import { Cloud, LogIn, LogOut } from 'lucide-react';
import type { CloudAccount } from '../../services/auth/authService';

interface BackgroundResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

function send<T>(type: string): Promise<BackgroundResponse<T>> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      resolve({ success: false, error: 'LexiFlow Cloud is only available inside the extension.' });
      return;
    }
    chrome.runtime.sendMessage({ type }, (res?: BackgroundResponse<T>) => {
      resolve(res ?? { success: false, error: chrome.runtime.lastError?.message || 'No response from LexiFlow.' });
    });
  });
}

type Status = 'loading' | 'idle' | 'signing-in' | 'signing-out' | 'deleting';

export const AccountSection: React.FC = () => {
  const [account, setAccount] = useState<CloudAccount | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const loadAccount = useCallback(async () => {
    const res = await send<CloudAccount | null>('GET_ACCOUNT');
    if (res.success) {
      setAccount(res.data ?? null);
    } else {
      setError(res.error || 'Could not load your account.');
    }
    setStatus('idle');
  }, []);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  const handleSignIn = async () => {
    setError(null);
    setStatus('signing-in');
    const res = await send<CloudAccount | null>('AUTH_LOGIN');
    if (res.success) {
      setAccount(res.data ?? null);
    } else if (res.code !== 'CANCELLED') {
      setError(res.error || 'Sign-in failed. Try again.');
    }
    setStatus('idle');
  };

  const handleSignOut = async () => {
    setError(null);
    setStatus('signing-out');
    await send('AUTH_LOGOUT');
    setAccount(null);
    setStatus('idle');
  };

  const handleDeleteAccount = async () => {
    setError(null);
    setStatus('deleting');
    const res = await send('AUTH_DELETE_ACCOUNT');
    if (res.success) {
      setAccount(null);
      setConfirmingDelete(false);
    } else {
      setError(res.error || 'Could not delete your account. Try again.');
    }
    setStatus('idle');
  };

  const usage = account?.usage;
  const usedPct = usage && usage.limit > 0 ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;
  const resetTime = usage
    ? new Date(usage.resetAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '';

  return (
    <div className="card account-card">
      <div className="settings-section-header">
        <div className="settings-section-icon">
          <Cloud size={18} />
        </div>
        <div>
          <h4 className="settings-section-title">LexiFlow Cloud Account</h4>
          <p className="settings-section-subtitle">
            Sign in to use LexiFlow AI without your own API key
          </p>
        </div>
      </div>

      {status === 'loading' ? (
        <p className="account-muted">Checking your account…</p>
      ) : account ? (
        <div className="account-body">
          <div className="account-row">
            <div className="account-identity">
              <div className="account-name">{account.user.name || account.user.email}</div>
              {account.user.name && <div className="account-muted">{account.user.email}</div>}
            </div>
            <span className={`account-plan account-plan-${account.plan}`}>
              {account.plan === 'pro' ? 'Pro' : 'Free'}
            </span>
          </div>

          {usage && (
            <div className="account-usage">
              <div className="account-usage-label">
                <span>
                  <strong>{usage.used}</strong> / {usage.limit} credits used today
                </span>
                <span className="account-muted">Resets at {resetTime}</span>
              </div>
              <div
                className="account-usage-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={usage.limit}
                aria-valuenow={usage.used}
                aria-label="Credits used today"
              >
                <div
                  className={`account-usage-fill ${usedPct >= 90 ? 'is-high' : ''}`}
                  style={{ width: `${usedPct}%` }}
                />
              </div>
            </div>
          )}

          <div>
            <button type="button" className="btn-secondary" onClick={handleSignOut} disabled={status !== 'idle'}>
              <LogOut size={14} /> {status === 'signing-out' ? 'Signing out…' : 'Sign out'}
            </button>
          </div>

          {confirmingDelete ? (
            <div className="account-delete-confirm" role="group" aria-label="Confirm account deletion">
              <p>
                This permanently deletes your LexiFlow Cloud account, plan and usage history on every device.
                Vocabulary saved in this browser is not affected.
              </p>
              <div className="account-delete-actions">
                <button type="button" className="btn-danger" onClick={handleDeleteAccount} disabled={status !== 'idle'}>
                  {status === 'deleting' ? 'Deleting…' : 'Delete my account'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setConfirmingDelete(false)} disabled={status !== 'idle'}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="account-delete-link" onClick={() => setConfirmingDelete(true)} disabled={status !== 'idle'}>
              Delete account…
            </button>
          )}
        </div>
      ) : (
        <div className="account-body">
          <p className="account-muted">
            Your vocabulary stays on this device. Only the text you look up is sent to LexiFlow Cloud for analysis.
          </p>
          <div>
            <button type="button" className="btn-primary" onClick={handleSignIn} disabled={status !== 'idle'}>
              <LogIn size={14} /> {status === 'signing-in' ? 'Waiting for Google…' : 'Sign in with Google'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="account-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

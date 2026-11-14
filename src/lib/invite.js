import * as api from './api.js';

const KEY = 'baton_invite';

// Accepts a bare token or a full invite link such as https://host/auth?invite=<token>.
export function parseInviteToken(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const token = new URL(text).searchParams.get('invite');
    if (token) return token.trim();
  } catch {
    const match = /[?&]invite=([^&\s#]+)/.exec(text);
    if (match) return decodeURIComponent(match[1]);
  }
  return text;
}

export function storePendingInvite(token) {
  try {
    if (token) sessionStorage.setItem(KEY, token);
  } catch {}
}

export function getPendingInvite() {
  try {
    return sessionStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

export function clearPendingInvite() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}

// Saves ?invite=<token> from the current URL and strips it from the address bar.
export function captureInviteFromUrl() {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  const token = params.get('invite');
  if (!token) return getPendingInvite();
  storePendingInvite(token.trim());
  params.delete('invite');
  const query = params.toString();
  window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash);
  return token.trim();
}

export function inviteErrorMessage(err) {
  const text = String(err?.message || '');
  if (/email/i.test(text)) return 'This invite was issued for a different email address. Sign in with the invited email, or ask your admin for a new link.';
  if (/Invalid invite token/i.test(text)) return 'This invite link is incomplete or wrong. Copy the full link from your admin and try again.';
  if (/expired|already|invalid/i.test(text)) return 'This invite is expired, already used, or invalid. Ask your admin for a new invite link.';
  return text || 'This invite could not be accepted.';
}

// Accepts a stored invite (if any). Always clears it so a bad link cannot block later sign-ins.
export async function acceptPendingInvite() {
  const token = getPendingInvite();
  if (!token) return { status: 'none' };
  try {
    const res = await api.acceptInvite(token);
    clearPendingInvite();
    return { status: 'accepted', organizationId: res?.organization_id || null };
  } catch (err) {
    clearPendingInvite();
    return { status: 'error', message: inviteErrorMessage(err) };
  }
}

import { supabase } from './supabase.js';

let activeDemoUser = typeof window !== 'undefined' ? (localStorage.getItem('baton_demo_user') || 'demo-admin') : 'demo-admin';

export function getDemoUser() {
  return activeDemoUser;
}

export function setDemoUser(userId) {
  activeDemoUser = userId;
  if (typeof window !== 'undefined') {
    localStorage.setItem('baton_demo_user', userId);
  }
}

async function request(endpoint, options = {}) {
  const headers = { ...(options.headers || {}) };

  let token = null;
  try {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token;
  } catch (err) {
    // Supabase auth not ready or not configured
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (activeDemoUser) {
    headers['x-baton-demo-user'] = activeDemoUser;
  }

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  let payload = null;
  if (contentType.includes('application/json')) {
    payload = await res.json().catch(() => null);
  } else {
    payload = await res.text().catch(() => null);
  }

  if (!res.ok) {
    const msg = (payload && payload.error) || (typeof payload === 'string' ? payload : res.statusText) || 'API error';
    const err = new Error(msg);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }

  return payload;
}

export async function fetchHealth() {
  return request('/api/health');
}

export async function fetchMe() {
  return request('/api/me');
}

export async function createOrg(name) {
  return request('/api/orgs', {
    method: 'POST',
    body: { name },
  });
}

export async function fetchOrgState(orgId) {
  return request(`/api/orgs/${encodeURIComponent(orgId)}/state`);
}

export async function createInvite(orgId, role = 'member', email = null) {
  return request(`/api/orgs/${encodeURIComponent(orgId)}/invites`, {
    method: 'POST',
    body: { role, email },
  });
}

export async function acceptInvite(token) {
  return request('/api/invites/accept', {
    method: 'POST',
    body: { token },
  });
}

export async function createToken(orgId, name) {
  return request(`/api/orgs/${encodeURIComponent(orgId)}/tokens`, {
    method: 'POST',
    body: { name },
  });
}

export async function deleteToken(orgId, tokenId) {
  return request(`/api/orgs/${encodeURIComponent(orgId)}/tokens/${encodeURIComponent(tokenId)}`, {
    method: 'DELETE',
  });
}

export async function updateMember(orgId, memberId, patch) {
  return request(`/api/orgs/${encodeURIComponent(orgId)}/members/${encodeURIComponent(memberId)}`, {
    method: 'PATCH',
    body: patch,
  });
}

export async function createMemory(orgId, payload) {
  return request(`/api/orgs/${encodeURIComponent(orgId)}/memories`, {
    method: 'POST',
    body: payload,
  });
}

export async function updateMemory(orgId, memoryId, patch) {
  return request(`/api/orgs/${encodeURIComponent(orgId)}/memories/${encodeURIComponent(memoryId)}`, {
    method: 'PATCH',
    body: patch,
  });
}

export async function deleteMemory(orgId, memoryId) {
  return request(`/api/orgs/${encodeURIComponent(orgId)}/memories/${encodeURIComponent(memoryId)}`, {
    method: 'DELETE',
  });
}

export async function createTask(orgId, payload) {
  return request(`/api/orgs/${encodeURIComponent(orgId)}/tasks`, {
    method: 'POST',
    body: payload,
  });
}

export async function updateTask(taskId, patch) {
  return request(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    body: patch,
  });
}

export async function createTaskComment(taskId, content, parentId = null) {
  return request(`/api/tasks/${encodeURIComponent(taskId)}/comments`, {
    method: 'POST',
    body: { content, parent_id: parentId },
  });
}

export async function getGithubConnectUrl(orgId) {
  return request(`/api/orgs/${encodeURIComponent(orgId)}/github/connect`);
}

export async function getGithubInstallations(orgId) {
  return request(`/api/orgs/${encodeURIComponent(orgId)}/github/installations`);
}

export async function getGithubInstallationRepos(orgId, installationId) {
  return request(`/api/orgs/${encodeURIComponent(orgId)}/github/installations/${encodeURIComponent(installationId)}/repositories`);
}

// installationId is optional: the server can resolve the installation from the repository name.
export async function connectRepo(orgId, installationId, fullName) {
  const body = { fullName, full_name: fullName };
  if (installationId) body.installationId = installationId;
  return request(`/api/orgs/${encodeURIComponent(orgId)}/repositories`, {
    method: 'POST',
    body,
  });
}

export async function disconnectRepo(orgId, repoId) {
  return request(`/api/orgs/${encodeURIComponent(orgId)}/repositories/${encodeURIComponent(repoId)}`, {
    method: 'DELETE',
  });
}

export async function renameOrg(orgId, name) {
  return request(`/api/orgs/${encodeURIComponent(orgId)}`, {
    method: 'PATCH',
    body: { name },
  });
}

export async function resetOrg(orgId, confirm, scope) {
  return request(`/api/orgs/${encodeURIComponent(orgId)}/reset`, {
    method: 'POST',
    body: { confirm, scope },
  });
}

export async function deleteOrg(orgId, confirm) {
  return request(`/api/orgs/${encodeURIComponent(orgId)}`, {
    method: 'DELETE',
    body: { confirm },
  });
}

export async function exportHandoverMarkdown(handoverId) {
  return request(`/api/handovers/${encodeURIComponent(handoverId)}/export.md`);
}

// The server reports a missing GitHub App installation with a URL in the payload or inside the message.
export function installUrlFromError(err) {
  const fromPayload = err?.payload && typeof err.payload === 'object' ? err.payload.install_url : null;
  if (fromPayload) return fromPayload;
  const match = /https:\/\/github\.com\/[^\s)'"]+/.exec(err?.message || '');
  return match ? match[0] : null;
}

export async function syncRepo(orgId, repoId) {
  return request(`/api/orgs/${encodeURIComponent(orgId)}/repositories/${encodeURIComponent(repoId)}/sync`, {
    method: 'POST',
  });
}

export async function fetchRisks(orgId) {
  return request(`/api/orgs/${encodeURIComponent(orgId)}/risks`);
}

export async function startHandover(orgId, leaverId, incomingId) {
  return request(`/api/orgs/${encodeURIComponent(orgId)}/handovers`, {
    method: 'POST',
    body: { leaverId, incomingId },
  });
}

export async function getHandover(handoverId) {
  return request(`/api/handovers/${encodeURIComponent(handoverId)}`);
}

export async function answerQuestion(handoverId, questionId, answer) {
  return request(`/api/handovers/${encodeURIComponent(handoverId)}/answers`, {
    method: 'POST',
    body: { questionId, answer },
  });
}

export async function generateHandover(handoverId) {
  return request(`/api/handovers/${encodeURIComponent(handoverId)}/generate`, {
    method: 'POST',
    body: {},
  });
}

export async function updateClaim(handoverId, claimId, patch) {
  return request(`/api/handovers/${encodeURIComponent(handoverId)}/claims/${encodeURIComponent(claimId)}`, {
    method: 'PATCH',
    body: patch,
  });
}

export async function approveHandover(handoverId) {
  return request(`/api/handovers/${encodeURIComponent(handoverId)}/approve`, {
    method: 'POST',
    body: {},
  });
}

export async function acknowledgeHandover(handoverId) {
  return request(`/api/handovers/${encodeURIComponent(handoverId)}/acknowledge`, {
    method: 'POST',
    body: {},
  });
}

export async function askHandover(handoverId, question) {
  return request(`/api/handovers/${encodeURIComponent(handoverId)}/ask`, {
    method: 'POST',
    body: { question },
  });
}

export async function skipQuestion(handoverId, questionId) {
  return request(`/api/handovers/${encodeURIComponent(handoverId)}/questions/${encodeURIComponent(questionId)}/skip`, {
    method: 'POST',
    body: {},
  });
}

export async function resolveConflict(handoverId, claimId, { resolution, chosenSourceId }) {
  return request(`/api/handovers/${encodeURIComponent(handoverId)}/conflicts/${encodeURIComponent(claimId)}/resolve`, {
    method: 'POST',
    body: { resolution, chosen_source_id: chosenSourceId || null },
  });
}

export async function listVersions(handoverId) {
  return request(`/api/handovers/${encodeURIComponent(handoverId)}/versions`);
}

export async function diffVersions(handoverId, from, to) {
  const query = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  return request(`/api/handovers/${encodeURIComponent(handoverId)}/versions/diff?${query}`);
}


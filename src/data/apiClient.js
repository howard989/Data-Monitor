const API_URL = '/api'; 

class HttpError extends Error {
  constructor(status, message) {
    super(message || 'HTTP');
    this.status = status;
  }
}

let refreshing = null;

async function refreshAccessToken() {
  // const r = await fetch(`${API_URL}/api/auth/refresh`, { 
    const r = await fetch(`${API_URL}/auth/refresh`, { 
    method: 'POST', 
    credentials: 'include' 
  });
  if (!r.ok) throw new HttpError(r.status);
  const data = await r.json();
  const token = data.token;
  if (!token) throw new HttpError(500);
  
  localStorage.setItem('authToken', token);
  return token;
}

function forceLogout() {
  try { 
    localStorage.removeItem('authToken'); 
  } catch {}
  if (typeof window !== 'undefined') {
    window.location.assign('/login');
  }
}

export async function authFetch(input, init = {}) {
  const headers = new Headers(init.headers || {});
  const token = localStorage.getItem('authToken'); 
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  
  let res = await fetch(input, { ...init, headers, credentials: 'include' });
  if (res.status !== 401) return res;
  
  if (!refreshing) {
    refreshing = refreshAccessToken().finally(() => { refreshing = null; });
  }
  
  try {
    const newToken = await refreshing;
    const retryHeaders = new Headers(init.headers || {});
    retryHeaders.set('Authorization', `Bearer ${newToken}`);
    if (!retryHeaders.has('Content-Type')) retryHeaders.set('Content-Type', 'application/json');
    
    res = await fetch(input, { ...init, headers: retryHeaders, credentials: 'include' });
    if (res.status === 401) {
      forceLogout();
      throw new HttpError(401);
    }
    return res;
  } catch {
    forceLogout();
    throw new HttpError(401);
  }
}

if (typeof window !== 'undefined') {
  const tryProactiveRefresh = () => {
    const t = localStorage.getItem('authToken');
    if (!t) return;
    refreshAccessToken().catch(() => {});
  };
  
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      tryProactiveRefresh();
    }
  });
  
  window.addEventListener('online', tryProactiveRefresh);
}

export { API_URL };
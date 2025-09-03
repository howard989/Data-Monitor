// const API_URL = 'http://localhost:3001';
const API_URL = 'http://15.204.163.45:8192';

class HttpError extends Error {
  constructor(status, message) {
    super(message || 'HTTP');
    this.status = status;
  }
}

let refreshing = null;

async function refreshAccessToken() {
  const r = await fetch(`${API_URL}/api/auth/refresh`, { 
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
    if (res.status === 401) throw new HttpError(401);
    return res;
  } catch {
    throw new HttpError(401);
  }
}

export { API_URL };
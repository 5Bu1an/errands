const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

// Shared fetch helper: every feature calls the API through this.
// Throws an Error with the server's own message when the request fails.
export async function api(path, { method = 'GET', body, token = localStorage.getItem('accessToken') } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && path !== '/auth/login') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userId');
    window.location.assign('/login');
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    const message = data?.errors
      ? Object.values(data.errors).join(' ')
      : data?.error || `${method} ${path} failed: ${res.status}`;
    throw new Error(message);
  }

  return data;
}

export function formatTime(value) {
  return new Date(value).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

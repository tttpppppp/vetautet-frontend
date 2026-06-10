const PRODUCTION_API_URL = 'https://vetautet-backend-1.onrender.com/api/v1';
const DEVELOPMENT_API_URL = 'http://localhost:8080/api/v1';

const normalizeUrl = (url: string) => url.replace(/\/+$/, '');

const toWebSocketUrl = (apiUrl: string) => {
  const normalized = normalizeUrl(apiUrl);
  return normalized
    .replace(/^https:\/\//, 'wss://')
    .replace(/^http:\/\//, 'ws://') + '/ws';
};

export const API_BASE_URL = normalizeUrl(
  import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD ? PRODUCTION_API_URL : DEVELOPMENT_API_URL)
);

export const WS_BASE_URL = normalizeUrl(
  import.meta.env.VITE_WS_URL || toWebSocketUrl(API_BASE_URL)
);

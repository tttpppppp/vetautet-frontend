import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../store/useAuthStore';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: string;
              size?: string;
              text?: string;
              shape?: string;
              width?: number;
              logo_alignment?: string;
            }
          ) => void;
        };
      };
    };
  }
}

export default function GoogleLoginButton() {
  const navigate = useNavigate();
  const loginStore = useAuthStore();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buttonWidth, setButtonWidth] = useState(320);

  const handleGoogleCallback = useCallback(async (response: { credential?: string }) => {
    if (!response.credential) {
      setError('Không nhận được token Google.');
      return;
    }

    setError(null);

    try {
      const data = await authApi.googleLogin(response.credential);
      loginStore.login(data);
      localStorage.setItem('userEmail', data.email);
      navigate('/');
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.code ||
        'Đăng nhập Google thất bại.';
      setError(message);
    }
  }, [loginStore, navigate]);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateWidth = () => {
      if (!containerRef.current) return;
      setButtonWidth(Math.max(220, Math.floor(containerRef.current.clientWidth)));
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(() => updateWidth());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Thiếu cấu hình Google Client ID.');
      return;
    }

    let cancelled = false;

    const renderGoogleButton = () => {
      if (cancelled || !window.google || !containerRef.current) return false;

      containerRef.current.innerHTML = '';

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCallback,
      });

      window.google.accounts.id.renderButton(containerRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        width: buttonWidth,
        logo_alignment: 'left',
      });

      return true;
    };

    if (renderGoogleButton()) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (renderGoogleButton()) {
        window.clearInterval(intervalId);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [buttonWidth, handleGoogleCallback]);

  return (
    <div className="space-y-2">
      <div className="relative min-h-[46px] w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50 active:scale-[0.98]">
        <div className="pointer-events-none flex min-h-[46px] w-full items-center justify-center gap-2 px-4 py-3">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12S17.4 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5Z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15 18.9 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7Z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.1 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.7 39.6 16.3 44 24 44Z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 2.8-2.8 4.9-5 6.4l.1-.1 6.2 5.2C36.2 39 44 34 44 24c0-1.3-.1-2.4-.4-3.5Z" />
          </svg>
          <span className="text-xs font-bold text-gray-600">Đăng nhập bằng Google</span>
        </div>
        <div
          className="absolute inset-0 z-10 opacity-0"
          ref={containerRef}
        />
      </div>
      {error ? (
        <p className="flex items-center gap-1 text-[10px] font-bold text-tet-red">
          <AlertCircle size={12} />
          {error}
        </p>
      ) : null}
    </div>
  );
}

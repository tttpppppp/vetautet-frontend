export const AUTH_MESSAGE_CODES = [
  'ACCOUNT_CREATED_OTP_SENT',
  'EMAIL_UNVERIFIED_OTP_SENT',
  'EMAIL_ALREADY_USED',
  'EMAIL_VERIFIED',
  'EMAIL_ALREADY_VERIFIED',
  'LOGIN_REQUIRES_EMAIL_VERIFICATION',
  'INVALID_OTP',
  'EXPIRED_OTP',
  'INVALID_OR_EXPIRED_OTP',
  'OTP_ALREADY_USED',
  'OTP_RESENT',
  'USER_NOT_FOUND',
] as const;

export type AuthMessageCode = (typeof AUTH_MESSAGE_CODES)[number];

export const getAuthResponseCode = (value: any): string | null => {
  if (!value) return null;
  return value.code || value.error || value.message || null;
};

export const resolveAuthMessage = (
  t: (key: string, options?: any) => string,
  payload: any,
  fallback: string
) => {
  const code = getAuthResponseCode(payload);
  if (!code) return fallback;
  return t(`messages.${code}`, { defaultValue: fallback || code });
};

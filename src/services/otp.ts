const CLOUD_DB_URL = 'https://zo7vbabeq.dexie.cloud';

export class OTPLoginError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'OTPLoginError';
    this.status = status;
  }
}

async function requestOTPe(email: string, body: object): Promise<void> {
  const res = await fetch(`${CLOUD_DB_URL}/auth/otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, ...body }),
  });
  if (res.status === 422) {
    throw new OTPLoginError('Email not registered. Register first or use demo account.', 422);
  }
  if (!res.ok) {
    throw new OTPLoginError('Failed to send OTP. Please try again.', res.status);
  }
}

export async function requestOTP(email: string): Promise<void> {
  await requestOTPe(email, {});
}

export async function registerOTP(email: string): Promise<void> {
  await requestOTPe(email, { mode: 'register' });
}

export async function verifyOTP(email: string, otp: string): Promise<void> {
  const res = await fetch(`${CLOUD_DB_URL}/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  });
  if (!res.ok) {
    throw new OTPLoginError('Invalid OTP. Please try again.', res.status);
  }
}

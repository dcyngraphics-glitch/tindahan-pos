import { db } from '../services/db';

export class OTPLoginError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'OTPLoginError';
    this.status = status;
  }
}

/**
 * Send OTP request via the built-in Dexie Cloud OTP dialog.
 * This replaces custom API calls which don't exist on the Dexie Cloud server.
 *
 * The built-in dialog shows a mail/OTP interface where the user enters their email
 * and one-time password. After verification, the user is logged in automatically.
 *
 * @param email - The email address to send OTP to
 * @returns Promise that resolves when login is complete
 */
export async function requestOTP(email: string): Promise<void> {
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    throw new OTPLoginError('Please enter a valid email address.');
  }

  try {
    // Trigger the built-in Dexie Cloud OTP dialog and wait for completion
    await db.cloud.login();
  } catch (err: any) {
    throw new OTPLoginError(err?.message || 'Failed to send OTP. Please try again.', err?.status || 500);
  }
}


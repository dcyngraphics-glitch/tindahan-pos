const PIN_HASH_KEY = 'tindahan_cashier_pin_hash';

/** The stored SHA-256 hash of the cashier PIN, or null when none is set. */
export function getCashierPinHash(): string | null {
  try {
    return localStorage.getItem(PIN_HASH_KEY);
  } catch {
    // localStorage unavailable (private browsing, storage quota)
    return null;
  }
}

export function setCashierPinHash(hash: string): void {
  try {
    localStorage.setItem(PIN_HASH_KEY, hash);
  } catch {
    // localStorage unavailable — the PIN simply will not persist
  }
}

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

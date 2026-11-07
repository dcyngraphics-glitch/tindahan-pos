import { describe, it, expect } from 'vitest';
import { db } from '../db';

/**
 * Guards the Dexie Cloud wiring.
 *
 * Sync broke silently because this app shared barcode-inventory's cloud database
 * (zo7vbabeq). That database had already registered `products` with the primary key
 * `productId`; this app declares `products` with `id`. Dexie Cloud refuses to change the
 * primary key of an existing table, so every /sync was rejected with
 * 422 Unprocessable Content and nothing ever synced.
 *
 * These assertions are the cheap tripwire: they fail on a revert to the shared database
 * or to a mismatched schema, without needing a browser or an emailed OTP.
 */
describe('Dexie Cloud sync configuration', () => {
  it("points at tindahan-pos's own database", () => {
    expect(db.cloud?.options?.databaseUrl).toBe('https://z1n6s3n1x.dexie.cloud');
  });

  it('does not share barcode-inventory\'s database (the 422 primary-key clash)', () => {
    expect(db.cloud?.options?.databaseUrl ?? '').not.toContain('zo7vbabeq');
  });

  it('declares the primary keys the app actually uses', () => {
    // Dexie Cloud only cares about the primary key name and whether it is generated.
    expect(db.products.schema.primKey.name).toBe('id');
    expect(db.transactions.schema.primKey.name).toBe('id');
  });

  it('names the local database after the cloud it syncs to', () => {
    // configure() renames the local IndexedDB to `<name>-<first label of the host>`.
    // A mismatch here means the app and its sync target have drifted apart.
    expect(db.name).toBe('TindahanPOS-z1n6s3n1x');
  });

  it('gates auth in React, not through requireAuth', () => {
    // requireAuth:true makes the addon raise its own login prompt from Dexie's ready
    // handler, before the user can pick a role. AuthGate in App.tsx owns the gate, so
    // the Sign In button can start the OTP flow after the role is known.
    expect(db.cloud?.options?.requireAuth).toBe(false);
  });

  it('renders the login prompts through the app UI', () => {
    expect(db.cloud?.options?.customLoginGui).toBe(true);
  });
});

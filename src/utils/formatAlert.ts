/**
 * Dexie Cloud delivers user-facing alerts as a template plus a params map, e.g.
 *
 *   { message: 'A One-Time password has been sent to {email}',
 *     messageParams: { email: 'me@example.com' } }
 *
 * The raw template must never reach the screen, so substitute the tokens. Unknown
 * tokens are left visible rather than replaced with "undefined" — a missing param is a
 * bug, and seeing "{email}" on screen reports it honestly instead of hiding it.
 */
export function formatAlertMessage(alert: any): string {
  const message: string = alert?.message ?? '';
  const params: Record<string, unknown> = alert?.messageParams ?? {};

  return message.replace(/\{(\w+)\}/g, (match: string, key: string) =>
    params[key] === undefined ? match : String(params[key]),
  );
}

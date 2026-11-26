/**
 * Jonard dashboard credentials.
 *
 * api_key is public (bundled into the app). api_secret is a bcrypt hash of the
 * real secret on the worker, sent as X-App-Secret on every /api/auth/validate
 * call. Regenerate by re-running this script and redeploy the apps.
 */
export const JONARD_API_URL = 'https://jonard.jonard.workers.dev';
export const JONARD_API_KEY = 'jk_32879807ae39b289c9e322cd';
export const JONARD_API_SECRET = 'a402a8af7510a3170883bb103d13bdaf';

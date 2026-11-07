# Login State Transitions

Auth is owned by Dexie Cloud (`db.cloud`), not by the app. The app only remembers
which ROLE to enter as (`tindahan_auth` in localStorage).

## Gate states (App.tsx `AuthGate`)

- `isLoading` — the cloud session is still being restored from IndexedDB. Splash.
- `error` — the local database could not be opened. Terminal message, not a spinner.
- `isLoggedIn` — render `MainApp`.
- otherwise — render `LoginScreen`.

## Sign-in

1. `LoginScreen`: the user picks Cashier or Inventory Staff and presses **Sign In**.
2. `useAuthStore.login(role)` persists the role locally.
3. `useAuth().cloudLogin()` calls `db.cloud.login({ grant_type: 'otp' })`.
4. Dexie Cloud drives the conversation itself and asks for input through
   `db.cloud.userInteraction`:
   - an **email** prompt, then
   - an **OTP** prompt (6 characters).
   `UserInteractionPrompt` renders both, in this app's styling.
5. `db.cloud.login()` resolves only once the code is verified;
   `useCloudSession().isLoggedIn` flips and `AuthGate` swaps in `MainApp`.

With `requireAuth: true` the addon also starts that prompt itself from Dexie's
`ready` handler when nobody is signed in, so the email prompt appears on first
load without the user pressing anything. A cancelled prompt is swallowed by the
addon, so `db.open()` still settles and the login screen is shown.

## Sign-up

There is no separate sign-up. `cloudLogin()` deliberately omits `intent`, which
lets the server register a brand-new user on first sign-in. The login screen's
copy says so: "Your account is created the first time you sign in."

## Sign-out

`useAuth().signOut()` → `db.cloud.logout()` (the addon may ask for confirmation
when there are unsynced changes) → `useAuthStore.logout()` clears the role.

Called from the header **Logout** button, from `ModeNav`, and from
`DeveloperSettingsModal`. If the cloud logout is dismissed, the local role is
deliberately kept so the app is not left half-signed-out.

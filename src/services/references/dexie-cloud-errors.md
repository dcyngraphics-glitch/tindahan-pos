# Dexie Cloud Errors

Dexie Cloud reports failures through `db.cloud.userInteraction` alerts, which
`UserInteractionPrompt` renders — the app never parses HTTP status codes itself.

Each `DXCAlert` carries:

- `type`: `'error'` | `'warning'` | `'info'`
- `messageCode`: `INVALID_OTP`, `INVALID_EMAIL`, `USER_NOT_REGISTERED`,
  `USER_NOT_ACCEPTED`, `NO_SEATS_AVAILABLE`, `USER_DEACTIVATED`, `OTP_SENT`, ...
- `message` + `messageParams` — a template such as
  `'A One-Time password has been sent to {email}'`

`utils/formatAlert.ts` substitutes the `{tokens}`. Unknown tokens are left
visible rather than replaced with "undefined", so a missing param is obvious.

Connectivity and configuration failures arrive the same way, e.g.:

> Could not connect to server. Please verify that your origin
> 'http://localhost:5173' is whitelisted using `npx dexie-cloud whitelist`

## Rejections from `db.cloud.login()`

- `AbortError` — the user dismissed a prompt. Not an error; ignore it.
- `OAuthRedirectError` — the page is redirecting for an OAuth provider. Not an
  error; ignore it.
- `PolicyRejectionError` — the server refused (seat limit, deactivated user, …).
  Surface `err.message` through `cloudError`.

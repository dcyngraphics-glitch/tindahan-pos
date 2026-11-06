# Dexie Cloud Error Codes

## 422 Unprocessable Entity
- **Meaning**: Email not registered (for `requestOTP`), or OTP invalid (for `verifyOTP`).
- **Action**: For `requestOTP`, show "Email not registered. Please register." For `verifyOTP`, show "Invalid OTP. Please check your email and try again."

## 401 Unauthorized
- **Meaning**: Authentication failed (bad token, expired session).
- **Action**: Redirect to login, prompt for re-authentication.

## 500 Server Error
- **Meaning**: Server-side error.
- **Action**: Show generic "Login failed. Please try again." and log the error.

## General Pattern
- Wrap all `fetch` calls in try/catch.
- Distinguish `OTPLoginError` (422/401/500) from network errors (no response).
- Show user-friendly messages for `OTPLoginError`, not raw error strings.

# Login State Transitions

## Role: Inventory Staff
- **Post-OTP**: `login(role, '')` → `isAuthenticated: true`, `role: 'inventory'`
- **PIN stage**: SKIPPED (no PIN needed)
- **Post-login**: Inventory dashboard

## Role: Cashier
- **Post-OTP (no PIN)**: `setPinStage('setup')` → PIN setup screen
- **Post-OTP (has PIN)**: `setPinStage('verify')` → PIN verify screen
- **Post-PIN**: `login(role, '')` → `isAuthenticated: true`, `role: 'cashier'`
- **Post-login**: Cashier dashboard (till access)

## Mode: Login (existing user)
- Flow: email → OTP → verify → role-specific stage
- 422 on `requestOTP` = email not registered

## Mode: Register (new user)
- Flow: email → OTP → verify → account created → role-specific stage
- Uses `registerOTP(email)` with `mode: 'register'`

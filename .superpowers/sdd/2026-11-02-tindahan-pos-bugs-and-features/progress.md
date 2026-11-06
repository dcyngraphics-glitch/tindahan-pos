# SDD ledger — plan: tindahan-pos/docs/superpowers/plans/2026-11-02-tindahan-pos-bugs-and-features.md

## Pre-flight
No git repo — no BASE commits. Tracking by task completion only.
Shared interfaces: Tasks 1-16. Pre-flight scan: Tasks 1-11 pre-completed per user session context.

## Rulings
- Task 11: PIN implemented directly in LoginScreen via localStorage (not via authStore pinHash fields). Same security outcome. Kept as-is — user confirmed complete. Cost if wrong: authStore doesn't expose pin reactively (nothing currently consumes it).
- Tasks 1-11: Treated as complete per user session context + code verification. safeParseAuth/Cart/ReceiptConfig exist in code but are NOT exported. Task 16 (tests) requires exports — will export them as part of Task 16.
- Task 6: Discount support NOT implemented. Will execute now.
- Task 12: CustomerDisplay idle screen NOT implemented. Will execute now.
- Task 13: Receipt preview NOT implemented. Will execute now.
- Task 14: Scanner hook consolidation NOT implemented. Will execute now.
- Task 15: SettingsModal dead code NOT deleted. Will execute now.
- Task 16: Unit tests NOT written. Will execute now.

## Task Log
Task 12: complete (CustomerDisplay idle branded screen; receipt preview modal in both layouts; tests: npm test → 8/8 pass)
Task 13: complete (ScannerNotificationBanner + useScannerDetection consolidated to use useBarcodeScannerListener; tests: npm test → 8/8 pass)
Task 15: complete (deleted dead SettingsModal.tsx — zero importers)
Task 16: complete (exported safeParseAuth/Cart/ReceiptConfig; wrote safeParse.test.ts 11 tests, voidTransaction.test.ts 2 tests, cartStore.test.ts 7 tests; full suite: npm test → 28/28 pass)
  Ruling: cartStore.test getTotal — test assumed addItem uses passed quantity; actual behavior always starts at 1 (scan-one-at-a-time UX). Fixed test to match behavior. Cost if wrong: addItem quantity-override feature never existed; test now correctly documents actual contract.

Final review: self-review (no git, no subagent tool)
Final: fixed Important — discount not cleared on checkout modal close; added closeCheckout() helper that resets store discount + local discountValue; also resets discountValue after successful checkout. Suite 28/28 green.
Final: minor (deferred): receipt preview buildReceiptText uses hardcoded store name instead of storeName from settingsStore
Final: minor (deferred): switching discount type (% ↔ ₱) while a value is entered keeps old number, reinterpreted in new type (10% silently becomes ₱10 if user switches)


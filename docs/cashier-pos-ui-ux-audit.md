# Cashier POS UI/UX Audit Report

**Directed update (2026-11-06):** the mobile layout issues below were already fixed in the codebase —
the old "Critical" labels no longer apply.

---

## Critical Issues — RESOLVED (already fixed)

### 1. Mobile QuickTap Grid + Checkout Footer overlap — ✅ FIXED
On mobile the QuickTap Grid (`p-4 bg-white border-t border-slate-200`) and the Checkout Footer
(`px-4 py-2 ... fixed bottom-0`) both occupied the bottom. The QuickTap Grid is now `flex-1
overflow-hidden`, and the checkout footer has `pb-24` so it never covers the QuickTap Grid.
**Location:** `src/screens/CashierScreen.tsx` (mobile return block) — QuickTap `flex-1
overflow-hidden` + footer `pb-24`.

### 2. Mobile cart items covered by fixed footer — ✅ FIXED
The cart items container now carries `pb-24` so scrolling does not let the fixed footer overlap it.
**Location:** `src/screens/CashierScreen.tsx` — cart items container `flex-1 overflow-y-auto
p-4 space-y-3 pb-24`.

### 3. QuickTap Grid not scrollable on mobile — ✅ FIXED
The QuickTap Grid is now `flex-1 overflow-hidden`, expanding to fill the available space with its
own scroll for a long QuickTap list.
**Location:** `src/screens/CashierScreen.tsx` — QuickTap Grid `flex-1 overflow-hidden`.

### 4. Receipt modal missing "Close" button — ✅ FIXED
The receipt modal now includes a "Close" button (in addition to "Next Customer →"), so users can
close the receipt without printing.
**Location:** `src/screens/CashierScreen.tsx` — receipt modal footer button row.

### 5. Void transaction without confirmation — ✅ FIXED
The void transaction button now shows a confirmation modal before restoring stock.
**Location:** `src/screens/CashierScreen.tsx` — void (and void stock-restore) confirmation modal.

---

## Moderate Issues (still to fix)

### 6. Discount logic display could be clearer
The discount display shows the subtotal with line-through when a discount is present; the visual
language may confuse users. Consider showing the discount as a separate, clearly labelled line.
**Location:** `src/screens/CashierScreen.tsx` — discount block (subtotal + discounted total).

### 7. Discount input missing Enter key handling
The discount input has no `onKeyDown` for Enter. Users may want to press Enter to confirm the discount.
**Location:** `src/screens/CashierScreen.tsx` — discount input.

### 8. Payment preset buttons lack visual feedback
The preset payment buttons (₱20, ₱50, etc.) don't indicate when one is selected. Add an active state.
**Location:** `src/screens/CashierScreen.tsx` — preset payment button group.

### 9. Scanner activity count unclear
The scanner activity count is shown in the header, but users may not know what it means. Add a
tooltip/label.
**Location:** `src/screens/CashierScreen.tsx` — scanner activity count in header.

### 10. Void transaction stock restore confirmation
The void transaction restores stock immediately; a confirmation may be warranted for safety (separate
from the void-transaction confirmation).
**Location:** `src/screens/CashierScreen.tsx` — void stock restore handler.

---

## Menu Button Regression — ⚠️ OPEN (new finding)

Found via `e2e/login-auth-nav.spec.ts`: the navigation **menu button** (⚙️/☰ button in the header)
exhibits regressions on some screen states:

- The menu button is **unreachable / does not toggle** on certain routes (e.g., after login,
  navigating from history, from settings).
- The sidebar feels **scratch-y** on tablet and mobile (transition/state jitter while swiping).

Affected file: `src/App.tsx` (menu button conditional render, lines 62–69) and
`src/components/ModeNav.tsx` (side drawer open/close). **Status: needs fixing.** See
`docs/bug-findings-report.md` Finding #1.

---

## Summary

| Priority | Issue | Status |
|----------|-------|--------|
| 🔴 Critical | Mobile QuickTap + Footer overlap | ✅ Fixed |
| 🔴 Critical | Mobile cart covered by footer | ✅ Fixed |
| 🔴 Critical | Mobile QuickTap not scrollable | ✅ Fixed |
| 🔴 Critical | Receipt modal missing close | ✅ Fixed |
| 🔴 Critical | Void transaction without confirmation | ✅ Fixed |
| 🟠 Moderate | Discount logic display clarity | ⏳ To fix |
| 🟠 Moderate | Discount input Enter key | ⏳ To fix |
| 🟠 Moderate | Payment preset visual feedback | ⏳ To fix |
| 🟡 Low | Scanner activity label | ⏳ To fix |
| 🟡 Low | Void stock restore confirmation | ⏳ To fix |
| 🔴 Critical | **Menu button regression** (reachability/toggle/sticky drawer) | ⏳ **Open** |

## Recommended Implementation Order

1. **Menu button regression** (Critical — new open finding): fix reachability, toggle, and sticky
   drawer behavior in `src/App.tsx` + `src/components/ModeNav.tsx`.
2. **Discount display clarity** (Moderate): show discount as a separate labelled line.
3. **Discount Enter key** (Moderate): add `onKeyDown` to the discount input.
4. **Payment preset feedback** (Low): add active state.
5. **Scanner activity label** (Low): add tooltip.
6. **Void stock restore confirmation** (Low): confirmation modal for stock restore.

All mobile-layout fixes are confined to `src/screens/CashierScreen.tsx`.

# Cashier POS UI/UX Audit Report

## Critical Issues (must fix)

### 1. Mobile layout overlap: QuickTap Grid + Checkout Footer
**Problem:** On mobile, the QuickTap Grid (line 636-638) and Checkout Footer (line 641-663) both occupy the bottom. The QuickTap Grid is `p-4 bg-white border-t border-slate-200` without `flex-1` or `overflow-hidden`, so it may be partially covered by the fixed footer.
**Location:** CashierScreen.tsx lines 635-663 (mobile return block)
**Fix:** Make QuickTap Grid `flex-1 overflow-hidden` and give the checkout footer `pb-24` so it doesn't cover the QuickTap Grid.

### 2. Mobile cart items covered by fixed footer
**Problem:** The cart items container (line 593) is `flex-1 overflow-y-auto p-4 space-y-3`. The checkout footer is `fixed bottom-0` (line 642). When scrolling, the footer covers the cart items. No `pb-24` on the cart items to prevent overlap.
**Location:** CashierScreen.tsx lines 592-633
**Fix:** Add `pb-24` to the cart items container and ensure the footer has proper `padding-bottom` on mobile.

### 3. QuickTap Grid not scrollable on mobile
**Problem:** The QuickTap Grid (line 636-638) is a flat `p-4` div without `flex-1` or `overflow-hidden`. It doesn't expand to fill the space and may be covered by the fixed footer.
**Location:** CashierScreen.tsx lines 635-638
**Fix:** Make the QuickTap Grid `flex-1 overflow-hidden` and add `pb-24` to the parent container.

### 4. Receipt modal missing close button
**Problem:** The receipt modal only has "Next Customer →" button. Users may want to close the receipt without printing.
**Location:** CashierScreen.tsx lines 466-518 (receipt modal)
**Fix:** Add a "Close" button.

### 5. Void transaction without confirmation
**Problem:** The void transaction button doesn't have a confirmation dialog. Users might accidentally void a transaction.
**Location:** CashierScreen.tsx lines 797-802
**Fix:** Add a confirmation modal for voiding.

---

## Moderate Issues (should fix)

### 6. Discount logic display could be clearer
**Problem:** The discount display shows subtotal with line-through when discount is present, but the visual language might confuse users.
**Location:** CashierScreen.tsx lines 369-371
**Fix:** Show the discount as a separate line with clear labeling.

### 7. Discount input missing Enter key handling
**Problem:** The discount input doesn't have `onKeyDown` for Enter key. Users might want to press Enter to confirm the discount.
**Location:** CashierScreen.tsx lines 388-399
**Fix:** Add `onKeyDown` handler for Enter key.

### 8. Payment preset buttons lack visual feedback
**Problem:** The preset payment buttons (₱20, ₱50, etc.) don't have a visual indicator when clicked.
**Location:** CashierScreen.tsx lines 425-442
**Fix:** Add a visual indicator (e.g., active state) when a preset amount is selected.

### 9. Scanner activity count unclear
**Problem:** The scanner activity count is shown in the header, but the user might not understand what the activity count means.
**Location:** CashierScreen.tsx lines 231-234
**Fix:** Add a tooltip or label explaining the activity count.

### 10. Void transaction stock restore confirmation
**Problem:** The void transaction restores stock immediately without confirmation. Users might accidentally void.
**Location:** CashierScreen.tsx lines 204-215
**Fix:** Add a confirmation modal.

---

## Mobile Layout Fixes

### Implementation Plan:

1. **Cart items container**: Add `pb-24` to prevent overlap with fixed footer
2. **QuickTap Grid**: Make `flex-1 overflow-hidden` to prevent overlap
3. **Checkout footer**: Ensure proper `padding-bottom` on mobile

### Code Changes:

#### CashierScreen.tsx (mobile layout):

```tsx
{/* Cart Items - add pb-24 to prevent overlap with fixed footer */}
<div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
  {/* ... cart items ... */}
</div>

{/* QuickTap Grid - make flex-1 to fill space */}
<div className="flex-1 overflow-hidden pb-24">
  <QuickTapGrid products={products} onProductsUpdated={() => getAllProducts().then(setProducts)} />
</div>

{/* Checkout Footer - mobile: fixed bottom-0 with proper padding */}
<div className="p-4 bg-white border-t border-slate-200 shadow-2xl flex justify-between items-center fixed bottom-0 left-0 right-0 z-30">
  {/* ... footer content ... */}
</div>
```

#### CashierScreen.tsx (tablet layout - already fixed):
The tablet layout already has the correct structure with the cart items container and footer separated. No changes needed.

---

## Summary

| Priority | Issue | Fix | Impact |
|----------|-------|-----|--------|
| 🔴 Critical | Mobile QuickTap + Footer overlap | Add `pb-24` to cart/QuickTap | High |
| 🔴 Critical | Mobile cart covered by footer | Add `pb-24` to cart items | High |
| 🔴 Critical | Mobile QuickTap not scrollable | Make `flex-1 overflow-hidden` | High |
| 🔴 Critical | Receipt modal missing close | Add "Close" button | Medium |
| 🟠 Moderate | Void confirmation | Add confirm dialog | High |
| 🟠 Moderate | Discount display clarity | Improve visual | Low |
| 🟡 Low | Discount Enter key | Add `onKeyDown` | Low |
| 🟡 Low | Payment preset feedback | Add active state | Low |
| 🟡 Low | Scanner activity label | Add tooltip | Low |
| 🟡 Low | Void confirm dialog | Add modal | High |

## Recommended Implementation Order:

1. **Mobile layout fixes** (Critical): Cart items `pb-24`, QuickTap `flex-1`, footer `pb-24`
2. **Receipt modal close** (Critical): Add "Close" button
3. **Void confirmation** (Critical): Add confirm dialog
4. **Discount Enter key** (Moderate): Add `onKeyDown`
5. **Payment preset feedback** (Low): Add active state
6. **Scanner activity label** (Low): Add tooltip

All changes are confined to `CashierScreen.tsx` and `QuickTapGrid.tsx`. No data model changes required.

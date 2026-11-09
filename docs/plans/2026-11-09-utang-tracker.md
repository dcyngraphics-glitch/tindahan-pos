# Utang Tracker — Plan

**Status:** Proposed, not started
**Date:** 2026-11-09
**Project:** tindahan-pos
**Decisions confirmed with the owner on 2026-11-09**

---

## What it is

Every sale in the app today is a **cash** sale — checkout requires cash tendered
to be at least the total. There is no way to record "the customer took the goods
now and will pay later", which is a normal part of running a sari-sari store.

This adds credit sales (utang) and a tracker for who owes what, plus a proper
customer list to attach those debts to.

---

## Confirmed decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | How the app knows who owes | **A full customer list** — add, edit and manage customers (name, phone, notes) |
| 2 | Do utang sales count as sales? | **Yes** — they count as sales, and a separate "Outstanding utang" figure shows what is still uncollected |
| 3 | Full or partial payment? | **Both** — partial payments allowed |
| 4 | Due dates? | **No** — just track the balance |
| 5 | Who can use it? | **Cashier role only** — it is a till feature |

---

## Data model

Three new tables, plus one new field on the existing `transactions` table.
Nothing existing is renamed or re-keyed.

### `customers` (new)

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | UUID |
| `name` | string | required |
| `phone` | string | optional |
| `note` | string | optional |
| `createdAt` / `updatedAt` | Date | |

### `utang` (new)

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | UUID |
| `customerId` | string | → `customers.id` |
| `items` | `TransactionItem[]` | snapshot of what was taken |
| `total` | number | centavos, after discount |
| `createdBy` | string | email of the cashier who recorded it |
| `createdAt` / `updatedAt` | Date | |

**Balance and status are derived from the payments, never stored.** Storing a
denormalised balance is how the two drift apart; deriving it means they cannot.

### `utang_payments` (new)

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | UUID |
| `utangId` | string | → `utang.id` |
| `amount` | number | centavos |
| `note` | string | optional |
| `createdBy` | string | email |
| `createdAt` | Date | |

### `transactions` (existing — one field added)

| Field | Type | Notes |
|-------|------|-------|
| `paymentType` | `'cash' \| 'utang'` | defaults to `'cash'`; absent means cash |

Adding a table to the live Dexie Cloud database is additive and supported. It
does require a schema version bump (`db.version(2)`), which happens once, the
next time the app loads after the update.

---

## The flow

1. Ring up items at the till **exactly as now**.
2. On the checkout screen, choose **Cash** or **Utang**.
3. If **Utang** → pick a customer from the list (searchable), or create one inline.
   The cash-tendered field is replaced by the customer picker.
4. The sale is recorded as a normal transaction with `paymentType: 'utang'`, and
   **stock is deducted** by the exact same code path as a cash sale.
5. A new **📇 Utang** screen lists everyone who owes, how much, and for how long.
6. When a customer pays, open their record → **Add Payment** → enter the amount.
   Partial payments are fine; the balance drops immediately.
7. Balance reaches zero → the record shows as **Paid**.

---

## What gets built

### Phase 1 — Record and collect (the core)

1. **Schema v2** — `customers`, `utang`, `utang_payments`, and
   `transactions.paymentType`.
2. **Customer management** — add, edit and delete customers (name, phone, notes).
3. **Checkout integration** — Cash / Utang toggle, customer picker with inline
   "new customer", no cash tendered required for utang.
4. **Utang list** — search, filters (All / Unpaid / Partial / Paid), balance and
   age shown per record.
5. **Utang detail** — items taken, running balance, full payment history.
6. **Payments** — add a payment (partial or full, capped at the balance), and
   delete a payment entered by mistake (with confirmation).

### Phase 2 — Visibility

7. **Dashboard card** — "Outstanding utang" showing total uncollected.
8. **History badge** — utang sales appear in Transaction History marked as such.
9. **Receipt** — prints "UTANG" and the remaining balance instead of change.
10. **Void handling** — voiding an utang sale restores stock, but is blocked if
    any payment has been recorded against it (refund first, then void).
11. **Tests** — service-layer tests for the balance maths, payment cap, and
    customer deletion rules.

---

## Deliberately not in v1

- **No due dates** — the owner's call; just track the balance.
- **No credit limits** — the app will not stop you extending more credit.
- **No SMS reminders** — needs a telecom integration.
- **No aging reports** (30/60/90 days overdue).
- **No refund workflow** — a wrong payment is deleted and re-entered.

---

## Things worth knowing before we start

- **Utang sales inflate the "sales" figure until they are collected.** That is
  correct — the sale happened — but "today's sales" will no longer equal "cash
  in the till". The Dashboard card keeps the two numbers distinct.
- **Gross profit includes utang sales.** Same reasoning: the cost of the goods
  left the store, so the profit is real even if the cash is not in yet.
- **A customer is now a real record.** Two customers with the same name are no
  longer merged, because the debt attaches to the customer, not the name.
- **Deleting a customer with debts** will be blocked, not cascaded — silently
  deleting someone's balance would lose money.

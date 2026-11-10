# Tindahan POS — Product Overview

**A barcode point-of-sale and inventory system for small retail stores**

Tindahan POS is a web-based point-of-sale (POS) and inventory system built for sari-sari stores, small groceries, and similar neighbourhood retail businesses. It runs in a browser, works on a phone, tablet or desktop computer, and can be installed on a device so it behaves like a normal app.

Two people can use it at the same time on two devices — one serving customers at the counter, another managing stock in the back — and both see the same live data. It keeps working when the internet drops and catches up automatically once the connection returns.

---

## At a glance

- Fast barcode checkout with a built-in sari-sari product catalogue
- Scans with the device camera, a USB scanner, or a Bluetooth scanner
- Live inventory tracking with low-stock alerts
- Sales dashboard with revenue, profit, and top-product reports
- Thermal receipt printing, plus receipt reprinting
- Full transaction history with voiding and automatic stock restoration
- Customer-facing display for a second screen or TV
- Works offline and syncs when the connection returns
- No passwords to remember — sign in with a one-time code sent to email
- Installable as an app on phones, tablets and computers

---

## 1. Signing in and access

**Passwordless email sign-in.** There is nothing to remember. Enter an email address and the system sends a one-time code. The account is created automatically the first time you sign in, so there is no setup step and no password to reset.

**Two roles, one system.** Every sign-in picks a role, and each role sees only the tools it needs:

- **Cashier** — the till. Checkout, barcode scanning, transaction history, inventory, dashboard, receipt printing.
- **Inventory Staff** — stock work. Barcode scanning, the product catalogue, transaction history and the dashboard, without the checkout screen.

**Cashier shift lock.** An optional 4-digit PIN can be set. Once set, the till asks for it every time the app is opened in the Cashier role, so a shared tablet cannot be tapped into by accident. This is a convenience lock, not a security control — anyone alone with the tablet can get past it from the browser. For real protection, use a tablet passcode and sign out between shifts. If no PIN is set, the till opens straight away.

**One account, many devices.** The same sign-in works on the counter tablet and the stock phone. Data is shared between them (see *Sync and offline working* below).

---

## 2. Serving customers (Cashier)

**Barcode checkout.** Scan an item and it lands in the cart instantly. The cart shows each item's name, unit price, quantity and line total, with a running total at the bottom.

**Quantity controls.** Increase or decrease the quantity of any line, or remove it entirely. The system will not let you sell more than the stock on hand, and it re-checks stock when the sale is completed.

**QuickTap fast keys.** Frequently sold items can be pinned to a grid of large buttons showing the product name, price and current stock. Tapping a tile adds it to the cart in one touch — designed for items customers ask for by name rather than by barcode. Items pinned to QuickTap can be managed from a searchable picker, including a filter that shows budget items at ₱30 and under.

**Discounts.** A percentage or a fixed-peso discount can be applied to a sale. Discounts are capped so a sale can never accidentally be rung up as free, and the discounted total is what gets recorded and printed.

**Cash tendered and change.** Enter the amount received and the system shows the change due, or a clear "insufficient cash" message. Quick-cash buttons for common denominations are available on the counter (tablet/PC) layout.

**Cleared-cart safety.** The checkout button stays disabled until the cart has items, and the payment button stays disabled until the cash received covers the total.

**Sale completion.** Completing a sale records the transaction, reduces stock for every item in one atomic operation, and shows a receipt with the items, total, cash received and change. The receipt can then be printed or closed to serve the next customer.

---

## 3. Barcode scanning

Tindahan POS supports three ways to read a barcode, and they can be used together:

**Camera scanning.** A dedicated Scanner screen shows a live viewfinder. Hold the product in frame and the barcode is read automatically — no button press needed. This works on any phone or tablet with a camera, so no extra hardware is required to start.

**USB and Bluetooth scanners.** A handheld scanner that types the barcode into the computer (a "keyboard wedge" scanner) works straight away — just scan while the app is open. Bluetooth scanners can be paired from the settings screen. The app recognises a scan by the speed and terminator of the keystrokes, so ordinary typing is never mistaken for a scan.

**Manual entry.** Barcodes can be typed by hand on the Scanner screen and looked up, which covers damaged labels and products that have no barcode at all.

**Scanning an unknown product.** If a barcode is not yet in the catalogue, the app opens a pre-filled product form with the barcode already in place. As you type the product name, the system also offers matching suggestions from a built-in catalogue of common sari-sari goods — instant noodles, canned goods, beverages, coffee, seasoning, snacks, dairy, personal care, household supplies, medicine, school supplies, load and cigarettes — so adding a new product usually takes seconds.

**Recent scans.** The last ten scans stay on the Scanner screen as tappable chips, so a mis-scan or a repeat item can be pulled back instantly.

---

## 4. Inventory management

**Full product catalogue.** Each product has a barcode, name, selling price, cost price, stock on hand, and an optional category. Products can be added, edited and deleted.

**Live stock tracking.** Stock falls automatically when a sale is completed, and rises again when a transaction is voided. You never have to adjust stock by hand after a sale.

**Categories and organisation.** Group products into categories and filter the list by them.

**Search and sort.** Search by product name or barcode as you type, and sort by name, price or stock level in either direction.

**Low-stock alerts.** Products at or below five units are highlighted in red and badged, both in the list and on the product cards. A count of low-stock items appears on the menu, and the dashboard has a dedicated low-stock watchlist.

**Pagination.** Large catalogues are paged so the list stays fast and readable on a phone.

**Stock-safe adding.** The system refuses a product with a zero price, a negative stock count, or a blank name, and it warns you if you try to add a barcode that already belongs to another product — preventing duplicate entries.

**Bulk-friendly.** There is no hard limit on catalogue size; the catalogue is designed to hold a full store's range.

---

## 5. Transaction history

**Every sale, recorded.** Each transaction stores its items, quantities, prices, total, cash received, change, and the time it happened.

**Find anything.** Search by transaction ID or by item name, and filter the list to all transactions, completed sales only, or voided ones only. Each filter shows its own count.

**Full breakdown.** Tap any transaction to expand it and see every item purchased, the cash tendered, the change given, and the transaction ID.

**Reprint receipts.** Any past transaction can be reprinted on the thermal printer without re-entering anything.

**Voiding.** A transaction can be voided, which marks it as voided and automatically puts every item's stock back. Voided transactions stay in the history, clearly marked, so the record of what happened is never lost.

---

## 6. Dashboard and reports

**Real-time business numbers.** The dashboard shows total revenue, gross profit, profit margin, average basket value, and the number of completed sales.

**Time ranges.** View today, the last 7 days, the last 30 days, or all time. The "today" figure stays correct even if the app is left open overnight.

**Sales trend chart.** Revenue over time, plotted as a chart.

**Top-selling products.** The five best sellers, sortable by units sold or by revenue.

**Low-stock watchlist.** A panel listing every product at or below five units, with its price, category and remaining count.

**CSV export.** The full transaction list can be exported to a CSV file for use in a spreadsheet, for bookkeeping or for submitting records.

---

## 7. Receipts and printing

**Thermal receipt printing.** The system prints to common 58mm Bluetooth thermal receipt printers (including GOOJPRT, MPT, RP and similar ESC/POS models) directly from the browser — no separate software or driver install needed.

**Customisable receipt.** The store name, address, contact details, receipt heading and footer message can all be set to match the business. The printed receipt shows the store details, the date, every item with its unit price and line total, the total, cash received, change, and a thank-you message.

**System printing.** Receipts can also be printed through the computer's normal print dialog, which works with any printer.

**Reprinting.** Receipts can be reprinted from the receipt screen after a sale, or from the transaction history at any later date.

**Printing preview.** A text preview of the receipt is available before printing, so the layout can be checked.

---

## 8. Customer-facing display

A separate display view is designed for a second screen, tablet or TV facing the customer. It shows the store name and a welcome message while idle, then switches to show each item as it is added to the cart along with a running total, so the customer can follow the sale as it happens. It updates live on the same device or from another device on the same account.

---

## 9. Devices, hardware and sync

**Runs anywhere.** Tindahan POS is a web application. It works on Android phones and tablets, iPhones and iPads, and Windows, Mac or Linux computers, in current versions of Chrome, Edge and Safari.

**Installable.** It can be added to a home screen or installed like a normal app, and it opens full-screen without the browser's address bar.

**Offline-first.** Sales and stock changes are stored on the device itself. If the internet drops mid-shift, the till keeps working; everything syncs automatically once the connection returns. A sale is never lost because of a bad connection.

**Two devices, one store.** The counter device and the stock device share the same data through cloud sync. A sale rung up on the counter reduces the stock that the inventory device sees, and a product added on the stock phone appears on the till.

**Hardware supported:**

- Any camera-equipped phone or tablet for barcode scanning
- USB and serial barcode scanners (keyboard-wedge and Web Serial)
- Bluetooth barcode scanners (pairable from the settings screen)
- 58mm Bluetooth thermal receipt printers using ESC/POS
- Any Windows printer, through the system print dialog
- A second screen or TV for the customer display

---

## 10. Settings

**Receipt template.** Store name, address, contact information, receipt heading and footer message.

**Hardware.** Pairing and disconnecting the Bluetooth receipt printer, the Bluetooth scanner, and a USB/serial scanner, with each device's connection status shown.

**Session.** Shows the signed-in role and provides sign-out. Signing out uploads anything that has not synced yet first; if that is not possible, the app stays signed in and explains why.

**Cashier PIN.** Set or change the 4-digit shift PIN (a convenience lock, not a security control).

---

## What Tindahan POS does not do

So expectations are clear from the start:

- **No accounting or bookkeeping.** It reports sales and profit; it does not produce ledgers, VAT returns or financial statements.
- **No customer accounts.** There is no credit (*utang*) tracking, no customer profiles, and no loyalty or points system.
- **No supplier or purchase-order management.** Stock is entered and adjusted in the product catalogue; there is no ordering workflow.
- **No barcode label printing.** It prints receipts, not product labels.
- **No multi-branch or multi-store consolidation.** One store, one shared dataset.
- **The catalogue starts empty.** Products are added by scanning or typing. The built-in sari-sari catalogue is used to suggest and pre-fill new products, but it is not imported automatically.
- **Thermal receipts are 58mm.** The receipt layout is designed for 58mm paper.
- **Bluetooth printing needs a compatible browser.** Web Bluetooth printing works in Chrome and Edge on Windows and Android. Where it is not available, the system print dialog is used instead.

---

## Getting started

1. **Open the app** on the counter device and sign in with an email address.
2. **Pick the Cashier role** at the counter, and the **Inventory Staff role** on the stock device.
3. **Add products** — scan a barcode and accept the suggestion, or type the details in.
4. **Pin fast movers to QuickTap** for one-tap selling.
5. **Pair a receipt printer** from the settings screen if one is available.
6. **Open the customer display** on a second screen if one is available.
7. **Start selling.**

No installation, no server and no passwords are required. A full backup of your products, sales, customers and credit records can be downloaded from the settings screen.

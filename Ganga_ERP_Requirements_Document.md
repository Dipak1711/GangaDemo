# Ganga ERP Portal — Requirements Document (Reverse-Engineered from Existing Site)

| | |
|---|---|
| **Source system** | https://teachdeveloper.com/gangaportal/ (client's existing/old site) |
| **Method** | Logged in with the supplied test account (admin) and walked 92 list/report pages plus 17 "Add" forms, read-only. **No data was created, edited or deleted.** The destructive "Erase ERP Data" page was deliberately not opened. |
| **Date** | 28 Oct 2026 |
| **Purpose** | Capture the functions, data points and rules of the old system so the new build can replicate / improve it. |

> **How to read this:** Sections 3–15 describe each module (what it does, screens, fields, columns, actions). Section 16 lists defects/gaps found in the old site. Section 17 lists open questions to take back to the client. Things I **observed** are stated as fact; things I **inferred** (e.g. business rules behind a screen) are marked *(inferred)*.

---

## 1. Business Context

The portal is an **ERP for an agricultural-machinery / tractor-parts business** (sample data: tractors such as Mahindra 575 DI, Swaraj 744 FE, Sonalika DI 750; spare parts such as Air Filter, Bearings, Alternator, Hydraulic Seal Kit; customers are farmers and dealers in Gujarat; GST-based Indian taxation). It combines:

- Sales (quotation → order → packing → invoice → delivery → gate pass → return) and receipts
- Purchase (quotation → order → goods receipt → invoice → return) and vendor payments
- Inventory with low-stock alerts, serial-number tracking
- Light manufacturing (custom production / BOM)
- Accounting (ledgers, vouchers, books, financial statements, GST/TDS)
- CRM (complaints), AMC (annual maintenance contracts), HR basics, dealers, transport
- Multi-company profile and role-based security

The system uses **document series** (e.g. SQ-26, GST, INV, PINV, PKG, GP, DN) and auto/manual document numbers.

## 2. Global Features

| Feature | Observation |
|---|---|
| Login | Single username + password form ("Welcome to Ganga"), "Logging in…" state, redirect to dashboard. |
| Top bar | Notifications ("See All Notifications"), profile menu (Log Out), "Upgrade" widget, app shortcuts (Chat, Invoice, Contact, Email, Calendar) — template leftovers. |
| Sidebar | 25 top-level menus (see §2.1). Several are marked **(Hold)** meaning client parked them. |
| Lists | Every list uses a data grid: search box, page size (10/25/50/100), pagination, row actions (View / Edit / Delete), **"Delete All Row"** bulk delete with checkboxes. |
| Delete | Confirmation modal ("Cancel / Yes"). |
| Currency / date | Indian Rupee (₹ / "Rs."), Indian number format; dates `dd-mm-yyyy`, some with time `hh:mm AM/PM`. |
| Document numbering | Each transaction has **Series (dropdown) + No + Date**. |
| Print | Print buttons on Sales Order / Quotation; separate Print Setup module. |
| Units | Extensive unit system with converters. |

### 2.1 Menu structure (as seen)
1. Home (Dashboard)
2. Company Profile — My Profile, Branches, Department, Designation
3. Master Setup — Category/Brand, Serial Numbers ("Sales"), Unit, Unit calculators, Unit Chart, Packing Unit, Packing Conversion, Taxes, Bill Sundry, Item Group, Item, Dealer, Accounts, Account Group, Expense Master, Print Setup, Terms & Conditions
4. Sales
5. Purchase
6. Inventory
7. Custom Production
8. Regular Production
9. Full Account
10. CRM / Complaints (Hold)
11. AMC / Services (Hold)
12. HR / Payroll
13. R&D
14. Report & Analyst
15. Dealer
16. Packing & Delivery
17. Dispatch & Transport
18. Tender & Export Head
19. Customer Contact List
20. Map Location
21. Communications Alert System
22. Admin / User / Security
23. Recycling
24. Settings
25. Sitemap

Menu items shown but with **no working page** (placeholder/not built): Regular Production, R&D, Tender & Export Head, Communications Alert System, Recycling, Sitemap, Finished Good Stock, Stock In/Out, Stock Transfer (Warehouse), Low Stock Alert (Row/Readymat/Goods), Stock/Inventory Report, Work Order/Job Work, Production Entry, Production Report, All Group/Items/Dealer Ledger, Utilities.

---

## 3. Dashboard (Home)

**Purpose:** at-a-glance business health.

| KPI card | Meaning | Sample value |
|---|---|---|
| Total Sales (This Month) | Sum of sales invoices in current month | Rs. 0.00 |
| Total Purchases (This Month) | Sum of purchase invoices in current month | Rs. 0.00 |
| Total Revenue | Sales − purchases / net *(inferred)* | Rs. -5,744,878.40 |
| Pending Customer Payments | Receivable outstanding | Rs. 5,752,540.00 |
| Pending Vendor Payments | Payable outstanding | Rs. 11,497,418.40 |
| Low Stock Alerts | Count of items below min level; links to Stock Availability filtered `low_stock` | 14 Items |

**Widgets:** Sales vs Purchase (Monthly) chart · Revenue Trend (Last 30 Days) chart · Top Customers (Customer, Total Sales) · Top Vendors (Vendor, Total Purchases) · Recent Activities (Type, Reference, Date, Party, Amount — mixes Purchase Orders and Sales Orders).

---

## 4. Company Profile Module

| Screen | Page | Data points / functions |
|---|---|---|
| My Profile | `my_profile` | Company Name*, Brand Name, Tag Line, Owner Name*, GST No, PAN No, MSME/Udyam Certificate, Email, Mobile*, Address 1/2, City/Village, Taluka, District, State, Country, Pin Code, Website, Facebook, Instagram, LinkedIn, Twitter/X, YouTube, WhatsApp, Logo upload. Save Changes. Also used for change of profile/password. |
| ERP Configuration | `company_profile` | Company Name, GSTIN, Contact Person, Email, Phone, Company Logo, Address. |
| Branches | `branches` | ID (BR##), Name, Contact, Address, Status (Open/…); add/edit/delete; search. |
| Department | `department` | ID (DPT#), Branch, Department. |
| Designation | `designation` | ID (DR_#), Branch, Department, Designation, Person Name, Contact. |

Hierarchy: Company → Branch → Department → Designation (→ person).

---

## 5. Master Setup Module

### 5.1 Category / Brand Master (`category_master`)
ID (CT##), Name, Description. Seed data is a generic business-category list (e.g. Dairy Farming, Agricultural Tools, Animal Feed, Beekeeping, Biofertilizer…). Items also reference *Category* (e.g. Engine Parts) and *Brand* (e.g. Fenner).

### 5.2 Serial Numbers (`series_sales`, menu label "Sales")
"+ Add Serial Number", Edit, Delete. Used to generate **serial-number ranges** per product: Serial Prefix, Starting Number, Number of Digits, Quantity to Generate (seen in the Sales Quotation/Order "Select Serial Numbers" dialog) with Dealer Code/Name* and EMP Code/Name*.

### 5.3 Units
| Screen | Data |
|---|---|
| Unit (`unit_master`) | No, Unit Name, Alias, Print Name, Category (Quantity, Area, Length, Volume, Mass, Time, Speed…), Status. Includes Acre, Box, Centimeter, Cubic cm/ft/inch, PCS… |
| Area / Length / Volume / Speed / Time / Mass Calculation | Interactive converters: from unit, from value ⇄ to unit, to value. |
| Unit Chart — AANI / Gauge to MM (`unit_master_chart`) | Reference table for sheet-metal gauge: Gauge, Destination (MM), MM, INCH, Material (GP/GI, MS, ALU, BRASS…), Shape Type (Sheet, Angle, Round-bar, Channel, Flat-bar, Round-tube, Square-tube, Hexagon, H-beam…), Description, Status; conversion mode with entered value → converted MM. |
| Packing Unit (`packing_unit`) | Packing Name, Alias, Base Unit, Qty per Pack, Description, Status (e.g. Trolly). |
| Packing Unit Conversion | From Packing, To Packing, Factor, Display ("1 Apple = 12 Trolly"), Description, Status. |

### 5.4 Taxes (`taxes_gst_master`)
Tabs/entries for **GST, TCS, TDS, VAT (On Hold)** (all open the same page). Columns: Name, Product Type (Goods/Services), Location (Central/State), Tax Rate, IGST %, CGST %, SGST %, Status. Sample: "G-Central-5%", "S-State-18%".

### 5.5 Bill Sundry (additional charges/discounts)
- **General** (`bill_sundary_general`) and **GST** (`bill_sundary_gst`): Sundry Name, Sign (Add / Subtract), Default Value, Example ("Add 40.00"), Description, Status. Samples: AC, Cash Discount, Central-40%, CGST, IGST, Installation Charge.
- Applied on quotations/orders through "Add Charge" (Charge Name, Type, Value) and contributes to Sub Total → Grand Total.

### 5.6 Items
- **Item Group** (`product_item_group`): Name, Is Primary, Under Group (tree), Description, Created At. Delete-all, add.
- **Item / Product Master** (`product_master`, form `add_product_master`):
  - List columns: Item Name, Group, Category, Brand, Unit, Tax, Opening Stock, Selling Price, Serial (Y/N), Actions.
  - Form: Item Name*, Primary Group / Group, **Base Unit***, Sale Unit, Purchase Unit, Packaging Unit, Conversion Factor, Type of Tax (tax master), Category, Brand, serial-number required (Yes/No), several Yes/No flags (stock/tax options), opening stock, selling price, critical/min/max stock levels *(inferred from stock screen)*.
  - ~103 items in demo data (tractor parts).

### 5.7 Parties / Accounts
- **All Account / Customer Master** (`customer_master`, form `add_accounts`) and **Customer List** (`customer_sales`): the same entity. Fields: Name*, Print Name, Account Group, Account Type (Dealer: Government Body / Unregistered person / Registered person), TIN, IEC, MSME No & Type, **GST No, Aadhar, PAN**, multiple **contacts** (country code +91/+1/+44, telephone, fax, "Add More"), Address (Country/State/District/Address), **Bank details** (Beneficiary Bank Name, Account No, IFSC), **Document uploads** (Aadhar, Bank Passbook, GST Certificate, IEC Certificate, MSME Certificate; table File Name/Action).
- **Supply / Vendor List** (`supply_master`, form `add_supply`): same structure, plus *Type* (Manufacturer, Distributor, Retailer, Wholesaler, Service Provider), Contact Person.
- **Account Group** (`account_group_master`): Name, Is Primary, Under Group, Description (e.g. Bank Accounts, Capital Account, Cash-in-hand, Loans (Liability), Bank O/D) — chart-of-accounts grouping.
- **Expense Master** (`expense_master`) with form `add_expense`: Account*, Amount*, Expense Category* (Travel, Food, Supplies), Payment type* (Cash, Bank, UPI, Credit, Others), Payment Mode, Photo/Bill copy upload, Description. List: Date, Category, Amount, Payment Mode, Description.
- **All Dealer** (`dealer-contact`): Dealer Name*, Phone, Email, City.

### 5.8 Print Setup & Terms
- **General Print Setup**: Number of copies (1–5), copy labels.
- **Sales Print Setup**: header title, show logo, show signature, live print preview sample (Customer, product lines).
- **Terms & Conditions — General**: free-text terms per document: Purchase Quotation, Purchase Order, Purchase Invoice, Purchase Return, Vendor Payment, Delivery Notes, Gate Pass.
- **Terms & Conditions — Sales**: Sales Quotation, Sales Order, Receive Payment, Packing List, Sales Invoice, Delivery Notes, Gate Pass, Sales Return.

---

## 6. Sales Module

Flow: **Customer → Quotation → Order → Packaging List → Invoice → Delivery Note → Gate Pass → (Return) ; Receive Payment**. Orders can be created by **loading a quotation**.

| Document | Page | Header fields | Line columns | Notes |
|---|---|---|---|---|
| Sales Quotation | `sales_quotations` / `add_sales_quotations` | Date*, Series* (SQ-26), No*, Valid Till*, Customer*, GST Type* (e.g. G-Central-5% / S-State-18%), Description | Product, Qty, Unit Price, Total (+serial selection) | Bill Sundry/charges (Add Charge), Sub Total, Grand Total, Print. List: Quotation No, Created, Till Date, Customer, Grand Total, Phone. |
| Sales Order | `sales_order` / `add_sales_order` | "Load from Sales Quotation", Date*, Series* (GST/Main), No*, Delivery Date (tentative)*, Customer*, GST Type* (Goods/Services), Reference notes | Product, Qty, Unit Price, Total | Charges table (Charge Name, Type, Value), Sub Total, Grand Total, Print. |
| Receive Payment | `receive_payment` / `add_receive_payment` | Date*, Series* (PAY/REC), No*, Method* (Cash, Cheque, Online, Bank Transfer, Credit Card), Customer*, Reference No, Bank Details, Description | Packaging No, Order Date, Total, Paid, Outstanding, Status → allocation grid (Packaging, Outstanding, Amount) | Payment is allocated against outstanding packaging lists. |
| Packaging List | `sales_packaging` / `add_sales_packaging` | Order Date*, Series* (PKG/PACK), No*, Sales Quotation (dropdown with amount), Sales Order No, Delivery Date*, Customer*, notes | Product, Qty, Unit Price, Total | |
| Sales Invoice (/eInvoice/eWay Bill) | `sales_invoice` / `add_sales_invoice` | Date*, Series* (INV/SI), No*, Due Date*, Customer*, Reference, Terms (Due on Receipt, Net 15/30/45/60), notes | Product, Qty, Unit Price, Discount, Tax %, Total | Status (Paid/…); eInvoice & eWay Bill named in menu — **not visible as functions**. |
| Delivery Notes | `delivery_notes` / `add_delivery_notes` | Date*, Series* (DN/DEL), No*, Reference, Invoice/Customer*, Delivery Date*, Carrier, Transporter, Tracking No, Receiver Name, Doc No, Mobile, Signature, delivery address, notes | Product, Ordered, Delivered, Pending Qty, Unit | Status (pending…). |
| Gate Pass | `gate_pass` / `add_gate_pass` | Date*, Series* (GP/OUT), No*, Type* (Material Out/In, Return, Sample, Repair), Customer/Vendor, Purpose, Vehicle No, Person carrying goods, notes | Product, Qty, Unit, Remarks | |
| Sales Return | `sales_return` / `add_sales_return` | Date*, Series* (SR/RTN), No*, Type* (Sales/Warranty/Damage Return, Exchange), Customer*, Original Invoice, Reason (Defective, Wrong Item, Quality, Dissatisfaction, Size/Colour, Late Delivery), notes | Product, Returned Qty, Unit Price, Return Value, Condition (Good/Damaged/Defective), Remarks | |
| Stock Availability | `stock_availability` | Filters: Category, Stock Status, Search Product | Product ID, Name, Category, Unit, Current Stock, Min, Max, Status, Last Updated | Export, Refresh, **History**, **Adjust** (stock adjustment). |
| Tracking | `sales_tracking` | Search | Date, Module (Delivery Note, Invoice…), Reference, Customer, Status/Method, Details (Carrier, Tracking, Delivery), Amount | Unified activity timeline of sales documents. |
| Sales Report | `sales_reports` | — | Customer-wise totals; invoice list (Invoice No, Date, Customer, Amount, Status) | |

## 7. Purchase Module

Flow: **Vendor → Quotation → Order → Goods Receipt (GRM) → Invoice → Return; Vendor Payment**.

| Document | Page | Header | Lines |
|---|---|---|---|
| Supply/Vendor List | `supply_master` | see §5.7 | — |
| Purchase Quotation | `purchase_quotations` | Series*, No*, Supplier*, Date*, Valid Till*, Description | Product, Qty, Unit Price, Total |
| Purchase Order | `purchase_orders` | Series*, No*, Supplier*, Order Date*, Delivery Date*, Description | same |
| Good Receipt (GRM) | `goods_receipts` | Series*, No*, Date*, Status (Draft/Received/Inspected/Accepted/Rejected), Supplier*, Purchase Order, Reference, Notes, Total Received Qty | Product, Ordered, Received, Accepted, Rejected, Unit Price, Remarks (quality inspection) |
| Packaging List | `purchase_packaging` | Series (PKG/PACK), No*, Purchase Quotation*, PO No*, Delivery Date*, Supplier* | Product, Qty, Price, Total |
| Purchase Invoice | `purchase_invoices` | Series (PINV/PI), No*, Date*, Due Date*, Supplier*, Reference, Terms | Product, Qty, Unit Price, Discount %, Tax %, Total; footer Subtotal, Total Tax, Total Discount, Total Amount |
| Delivery Notes / Gate Pass | `purchase_delivery_notes`, `purchase_gate_pass` | list only (Supplier, PO, Invoice, Carrier, Tracking, Vehicle, Person, Contact, Status) | |
| Purchase Return | `purchase_returns` | Series (PR/PRTN), Type (Purchase/Warranty/Damage/Exchange), Supplier*, Original Invoice, Reason (Defective, Wrong Item, Quality, Over Supply, Damaged in Transit) | Product, Qty, Price, Return Qty, Reason, Total |
| Pay Payment (Vendor Payment) | `vendor_payments` / `add_vendor_payment` | Series (VPAY/VP), No*, Supplier*, Date*, Method* (Cash, Bank Transfer, Cheque, UPI, Credit Card), Reference, Amount*, **Purchase Invoice*** (loaded after choosing supplier), Notes | |
| Purchase Availability (Raw Material / Redymat Parts) | `stock_availability`, `redymat_stock` | | Redymat: Item, Current Stock, Updated; "Add Stock Entry" (Product*, Type, Qty*, Reference) |
| Tracking | `purchase_tracking` | | Date, Doc Type, Doc No, Supplier, Status |
| Purchase Report | `purchase_reports` | Month/Year filter; 4 tabs | Supplier-wise (Invoices, Total, Paid, Pending, Last Purchase) · Monthly · Pending Payments (Invoice, Due Date, Paid, Pending, **Days Overdue**) · Product-wise (Qty, Amount, Avg Price, Last Purchase) |

## 8. Inventory Module
- **Raw Material Stock** / **Redymat (ready-made parts) Stock** — current stock, manual stock entry (type + qty + reference).
- **Stock Availability** — min/max levels, status (In Stock / Low Stock …), filter by category/status, **Export**, **History**, **Adjust**.
- **Menu-only (not built):** Finished Good Stock, Stock In/Out, Stock Transfer (Warehouse), Low Stock Alert (Raw / Readymat / Finished), Tracking, Inventory Report.
- Business rules *(inferred)*: stock increases by GRM/Purchase, decreases by Delivery/Sales Invoice; separate stock classes: Raw Material, Redymat parts, Finished goods.

## 9. Production Modules
- **Custom Production:** Final Design (placeholder for drawings/specs/attachments — not built), **Bill of Material** (Finished Product*, Component*, Qty*; list shows records), Work Order/Job Work, Production Entry, Production Report, Tracking (menu only).
- **Regular Production:** menu only.

## 10. Full Account Module
| Screen | Status |
|---|---|
| Ledger Master | Page shows "No data (module pending)" — columns Ledger Name, Group, Status |
| Account Ledger | Party/account list; fields seen reused from item form (bug) |
| General Entry | Form: Date*, Amount*, Debit Account*, Credit Account*, Narration; **list errors: "Missing table(s): journal_entries / account"** |
| Contra Entry | Placeholder: "bank-to-cash, cash-to-bank, bank-to-bank" |
| Customer Payment / Vendor Payment | Link to Receive Payment / Pay Payment |
| Expense Payment (Approval) | Totals grid (Name, Total Credit, Total Debit, Balance), filters, Add Expenses (approval flow) |
| Debit/Credit Notes | Placeholder |
| Day Book, Cash Book, Bank Book | Placeholders — "daily transaction summaries / cash / bank transactions" |
| Outstanding Report | Placeholder — receivable and payable balances |
| Trial Balance, P&L, Balance Sheet | Placeholders — ledger debit/credit totals; income & expense; assets, liabilities, capital |
| GST Report, TDS Report | Placeholders — sales/purchase/tax summary; deduction & payable |
| Report Analyst | Placeholder — financial analytics |

**Conclusion:** the accounting layer is essentially **not implemented** in the old site; requirements are the stated intent of each placeholder.

## 11. CRM / AMC (marked Hold, but working)
- **Complaints:** Customer, AMC (optional), Sales Quotation (optional), Subject*, Description*, Status (e.g. Closed); list with #, Created; Add/Edit/Delete. ~57 demo records.
- **AMC / Services:** Contract No* (e.g. AMC/AGRI/0030), Customer, Start*, End*, Amount, Status (Active/Expired), Remarks; per-contract **Service history** (Service Date*, Notes). Actions: Edit, Service, Delete. ~31 records.

## 12. HR / Payroll
- **Attendance:** Date filter, employee rows with Status, In, Out; Save Attendance.
- **Leave Tracker:** Employee*, From*, To*, Type, Status, Reason.
- **Employee:** Name, Department, Designation, Status (list only; "No employees found").
- Payroll: no screens found.

## 13. Dealer, Delivery & Contacts
- **Dealer Contact** — Dealer*, Phone, Email, City.
- **Packing & Delivery** — Packaging List, Delivery Notes (shared with Sales).
- **Dispatch & Transport:** **Courier List** (Name*, Phone, Email, Address — *table missing error*), **Transport** (Transporter*, Contact, Default Charge, Address; 12 records e.g. Krishna Implement Logistics ₹5,000).
- **Customer Contact List:** Department Contact (Department*, Person, Phone, Email — *table missing*), Sales Customer, Purchase Vendor/Supply (*table missing*), Employee, Dealer Contact.
- **Map Location:** placeholder page ("Placeholder page").
- **Sale / Purchase ledger shortcuts** (All Group / Items / Dealer Ledger): placeholders.

## 14. Admin / User / Security
| Screen | Intended function | Status in old site |
|---|---|---|
| Company Profiles (`organizations`) | Multi-company/organization setup | "Run Phase 1 migrations first." — DB not migrated |
| User Assignments | Assign users to companies | same |
| Roles & Permissions | Role-based access | same |
| Activity Log | Audit trail | **Fatal PHP error**: table `organizations` doesn't exist (also leaks DB name & server path) |
| Switch Profile | Switch active company | "Company Profile foundation migration has not been applied" |
| Profile / Password | Own profile & password change | via My Profile |
| Erase ERP Data | Wipe all data (**dangerous**) | not opened |

## 15. Data Entities (summary for DB design)

Company/Org, Branch, Department, Designation, Employee, User, Role, Permission, Activity Log · Category, Brand, Item Group (tree), Item, Serial Number, Unit, Unit Conversion, Packing Unit, Packing Conversion, Gauge Chart · Tax (GST/TCS/TDS/VAT), Bill Sundry · Account Group (tree), Account/Party (customer/vendor/dealer) with Contacts, Addresses, Bank, Documents · Dealer, Courier, Transporter · Document Series · Sales Quotation/Order/Packaging/Invoice/Delivery Note/Gate Pass/Return (+line items, charges) · Receipt (+allocation) · Purchase Quotation/Order/GRN/Packaging/Invoice/Delivery/Gate Pass/Return (+lines) · Vendor Payment · Stock (raw, redymat, finished) + Stock Movement/Adjustment · BOM · Expense · Journal/Voucher/Ledger · AMC Contract + Service · Complaint · Attendance · Leave · Print Template · Terms & Conditions.

## 16. Defects / Gaps Found in the Old Site (do not carry over)

1. Several tables missing in DB: `courier_master`, `department_contacts`, `vendor`, `journal_entries`/`account`, `organizations` (visible error messages).
2. Fatal PHP exception exposes database name and server path on Activity Log.
3. Dashboard: negative "Total Revenue", "Total Sales (This Month)" = 0 while pending receivables exist; Recent Activity shows date "30 Nov -0001"; Top Customers empty.
4. Many pages are placeholders (all accounting reports, production, stock transfer, etc.) while appearing in the menu.
5. Same page reused for different menu items (GST/TCS/TDS/VAT → one page; Account Ledger / Expenses reuse the Item form fields).
6. Template remnants: fake notifications ("Roman Joined the Team!"), Chat/Email/Calendar apps, "Upgrade".
7. Spelling: "Invetory", "Quatation", "Sundary", "Expanse", "Redymat".
8. Generic seed data (Branches/Department/Category) unrelated to the tractor business.
9. Login is plain username/password; no visible password policy, lockout, or MFA.
10. "Delete All Row" bulk delete with no visible safeguard.
11. Sales Order/Invoice list shows "N/A" for phone and delivery date even when data should exist.

## 17. Open Questions for the Client

1. Which modules are in scope for v1? (Hold items: CRM, AMC; unbuilt: Regular Production, R&D, Tender/Export, Alerts, Recycling.)
2. Is **eInvoice / eWay Bill** integration (GST portal) required?
3. Exact accounting requirements: chart of accounts, vouchers, financial year handling, auto-posting from sales/purchase.
4. Inventory: warehouses? batch/lot? serial-number policy per item? costing method (FIFO/average)?
5. Manufacturing: BOM levels, work orders, job work to vendors, wastage, costing.
6. Roles list and permission matrix; multi-company vs single company.
7. Notifications / Communication Alert System: SMS, WhatsApp, email? triggers?
8. Map Location: what is expected (customer map, delivery tracking)?
9. Tender & Export: documents and workflow.
10. Printing formats (invoice templates, copies), languages (Gujarati/English), mobile use.
11. Data migration from the old system — what must be carried over?
12. Hosting, backups, audit/retention, number of users.

## 18. Appendix — Page Inventory (92 list pages + add forms)

Dashboard; Branches, Department, Designation; Category Master, Serial Numbers, Unit Master, Area/Length/Volume/Speed/Time/Mass conversion, Unit Chart, Packing Unit, Packing Conversion, Taxes, Bill Sundry (General, GST), Item Group, Product Master, Dealer, Customer Master, Account Group, Expense Master, General/Sales Print Setup, General/Sales Terms; Customer Sales, Sales Quotation, Sales Order, Receive Payment, Sales Packaging, Sales Invoice, Delivery Notes, Gate Pass, Sales Return, Stock Availability, Sales Tracking, Sales Report; Supply Master, Purchase Quotation, Purchase Order, Goods Receipt, Purchase Packaging, Purchase Invoice, Purchase Delivery Notes, Purchase Gate Pass, Purchase Return, Vendor Payments, Redymat Stock, Purchase Tracking, Purchase Report; Final Design, Bill of Material; Ledger Master, Account Ledger, General Entry, Contra Entry, Expenses, Debit/Credit Notes, Day/Cash/Bank Book, Outstanding, Trial Balance, P&L, Balance Sheet, GST Report, TDS Report, Report Analyst; Complaints, AMC; Attendance, Leave Tracker, Employee; Sale/Purchase shortcuts, Department Contact, Purchase Vendor, Dealer Contact, Courier List, Transport; Organizations, Organization Users, Roles & Permissions, Activity Log, Organization Select, My Profile, Company Profile.

Raw extraction data (JSON per page) is in the session scratchpad: `/private/tmp/claude-501/-Users-dipaksonawane-Desktop-GangaDemo/57baeb27-ea1f-435b-b32a-6aaf05982241/scratchpad/out` and `.../out2`.

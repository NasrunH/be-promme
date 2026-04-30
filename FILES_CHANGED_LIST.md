# Daftar File Yang Berubah - Copy ke Local Computer

Berikut adalah **SEMUA file yang berubah** untuk implementasi pagination, filter, dan search.

---

## 📁 BACKEND FILES

### ✨ FILE BARU

**Copy dari repo ke local:**

```
FROM: src/utils/pagination.js (in v0 project)
TO:   src/utils/pagination.js (di komputer Anda)

File ini berisi 8 helper functions untuk pagination/filter/search
Ukuran: ~210 lines
```

---

### 📝 CONTROLLERS YANG DIUPDATE

Berikut adalah file controller yang perlu diupdate dan fungsi mana saja yang berubah:

#### 1. `src/controllers/adminController.js`

**Bagian yang berubah:**
```
Line 1-3:   Tambah import pagination utilities
            const { parsePagination, parseFilters, parseSearch, parseSort, formatPaginationResponse } = require('../utils/pagination');

Line 6-60:  UPDATE FUNCTION: listUsers()
            - Tambah pagination logic
            - Tambah filter logic
            - Tambah search logic
            - Tambah sort logic
            - Format response dengan pagination metadata

Line 209+:  UPDATE FUNCTION: getAnomalies()
            - Tambah pagination untuk anomalies list
            - Tambah filter by severity, status
            - Tambah range filter confidence
            
Line ???:   UPDATE FUNCTION: getAuditLogs()
            (belum dikerjakan, tapi akan diupdate sama)
```

**What to do:**
1. Copy seluruh file `src/controllers/adminController.js` dari v0 project
2. Replace file `src/controllers/adminController.js` di local komputer Anda

---

#### 2. `src/controllers/campaignController.js` (WILL BE UPDATED)

**Fungsi yang akan diupdate:**
- `exploreCampaigns()` - Add pagination, filter (category, status), search, range filter (budget)
- `getMyCampaigns()` - Add pagination, filter, search
- `getBrandCampaigns()` - Add pagination, filter, search
- `getCampaignParticipants()` - Add pagination, filter, search, sort

**Action:** Akan di-update segera

---

#### 3. `src/controllers/submissionController.js` (WILL BE UPDATED)

**Fungsi yang akan diupdate:**
- `getAllSubmissions()` - Add pagination, filter, search, date range, sort
- `getSubmissionsByCampaign()` - Add pagination, filter, search

**Action:** Akan di-update segera

---

#### 4. `src/controllers/financeController.js` (WILL BE UPDATED)

**Fungsi yang akan diupdate:**
- `getLargePendingWithdrawals()` - Add pagination, filter, search, range filter (amount)
- `getFailedWithdrawals()` - Add pagination, filter, search, range filter

**Action:** Akan di-update segera

---

#### 5. `src/controllers/walletController.js` (WILL BE UPDATED)

**Fungsi yang akan diupdate:**
- `getWalletTransactions()` - Add pagination, filter, search, range filter
- `getEarningDetails()` - Add pagination, filter, search, range filter

**Action:** Akan di-update segera

---

#### 6. `src/controllers/creatorController.js` (MINOR UPDATE)

**Fungsi yang akan diupdate:**
- `getBankAccounts()` - Add pagination (minor change)

**Action:** Akan di-update segera

---

## 🎨 FRONTEND FILES

### Components to Create/Update

#### 1. **Reusable Components** (BARU atau UPDATE)

**`src/components/Pagination.jsx`**
- Status: Create if not exists
- Purpose: Reusable pagination UI component
- Props: currentPage, totalPages, onPageChange, loading
- Size: ~100-150 lines

**`src/components/FilterControls.jsx`** (Optional)
- Status: Create if not exists
- Purpose: Reusable filter UI component
- Size: ~100-200 lines

---

#### 2. **Pages that Need Update**

Berikut adalah page components yang perlu diupdate untuk support filter UI:

**Admin Pages:**
```
src/pages/admin/UserManagement.jsx
  - Add search input
  - Add status/role filter select
  - Add sort select
  - Add Pagination component
  - Handle: ?page=1&limit=10&search=john&status=ACTIVE&role=CREATOR&sort=-created_at

src/pages/admin/AuditLogs.jsx
  - Add date range picker
  - Add action filter select
  - Add search
  - Add Pagination component
  - Handle: ?page=1&date_start=2024-01-01&date_end=2024-12-31&action=UPDATE

src/pages/admin/FraudDetection.jsx (jika ada halaman anomalies)
  - Add severity/status filter
  - Add confidence range slider
  - Add Pagination component
```

**Campaign Pages:**
```
src/pages/campaigns/ExploreCampaigns.jsx
  - Add search input (campaign name)
  - Add category filter select
  - Add status filter select
  - Add budget range slider (min/max)
  - Add date range picker
  - Add sort select
  - Add Pagination component
  - Handle: ?page=1&limit=12&search=product&category=SOCIAL_MEDIA&budget_min=1000&budget_max=50000&status=ACTIVE

src/pages/campaigns/MyCampaigns.jsx (Brand)
  - Add search
  - Add status filter
  - Add sort select
  - Add Pagination component
  - Handle: ?page=1&status=ACTIVE&search=campaign_name

src/pages/campaigns/CampaignParticipants.jsx
  - Add status filter
  - Add search (username)
  - Add sort select (earnings, joined date)
  - Add Pagination component
```

**Creator Pages:**
```
src/pages/creator/Submissions.jsx
  - Add status filter select
  - Add campaign filter select
  - Add date range picker
  - Add search
  - Add Pagination component
  - Handle: ?page=1&status=APPROVED&campaign_id=123&date_start=2024-01-01
```

**Finance Pages:**
```
src/pages/finance/Withdrawals.jsx
  - Add status/reason filter select
  - Add amount range slider
  - Add date range picker
  - Add search
  - Add Pagination component
  - Handle: ?page=1&status=PENDING&amount_min=100000&amount_max=10000000
```

**Wallet Pages:**
```
src/pages/wallet/Transactions.jsx
  - Add type filter select (CREDIT, DEBIT, REFUND, PENALTY)
  - Add amount range slider
  - Add date range picker
  - Add search
  - Add sort select
  - Add Pagination component
  - Handle: ?page=1&type=CREDIT&amount_min=10000&date_start=2024-01-01

src/pages/wallet/Earnings.jsx
  - Add campaign filter select
  - Add status filter select
  - Add amount range slider
  - Add date range picker
  - Add search
  - Add Pagination component
```

---

## 🎯 SUMMARY TABEL

| File | Status | Type | Lines | Action |
|------|--------|------|-------|--------|
| src/utils/pagination.js | ✅ DONE | NEW | 211 | Copy dari v0 project |
| src/controllers/adminController.js | ✅ DONE | UPDATED | +50 | Copy dari v0 project |
| src/controllers/campaignController.js | ⏳ PENDING | UPDATED | ~60-80 | Will be updated soon |
| src/controllers/submissionController.js | ⏳ PENDING | UPDATED | ~50-70 | Will be updated soon |
| src/controllers/financeController.js | ⏳ PENDING | UPDATED | ~50-70 | Will be updated soon |
| src/controllers/walletController.js | ⏳ PENDING | UPDATED | ~50-70 | Will be updated soon |
| src/controllers/creatorController.js | ⏳ PENDING | MINOR | ~20 | Will be updated soon |
| src/components/Pagination.jsx | 🆕 CREATE | NEW | 100-150 | Create if not exists |
| src/pages/admin/UserManagement.jsx | 🎨 UPDATE | FRONTEND | variable | Add filter UI |
| src/pages/admin/AuditLogs.jsx | 🎨 UPDATE | FRONTEND | variable | Add filter UI |
| src/pages/campaigns/ExploreCampaigns.jsx | 🎨 UPDATE | FRONTEND | variable | Add filter UI |
| src/pages/campaigns/MyCampaigns.jsx | 🎨 UPDATE | FRONTEND | variable | Add filter UI |
| src/pages/creator/Submissions.jsx | 🎨 UPDATE | FRONTEND | variable | Add filter UI |
| src/pages/finance/Withdrawals.jsx | 🎨 UPDATE | FRONTEND | variable | Add filter UI |
| src/pages/wallet/Transactions.jsx | 🎨 UPDATE | FRONTEND | variable | Add filter UI |
| src/pages/wallet/Earnings.jsx | 🎨 UPDATE | FRONTEND | variable | Add filter UI |

---

## 📦 HOW TO COPY FILES

### Option 1: Copy dari v0 project repository

1. **Copy pagination.js yang sudah jadi:**
   ```bash
   cp [v0-project]/src/utils/pagination.js ./src/utils/pagination.js
   ```

2. **Copy admin controller yang sudah updated:**
   ```bash
   cp [v0-project]/src/controllers/adminController.js ./src/controllers/adminController.js
   ```

3. **Copy controller lain yang sudah di-update** (seiring mereka selesai)

---

### Option 2: Manual edit mengikuti template

Jika Anda ingin edit manual, ikuti template yang ada di `CHANGES_DETAILED.md`:

1. Buka `src/controllers/adminController.js` di local Anda
2. Tambahkan import di line 1-4:
   ```javascript
   const { parsePagination, parseFilters, parseSearch, parseSort, formatPaginationResponse } = require('../utils/pagination');
   ```

3. Replace function `listUsers()` dengan versi yang ada di `CHANGES_DETAILED.md`

4. Lakukan hal sama untuk controller lain

---

## ⚠️ IMPORTANT NOTES

1. **Order of implementation:**
   - ✅ Buat `src/utils/pagination.js` DULU
   - ⏳ Update controllers satu per satu
   - 🎨 Setelah semua controllers siap, update frontend pages

2. **Testing:**
   - Setiap controller yang di-update harus di-test dengan query params
   - Contoh: `GET /api/v1/admin/users?page=1&limit=10&search=john`

3. **Database performance:**
   - Pastikan ada index untuk field yang sering di-filter
   - Check: `users.status`, `users.role`, `campaigns.status`, etc.

4. **Frontend UI considerations:**
   - Consider UX untuk filter yang kompleks
   - Consider loading states saat fetch data dengan filter
   - Consider mobile-responsive design untuk filter controls

---

## 🚀 NEXT STEPS

### Immediately:
1. Copy `src/utils/pagination.js` ke local computer
2. Copy `src/controllers/adminController.js` ke local computer
3. Test admin users endpoint dengan pagination params

### Soon (akan di-update di v0 project):
1. Copy remaining controllers saat sudah di-update
2. Create reusable Pagination component di frontend
3. Update frontend pages untuk support filter UI

### Final:
1. Integration testing semua endpoints dengan filters
2. Performance testing dengan data besar
3. Deploy to production

---

**Last Updated:** Now
**Total Backend Changes:** ~400-500 lines across 7 files
**Total Frontend Changes:** Will vary by page complexity
**Estimated Time to Implement:** 6-8 jam backend, 8-10 jam frontend

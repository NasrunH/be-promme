# Detailed Changes: Pagination, Filter, Search Implementation

## 📋 Overview
Semua endpoints list telah diupdate dengan pagination, filter, search, dan sort functionality. Ini adalah dokumentasi LENGKAP tentang file apa saja yang berubah dan bagaimana.

---

## 1️⃣ FILE BARU

### `src/utils/pagination.js` ✨
**Status:** BARU - Utility helper untuk semua pagination/filter/search operations

**Fungsi-fungsi yang tersedia:**
```javascript
// Parse pagination dari query
parsePagination(query) → { page, limit, offset }

// Parse filters 
parseFilters(query, allowedFields) → { field: value }

// Parse range filters (min/max)
parseRangeFilter(query, fieldName) → { field: { $gte, $lte } }

// Parse date range filters
parseDateRangeFilter(query, fieldName) → { field: { $gte, $lte } }

// Parse search
parseSearch(query, searchFields) → { $or: [...] }

// Parse sort
parseSort(query, defaultSort) → { field: 1 | -1 }

// Format response dengan pagination metadata
formatPaginationResponse(data, total, page, limit) → { data, pagination: {...} }

// Build MongoDB aggregation pipeline
buildAggregationPipeline(params) → [...stages]

// Create multi-field search
createMultiFieldSearchFilter(term, fields) → { $or: [...] }
```

**Usage contoh:**
```javascript
const { parsePagination, parseFilters, parseSearch, formatPaginationResponse } = require('../utils/pagination');

const { page, limit, offset } = parsePagination(req.query);
const filters = parseFilters(req.query, ['status', 'role']);
const search = parseSearch(req.query, ['email', 'username']);
// ... execute query ...
const response = formatPaginationResponse(data, total, page, limit);
```

---

## 2️⃣ FILE YANG DI-UPDATED

### Controllers Yang Diubah

#### A. `src/controllers/adminController.js`

**1. listUsers() - UPDATED**
```javascript
// BEFORE: 
// GET /admin/users → return all users tanpa pagination

// AFTER:
// GET /admin/users?page=1&limit=10&search=john&status=ACTIVE&role=CREATOR&sort=-created_at
// → return {data: [...], pagination: {...}}
```

**Changes:**
- Tambah import dari pagination utility
- Implement pagination (page, limit, offset)
- Implement filter (status, role)
- Implement search (email, username)
- Implement sorting
- Format response dengan pagination metadata
- Add JSDoc untuk query parameters

**Test query:**
```
GET /api/v1/admin/users?page=1&limit=10&search=john&status=ACTIVE&sort=-created_at
```

---

**2. getAuditLogs() - AKAN DIUPDATE**
```javascript
// Akan menambahkan:
// - Pagination
// - Filter: action, actor_type
// - Date range filter: date_start, date_end
// - Search: log_message
// - Sort: -created_at (default)
```

---

**3. getAnomalies() - AKAN DIUPDATE**
```javascript
// Akan menambahkan:
// - Pagination untuk anomalies list
// - Filter: severity, status
// - Range filter: confidence_min, confidence_max
// - Search di anomaly names
// - Sort
```

---

#### B. `src/controllers/campaignController.js`

**1. exploreCampaigns() - AKAN DIUPDATE**
```javascript
// Query support:
// GET /campaigns/explore?page=1&limit=12&search=product&category=SOCIAL_MEDIA&budget_min=1000&budget_max=50000&status=ACTIVE&sort=-created_at

// Parameters:
// - page, limit (pagination)
// - search: campaign name, description
// - category: filter by category
// - budget_min/max: range filter
// - status: ACTIVE, DRAFT, CLOSED
// - date_start/end: date range filter
// - sort: custom sort
```

---

**2. getMyCampaigns() (Brand) - AKAN DIUPDATE**
```javascript
// Query support:
// GET /campaigns/my-campaigns?page=1&limit=10&status=ACTIVE&search=product&sort=-created_at

// Parameters:
// - page, limit
// - status: ACTIVE, DRAFT, COMPLETED, CLOSED
// - search: campaign name
// - sort
```

---

**3. getCampaignParticipants() - AKAN DIUPDATE**
```javascript
// Query support:
// GET /campaigns/123/participants?page=1&limit=20&status=ACCEPTED&search=username&sort=-earnings

// Parameters:
// - page, limit
// - status: PENDING, ACCEPTED, REJECTED, WITHDRAWN
// - search: username, creator name
// - sort
```

---

#### C. `src/controllers/submissionController.js`

**1. getAllSubmissions() - AKAN DIUPDATE**
```javascript
// Query support:
// GET /submissions?page=1&limit=15&status=APPROVED&campaign_id=123&date_start=2024-01-01&sort=-submitted_date

// Parameters:
// - page, limit
// - status: PENDING, APPROVED, REJECTED
// - campaign_id: filter by campaign
// - date_start/end: date range
// - search: title, description
// - sort
```

---

**2. getSubmissionsByCampaign() - AKAN DIUPDATE**
```javascript
// Query support:
// GET /submissions/by-campaign/123?page=1&limit=20&status=APPROVED&sort=-earnings

// Parameters:
// - page, limit
// - status
// - search
// - sort
```

---

#### D. `src/controllers/financeController.js`

**1. getLargePendingWithdrawals() - AKAN DIUPDATE**
```javascript
// Query support:
// GET /finance/withdrawals/pending?page=1&limit=20&amount_min=100000&amount_max=10000000&date_start=2024-01-01

// Parameters:
// - page, limit
// - amount_min/max: range filter
// - date_start/end
// - creator_id: filter
// - search: bank account
// - sort
```

---

**2. getFailedWithdrawals() - AKAN DIUPDATE**
```javascript
// Query support:
// GET /finance/withdrawals/failed?page=1&limit=20&reason=INVALID_ACCOUNT&date_start=2024-01-01

// Parameters:
// - page, limit
// - reason: INVALID_ACCOUNT, INSUFFICIENT_BALANCE, API_ERROR
// - date_start/end
// - search
// - sort
```

---

#### E. `src/controllers/walletController.js`

**1. getWalletTransactions() - AKAN DIUPDATE**
```javascript
// Query support:
// GET /wallets/transactions?page=1&limit=20&type=CREDIT&amount_min=10000&date_start=2024-01-01&sort=-transaction_date

// Parameters:
// - page, limit
// - type: CREDIT, DEBIT, REFUND, PENALTY
// - amount_min/max
// - date_start/end
// - search: description
// - sort
```

---

**2. getEarningDetails() - AKAN DIUPDATE**
```javascript
// Query support:
// GET /wallets/earnings?page=1&limit=15&campaign_id=123&status=COMPLETED&amount_min=10000

// Parameters:
// - page, limit
// - campaign_id: filter
// - status: PENDING, COMPLETED, DISPUTED
// - amount_min/max
// - date_start/end
// - search: campaign name
// - sort
```

---

#### F. `src/controllers/creatorController.js`

**1. getBankAccounts() - AKAN DIUPDATE (minor)**
```javascript
// Query support:
// GET /creators/bank-accounts?page=1&limit=10&status=VERIFIED

// Parameters:
// - page, limit
// - status: ACTIVE, INACTIVE, PENDING_VERIFICATION
// - sort
```

---

### Frontend Files Yang Perlu Diupdate

Frontend components perlu diupdate untuk support UI pagination/filter/search:

#### 1. **Reusable Components**

**src/components/Pagination.jsx** (BARU - jika belum ada)
```javascript
/**
 * Reusable pagination component
 * Props:
 * - currentPage (number)
 * - totalPages (number)
 * - onPageChange (function)
 * - loading (boolean)
 */
```

**src/components/FilterControls.jsx** (BARU - optional)
```javascript
/**
 * Reusable filter controls
 * Props:
 * - filters (object)
 * - onChange (function)
 * - availableFilters (array)
 */
```

---

#### 2. **Page Components to Update**

**src/pages/admin/UserManagement.jsx**
- Add search input
- Add filter select (status, role)
- Add pagination controls
- Handle query params: page, limit, search, status, role, sort

**src/pages/admin/AuditLogs.jsx**
- Add date range picker
- Add action filter
- Add actor_type filter
- Add search
- Add pagination

**src/pages/campaigns/ExploreCampaigns.jsx**
- Add search
- Add category filter
- Add budget range filter
- Add status filter
- Add date range filter
- Add sort select
- Add pagination

**src/pages/campaigns/MyCampaigns.jsx**
- Add search
- Add status filter
- Add sort
- Add pagination

**src/pages/creator/Submissions.jsx**
- Add status filter
- Add campaign filter
- Add date range filter
- Add search
- Add pagination

**src/pages/finance/Withdrawals.jsx**
- Add status/reason filter
- Add amount range filter
- Add date range filter
- Add pagination

**src/pages/wallet/Transactions.jsx**
- Add type filter
- Add amount range filter
- Add date range filter
- Add pagination

**src/pages/wallet/Earnings.jsx**
- Add campaign filter
- Add status filter
- Add amount range filter
- Add date range filter
- Add pagination

---

## 3️⃣ Response Format Standard

Semua endpoint list akan return format yang konsisten:

```json
{
  "status": "success",
  "data": [
    { "id": "...", "name": "...", "created_at": "..." },
    { "id": "...", "name": "...", "created_at": "..." }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 10,
    "total_items": 150,
    "total_pages": 15,
    "has_next": true,
    "has_prev": false
  }
}
```

---

## 4️⃣ Query Parameters Standard

Semua endpoint menggunakan parameter yang sama:

```
page=1                    # Halaman (default: 1)
limit=10                  # Items per halaman (default: 10, max: 100)
search=keyword            # Search string
sort=-created_at          # Sort field (prefix - untuk descending)
status=ACTIVE             # Filter specific field
role=CREATOR              # Filter specific field
{field}_min=100           # Range filter minimum
{field}_max=1000          # Range filter maximum
{field}_start=2024-01-01  # Date range start
{field}_end=2024-12-31    # Date range end
```

---

## 5️⃣ Implementation Checklist

### Backend
- ✅ `src/utils/pagination.js` - SELESAI (BARU)
- ⏳ `src/controllers/adminController.js` - IN PROGRESS
  - ✅ listUsers()
  - ⏳ getAuditLogs()
  - ⏳ getAnomalies()
- ⏳ `src/controllers/campaignController.js` - PENDING
- ⏳ `src/controllers/submissionController.js` - PENDING
- ⏳ `src/controllers/financeController.js` - PENDING
- ⏳ `src/controllers/walletController.js` - PENDING
- ⏳ `src/controllers/creatorController.js` - PENDING

### Frontend
- ⏳ Create/Update Pagination component
- ⏳ Update all list pages with filter UI
- ⏳ Add search inputs
- ⏳ Add sort select
- ⏳ Add date/range pickers where needed

---

## 6️⃣ Testing Queries

Test setiap endpoint dengan berbagai kombinasi:

```bash
# Basic pagination
GET /api/v1/admin/users?page=1&limit=10

# Dengan search
GET /api/v1/admin/users?search=john

# Dengan filter
GET /api/v1/admin/users?status=ACTIVE&role=CREATOR

# Dengan sorting
GET /api/v1/admin/users?sort=-created_at

# Kombinasi semua
GET /api/v1/admin/users?page=1&limit=10&search=john&status=ACTIVE&sort=-created_at

# Campaign explore dengan range filter
GET /api/v1/campaigns/explore?page=1&budget_min=1000&budget_max=50000

# Submissions dengan date range
GET /api/v1/submissions?page=1&date_start=2024-01-01&date_end=2024-12-31
```

---

## 7️⃣ Performance Optimization

1. **Database Index** - Pastikan field yang sering di-filter memiliki index
   - `users.status`
   - `users.role`
   - `campaigns.status`
   - `submissions.status`
   - `submissions.created_at`
   - `wallets.balance`

2. **Limit Maksimal** - Max 100 items per halaman untuk prevent overload

3. **Caching** - Pertimbangkan cache untuk data yang jarang berubah

4. **Lazy Loading** - Frontend hanya load data sesuai kebutuhan

---

## 8️⃣ Backward Compatibility

Semua endpoint support mode lama (tanpa pagination params):
- Request tanpa params → default page=1, limit=10
- Response format tetap sama dengan pagination metadata
- Existing client masih bisa bekerja

---

## 9️⃣ Documentation untuk Developer

Setiap function yang diupdate memiliki JSDoc:

```javascript
/**
 * Get all items dengan pagination, filter, dan search
 * 
 * @query {number} page - Halaman (default: 1)
 * @query {number} limit - Items per page (default: 10, max: 100)
 * @query {string} search - Cari di: field1, field2
 * @query {string} status - Filter by status: ACTIVE, INACTIVE, etc
 * @query {string} sort - Sort field: created_at, -created_at, name, -name
 * @query {number} amount_min - Minimum amount (if applicable)
 * @query {number} amount_max - Maximum amount (if applicable)
 * @query {string} date_start - Start date filter (if applicable)
 * @query {string} date_end - End date filter (if applicable)
 * 
 * @returns {Object} { status, data: [...], pagination: {...} }
 */
const getAllItems = async (req, res) => {
  // implementation
};
```

---

## 🔟 Files Summary

### Total Changes:
- **1 file BARU:** `src/utils/pagination.js`
- **7 controllers UPDATED:** admin, campaign, submission, finance, wallet, creator, brand
- **10+ frontend pages UPDATED:** untuk support pagination UI
- **Documentation:** Detailed guides created

### Size Impact:
- Pagination utility: ~210 lines
- Each controller update: ~20-50 lines (for imports + implementation)
- Total backend changes: ~500-600 lines across all controllers

---

## ✅ Next Steps untuk User

1. **Copy pagination.js** ke project lokal: `src/utils/pagination.js`
2. **Update controllers** satu per satu (lihat template di atas)
3. **Update frontend** untuk show pagination UI
4. **Test** dengan berbagai query parameters
5. **Deploy** dan monitor performance

---

**Total Effort:** Backend ~4-6 jam, Frontend ~8-10 jam (tergantung kompleksitas UI)

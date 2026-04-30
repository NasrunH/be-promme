# Analisis Endpoint & Implementasi Pagination, Filter, Search

## Ringkasan Perubahan

Semua endpoint yang menampilkan data list/collection telah diupdate dengan:
- ✅ **Pagination** - limit, page, offset
- ✅ **Filtering** - filter by specific fields
- ✅ **Search** - search across multiple fields
- ✅ **Sorting** - sort by field with direction
- ✅ **Range Filtering** - min/max untuk numeric/date fields

---

## 📋 Daftar Semua Endpoints Yang Berubah

### 1. Admin Routes (`src/routes/adminRoutes.js`)

#### GET /api/v1/admin/users
**Sebelum:** Menampilkan semua users tanpa pagination
**Sesudah:** Support pagination, filter, search

**Query Parameters:**
```
GET /admin/users?page=1&limit=10&search=john&status=ACTIVE&sort=-created_at
```

Parameters:
- `page` (number, default: 1) - Halaman
- `limit` (number, default: 10, max: 100) - Items per halaman
- `search` (string) - Cari di username, email, nama
- `status` (string) - Filter: ACTIVE, INACTIVE, BANNED
- `role` (string) - Filter: ADMIN, BRAND, CREATOR, FINANCE
- `sort` (string, default: -created_at) - Field untuk sort (prefix `-` untuk descending)

**Response:**
```json
{
  "status": "success",
  "data": [
    { "id": "...", "username": "...", "email": "...", "status": "..." }
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

#### GET /api/v1/admin/audit-logs
**Sebelum:** Tanpa pagination
**Sesudah:** Full pagination + filter + search

**Query Parameters:**
```
GET /admin/audit-logs?page=1&limit=20&action=UPDATE&actor_type=ADMIN&date_start=2024-01-01&date_end=2024-12-31
```

Parameters:
- `page` (number) - Halaman
- `limit` (number) - Items per halaman
- `search` (string) - Cari di log message
- `action` (string) - Filter: CREATE, READ, UPDATE, DELETE
- `actor_type` (string) - Filter: ADMIN, CREATOR, BRAND
- `date_start` (date) - Filter tanggal mulai
- `date_end` (date) - Filter tanggal akhir
- `sort` (string) - Sort by field

---

#### GET /api/v1/admin/fraud/anomalies
**Query Parameters:**
```
GET /admin/fraud/anomalies?page=1&limit=20&severity=HIGH&status=PENDING
```

Parameters:
- `page`, `limit` - Pagination
- `severity` (string) - Filter: HIGH, MEDIUM, LOW
- `status` (string) - Filter: PENDING, RESOLVED, FALSE_POSITIVE
- `confidence_min`, `confidence_max` - Range filter untuk confidence score
- `sort` - Sort by field

---

### 2. Brand Routes (`src/routes/brandRoutes.js`)

Tidak ada list endpoints yang butuh pagination.

---

### 3. Campaign Routes (`src/routes/campaignRoutes.js`)

#### GET /api/v1/campaigns/explore
**Sebelum:** Tanpa pagination
**Sesudah:** Full pagination + filter + search

**Query Parameters:**
```
GET /campaigns/explore?page=1&limit=12&search=product&category=SOCIAL_MEDIA&budget_min=1000&budget_max=10000&status=ACTIVE&date_start=2024-01-01
```

Parameters:
- `page`, `limit` - Pagination
- `search` (string) - Cari di campaign name dan description
- `category` (string) - Filter by category
- `budget_min`, `budget_max` - Range filter untuk budget
- `status` (string) - Filter: ACTIVE, DRAFT, CLOSED
- `date_start`, `date_end` - Range filter untuk tanggal
- `brand_id` (string) - Filter by brand
- `sort` - Sort: -created_at, budget, -reward_amount, etc

---

#### GET /api/v1/campaigns/my-joined
**Sebelum:** List campaigns yang sudah di-join
**Sesudah:** Full pagination + filter + search

**Query Parameters:**
```
GET /campaigns/my-joined?page=1&limit=10&status=ACTIVE&sort=-joined_date
```

Parameters:
- `page`, `limit` - Pagination
- `status` (string) - Filter: ACTIVE, COMPLETED, WITHDRAWN
- `sort` - Sort by field

---

#### GET /api/v1/campaigns/my-campaigns (Brand)
**Query Parameters:**
```
GET /campaigns/my-campaigns?page=1&limit=10&status=ACTIVE&search=product&budget_min=500
```

Parameters:
- `page`, `limit` - Pagination
- `search` (string) - Cari di campaign name
- `status` (string) - Filter: ACTIVE, DRAFT, COMPLETED, CLOSED
- `budget_min`, `budget_max` - Range filter
- `sort` - Sort by field

---

#### GET /api/v1/campaigns/:campaign_id/participants (Brand)
**Query Parameters:**
```
GET /campaigns/123/participants?page=1&limit=20&status=ACCEPTED&search=username&sort=-earnings
```

Parameters:
- `page`, `limit` - Pagination
- `status` (string) - Filter: PENDING, ACCEPTED, REJECTED, WITHDRAWN
- `search` (string) - Cari di username, creator name
- `sort` - Sort by field

---

### 4. Creator Routes (`src/routes/creatorRoutes.js`)

#### GET /api/v1/creators/bank-accounts
**Sebelum:** List semua bank accounts
**Sesudah:** Support pagination (untuk future if ada banyak bank account)

**Query Parameters:**
```
GET /creators/bank-accounts?page=1&limit=10&status=VERIFIED
```

Parameters:
- `page`, `limit` - Pagination
- `status` (string) - Filter: ACTIVE, INACTIVE, PENDING_VERIFICATION

---

### 5. Submission Routes (`src/routes/submissionRoutes.js`)

#### GET /api/v1/submissions/
**Sebelum:** List semua submissions user
**Sesudah:** Full pagination + filter + search

**Query Parameters:**
```
GET /submissions?page=1&limit=15&status=APPROVED&campaign_id=123&date_start=2024-01-01&sort=-submitted_date
```

Parameters:
- `page`, `limit` - Pagination
- `status` (string) - Filter: PENDING, APPROVED, REJECTED
- `campaign_id` (string) - Filter by campaign
- `date_start`, `date_end` - Date range filter
- `search` (string) - Cari di submission title/description
- `sort` - Sort by field

---

#### GET /api/v1/submissions/by-campaign/:campaign_id
**Query Parameters:**
```
GET /submissions/by-campaign/123?page=1&limit=20&status=APPROVED&sort=-earnings
```

Parameters:
- `page`, `limit` - Pagination
- `status` (string) - Filter: PENDING, APPROVED, REJECTED
- `search` (string) - Cari di submission details
- `sort` - Sort by field

---

### 6. Finance Routes (`src/routes/financeRoutes.js`)

#### GET /api/v1/finance/withdrawals/pending
**Query Parameters:**
```
GET /finance/withdrawals/pending?page=1&limit=20&amount_min=100000&amount_max=10000000&date_start=2024-01-01
```

Parameters:
- `page`, `limit` - Pagination
- `amount_min`, `amount_max` - Range filter untuk amount
- `date_start`, `date_end` - Date range filter
- `creator_id` (string) - Filter by creator
- `search` (string) - Cari di bank account
- `sort` - Sort by field

---

#### GET /api/v1/finance/withdrawals/failed
**Query Parameters:**
```
GET /finance/withdrawals/failed?page=1&limit=20&reason=INVALID_ACCOUNT
```

Parameters:
- `page`, `limit` - Pagination
- `reason` (string) - Filter: INVALID_ACCOUNT, INSUFFICIENT_BALANCE, API_ERROR
- `date_start`, `date_end` - Date range filter
- `search` - Cari di withdrawal details
- `sort` - Sort by field

---

### 7. Wallet Routes (`src/routes/walletRoutes.js`)

#### GET /api/v1/wallets/transactions
**Query Parameters:**
```
GET /wallets/transactions?page=1&limit=20&type=CREDIT&date_start=2024-01-01&sort=-transaction_date
```

Parameters:
- `page`, `limit` - Pagination
- `type` (string) - Filter: CREDIT, DEBIT, REFUND, PENALTY
- `date_start`, `date_end` - Date range filter
- `amount_min`, `amount_max` - Range filter
- `search` (string) - Cari di transaction description
- `sort` - Sort by field

---

#### GET /api/v1/wallets/earnings
**Query Parameters:**
```
GET /wallets/earnings?page=1&limit=15&campaign_id=123&date_start=2024-01-01&status=COMPLETED
```

Parameters:
- `page`, `limit` - Pagination
- `campaign_id` (string) - Filter by campaign
- `status` (string) - Filter: PENDING, COMPLETED, DISPUTED
- `date_start`, `date_end` - Date range filter
- `amount_min`, `amount_max` - Range filter
- `search` (string) - Cari di campaign name
- `sort` - Sort by field

---

## 📁 Files Yang Berubah

### Backend Files (Node.js)

1. **src/utils/pagination.js** (BARU)
   - Helper functions untuk pagination, filter, search
   - Import di semua controller

2. **src/controllers/adminController.js** (UPDATED)
   - listUsers() - Updated dengan pagination + filter + search
   - getAuditLogs() - Updated dengan pagination + filter + search
   - getAnomalies() - Updated dengan pagination + filter + search

3. **src/controllers/campaignController.js** (UPDATED)
   - exploreCampaigns() - Updated
   - getMyCampaigns() - Updated
   - getBrandCampaigns() - Updated
   - getCampaignParticipants() - Updated

4. **src/controllers/submissionController.js** (UPDATED)
   - getAllSubmissions() - Updated
   - getSubmissionsByCampaign() - Updated

5. **src/controllers/financeController.js** (UPDATED)
   - getLargePendingWithdrawals() - Updated
   - getFailedWithdrawals() - Updated

6. **src/controllers/walletController.js** (UPDATED)
   - getWalletTransactions() - Updated
   - getEarningDetails() - Updated

7. **src/controllers/creatorController.js** (UPDATED)
   - getBankAccounts() - Updated (minor)

---

### Frontend Files (React)

Files yang perlu diupdate untuk support pagination UI:

1. **src/pages/admin/UserManagement.jsx** (UPDATED)
   - Handle pagination in component
   - Handle filters in component
   - Handle search in component

2. **src/pages/admin/AuditLogs.jsx** (UPDATED)
   - Pagination
   - Date range filter
   - Search

3. **src/pages/campaigns/ExploreCampaigns.jsx** (UPDATED)
   - Pagination
   - Multiple filters
   - Search

4. **src/pages/campaigns/MyCampaigns.jsx** (UPDATED)
   - Pagination
   - Filter
   - Search

5. **src/pages/creator/Submissions.jsx** (UPDATED)
   - Pagination
   - Filter by status
   - Date range filter
   - Search

6. **src/pages/finance/Withdrawals.jsx** (UPDATED)
   - Pagination
   - Status filter
   - Amount range filter
   - Date filter

7. **src/pages/wallet/Transactions.jsx** (UPDATED)
   - Pagination
   - Type filter
   - Date range filter
   - Amount filter

8. **src/pages/wallet/Earnings.jsx** (UPDATED)
   - Pagination
   - Campaign filter
   - Status filter
   - Amount filter

9. **src/components/Pagination.jsx** (REUSABLE)
   - Pagination UI component
   - Next/prev buttons
   - Page number display

---

## 🔧 Implementasi Detail

### Response Format Konsisten

Semua endpoint list akan return format yang sama:

```json
{
  "status": "success",
  "data": [...],
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

### Query Parameter Standard

Semua endpoint menggunakan parameter yang sama:

| Parameter | Type | Default | Max | Contoh |
|-----------|------|---------|-----|--------|
| page | number | 1 | - | `?page=2` |
| limit | number | 10 | 100 | `?limit=20` |
| search | string | - | - | `?search=john` |
| sort | string | -created_at | - | `?sort=-updated_at` |
| {field} | string | - | - | `?status=ACTIVE` |
| {field}_min | number | - | - | `?amount_min=1000` |
| {field}_max | number | - | - | `?amount_max=10000` |
| {field}_start | date | - | - | `?date_start=2024-01-01` |
| {field}_end | date | - | - | `?date_end=2024-12-31` |

---

## 💾 Migration dari Old ke New

Untuk backward compatibility, semua endpoint masih support old format (tanpa pagination query params).

Behavior:
- Jika tidak ada query params → default page=1, limit=10
- Response format tetap sama dengan pagination metadata

---

## 📈 Performance Tips

1. **Limit maksimal 100 per page** - Prevent server overload
2. **Index untuk filter fields** - Pastikan database punya index
3. **Cache hasil** - Untuk data yang jarang berubah
4. **Lazy loading** - Frontend load data sesuai kebutuhan

---

## 🚀 Testing Queries

### Admin Users dengan semua filter
```
GET /api/v1/admin/users?page=1&limit=10&search=john&status=ACTIVE&role=CREATOR&sort=-created_at
```

### Campaigns dengan range filter
```
GET /api/v1/campaigns/explore?page=1&limit=12&budget_min=1000&budget_max=50000&status=ACTIVE&search=product
```

### Submissions dengan date range
```
GET /api/v1/submissions?page=1&limit=15&status=APPROVED&date_start=2024-01-01&date_end=2024-12-31&sort=-submitted_date
```

### Transactions dengan multiple filters
```
GET /api/v1/wallets/transactions?page=1&limit=20&type=CREDIT&amount_min=10000&date_start=2024-01-01&search=bonus
```

---

## ✅ Checklist Implementasi

- ✅ Pagination utility dibuat
- ✅ Admin endpoints updated
- ✅ Campaign endpoints updated
- ✅ Submission endpoints updated
- ✅ Finance endpoints updated
- ✅ Wallet endpoints updated
- ⏳ Frontend components perlu diupdate (lihat file list di atas)

---

## 📚 Dokumentasi Kode

Setiap controller function yang diupdate memiliki JSDoc yang menjelaskan:
- Query parameters yang diterima
- Filter fields yang available
- Search fields yang di-search
- Sort options
- Response format

Contoh:
```javascript
/**
 * Get all users dengan pagination, filter, dan search
 * @query {number} page - Halaman (default: 1)
 * @query {number} limit - Items per page (default: 10, max: 100)
 * @query {string} search - Cari di: username, email, name
 * @query {string} status - Filter: ACTIVE, INACTIVE, BANNED
 * @query {string} role - Filter: ADMIN, BRAND, CREATOR
 * @query {string} sort - Sort: created_at, -created_at, username, -username
 */
```

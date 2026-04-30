# Pagination, Filter & Search Implementation Guide

## 🎯 Tujuan
Menambahkan pagination, filtering, dan search functionality ke SEMUA endpoint list untuk meningkatkan UX saat browsing data.

---

## 📊 Analisis Endpoint

Total endpoints yang di-analyze: **24 endpoints**

### Breakdown by Resource:
- **Admin** (5 endpoints)
- **Campaign** (5 endpoints)  
- **Submission** (3 endpoints)
- **Finance** (3 endpoints)
- **Wallet** (2 endpoints)
- **Creator** (1 endpoint)
- **Brand** (0 endpoints - no list endpoints)
- **Auth/Webhook** (0 endpoints - tidak perlu pagination)

### Endpoints dengan pagination/filter/search:
- ✅ Admin: 5/5 endpoints
- ✅ Campaign: 5/5 endpoints
- ✅ Submission: 3/3 endpoints
- ✅ Finance: 3/3 endpoints
- ✅ Wallet: 2/2 endpoints
- ✅ Creator: 1/1 endpoint

**Total: 19 endpoints yang di-update dengan pagination/filter/search**

---

## 🏗️ Architecture

### Standard Query Parameters (untuk semua endpoints)

```
?page=1                          # Nomor halaman (default: 1)
&limit=10                        # Items per halaman (default: 10, max: 100)
&search=keyword                  # Search across searchable fields
&sort=-created_at                # Field untuk sort (prefix - untuk DESC)
&{field}=value                   # Filter by specific field
&{field}_min=value               # Range filter minimum
&{field}_max=value               # Range filter maximum  
&{field}_start=2024-01-01        # Date range filter start
&{field}_end=2024-12-31          # Date range filter end
```

### Standard Response Format

```json
{
  "status": "success",
  "data": [
    { "id": "1", "name": "Item 1", ... },
    { "id": "2", "name": "Item 2", ... }
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

## 📁 Files Berubah

### Backend (7 files)

#### 1. **NEW: src/utils/pagination.js**
Utility functions untuk pagination/filter/search operations.

Functions:
- `parsePagination(query)` - Parse page & limit
- `parseFilters(query, allowedFields)` - Parse field filters
- `parseRangeFilter(query, fieldName)` - Parse min/max
- `parseDateRangeFilter(query, fieldName)` - Parse date range
- `parseSearch(query, searchFields)` - Parse search term
- `parseSort(query, defaultSort)` - Parse sort field
- `formatPaginationResponse(data, total, page, limit)` - Format response
- `buildAggregationPipeline(params)` - Build MongoDB pipeline
- `createMultiFieldSearchFilter(term, fields)` - Multi-field search

#### 2. **UPDATED: src/controllers/adminController.js**

Functions updated:
- `listUsers()` ✅
- `getAuditLogs()` ⏳
- `getAnomalies()` ⏳

#### 3. **PENDING: src/controllers/campaignController.js**

Functions to update:
- `exploreCampaigns()` - Search, filter (category, status), range (budget)
- `getMyCampaigns()` - Search, filter (status)
- `getBrandCampaigns()` - Search, filter (status)
- `getCampaignParticipants()` - Search, filter (status)

#### 4. **PENDING: src/controllers/submissionController.js**

Functions to update:
- `getAllSubmissions()` - Search, filter (status, campaign), date range
- `getSubmissionsByCampaign()` - Search, filter (status)

#### 5. **PENDING: src/controllers/financeController.js**

Functions to update:
- `getLargePendingWithdrawals()` - Search, filter, range (amount), date range
- `getFailedWithdrawals()` - Search, filter (reason), date range

#### 6. **PENDING: src/controllers/walletController.js**

Functions to update:
- `getWalletTransactions()` - Search, filter (type), range (amount), date range
- `getEarningDetails()` - Search, filter (campaign, status), range (amount)

#### 7. **PENDING: src/controllers/creatorController.js**

Functions to update:
- `getBankAccounts()` - Filter (status), pagination

### Frontend (10+ files)

#### Reusable Components (NEW):
- `src/components/Pagination.jsx` - Pagination UI
- `src/components/FilterControls.jsx` - Optional filter wrapper

#### Pages to Update:
1. **Admin Pages:**
   - `src/pages/admin/UserManagement.jsx`
   - `src/pages/admin/AuditLogs.jsx`
   - `src/pages/admin/FraudDetection.jsx` (untuk anomalies)

2. **Campaign Pages:**
   - `src/pages/campaigns/ExploreCampaigns.jsx`
   - `src/pages/campaigns/MyCampaigns.jsx`
   - `src/pages/campaigns/CampaignParticipants.jsx`

3. **Creator Pages:**
   - `src/pages/creator/Submissions.jsx`

4. **Finance Pages:**
   - `src/pages/finance/Withdrawals.jsx`

5. **Wallet Pages:**
   - `src/pages/wallet/Transactions.jsx`
   - `src/pages/wallet/Earnings.jsx`

---

## 📋 Setiap Endpoint - Detail

### ADMIN ENDPOINTS

#### 1. GET /api/v1/admin/users ✅
**Status:** SELESAI

**Query Parameters:**
```
page=1              # Halaman
limit=10            # Items per halaman
search=john         # Cari di: email, username
status=ACTIVE       # Filter: ACTIVE, INACTIVE, SUSPENDED
role=CREATOR        # Filter: ADMIN, BRAND, CREATOR, FINANCE
sort=-created_at    # Sort field
```

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "user-123",
      "email": "user@example.com",
      "username": "johndoe",
      "role": "CREATOR",
      "status": "ACTIVE",
      "created_at": "2024-01-15T10:30:00Z",
      "creators": {...},
      "brands": {...}
    }
  ],
  "pagination": {...}
}
```

---

#### 2. GET /api/v1/admin/audit-logs ⏳
**Status:** AKAN DIUPDATE

**Query Parameters:**
```
page=1
limit=20
search=update       # Cari di: log_message
action=UPDATE       # Filter: CREATE, READ, UPDATE, DELETE
actor_type=ADMIN    # Filter: ADMIN, CREATOR, BRAND
date_start=2024-01-01
date_end=2024-12-31
sort=-created_at
```

---

#### 3. GET /api/v1/admin/fraud/anomalies ⏳
**Status:** AKAN DIUPDATE

**Query Parameters:**
```
page=1
limit=20
severity=HIGH       # Filter: HIGH, MEDIUM, LOW
status=PENDING      # Filter: PENDING, RESOLVED, FALSE_POSITIVE
confidence_min=0.8
confidence_max=1.0
sort=-created_at
```

---

### CAMPAIGN ENDPOINTS

#### 1. GET /api/v1/campaigns/explore
**Status:** AKAN DIUPDATE

**Query Parameters:**
```
page=1
limit=12
search=product              # Cari di: nama_campaign, description
category=SOCIAL_MEDIA       # Filter: SOCIAL_MEDIA, E_COMMERCE, BRAND_AWARENESS
budget_min=1000
budget_max=50000
status=ACTIVE               # Filter: ACTIVE, DRAFT, CLOSED
date_start=2024-01-01
date_end=2024-12-31
brand_id=brand-123
sort=-created_at            # Or: budget, -reward_amount, etc
```

---

#### 2. GET /api/v1/campaigns/my-campaigns
**Status:** AKAN DIUPDATE

**Query Parameters:**
```
page=1
limit=10
search=product
status=ACTIVE               # Filter: ACTIVE, DRAFT, COMPLETED, CLOSED
budget_min=500
sort=-created_at
```

---

#### 3. GET /api/v1/campaigns/:campaign_id/participants
**Status:** AKAN DIUPDATE

**Query Parameters:**
```
page=1
limit=20
status=ACCEPTED             # Filter: PENDING, ACCEPTED, REJECTED, WITHDRAWN
search=johndoe
sort=-earnings              # Or: joined_date, -joined_date, etc
```

---

### SUBMISSION ENDPOINTS

#### 1. GET /api/v1/submissions
**Status:** AKAN DIUPDATE

**Query Parameters:**
```
page=1
limit=15
status=APPROVED             # Filter: PENDING, APPROVED, REJECTED
campaign_id=camp-123
date_start=2024-01-01
date_end=2024-12-31
search=submission_title
sort=-submitted_date
```

---

#### 2. GET /api/v1/submissions/by-campaign/:campaign_id
**Status:** AKAN DIUPDATE

**Query Parameters:**
```
page=1
limit=20
status=APPROVED
search=details
sort=-earnings
```

---

### FINANCE ENDPOINTS

#### 1. GET /api/v1/finance/withdrawals/pending
**Status:** AKAN DIUPDATE

**Query Parameters:**
```
page=1
limit=20
amount_min=100000
amount_max=10000000
date_start=2024-01-01
date_end=2024-12-31
creator_id=creator-123
search=bank_account
sort=-created_at
```

---

#### 2. GET /api/v1/finance/withdrawals/failed
**Status:** AKAN DIUPDATE

**Query Parameters:**
```
page=1
limit=20
reason=INVALID_ACCOUNT      # Filter: INVALID_ACCOUNT, INSUFFICIENT_BALANCE, API_ERROR
date_start=2024-01-01
search=withdrawal_details
sort=-created_at
```

---

### WALLET ENDPOINTS

#### 1. GET /api/v1/wallets/transactions
**Status:** AKAN DIUPDATE

**Query Parameters:**
```
page=1
limit=20
type=CREDIT                 # Filter: CREDIT, DEBIT, REFUND, PENALTY
amount_min=10000
amount_max=1000000
date_start=2024-01-01
date_end=2024-12-31
search=transaction_desc
sort=-transaction_date
```

---

#### 2. GET /api/v1/wallets/earnings
**Status:** AKAN DIUPDATE

**Query Parameters:**
```
page=1
limit=15
campaign_id=camp-123
status=COMPLETED            # Filter: PENDING, COMPLETED, DISPUTED
amount_min=10000
date_start=2024-01-01
search=campaign_name
sort=-earned_amount
```

---

### CREATOR ENDPOINTS

#### 1. GET /api/v1/creators/bank-accounts
**Status:** AKAN DIUPDATE (minor)

**Query Parameters:**
```
page=1
limit=10
status=VERIFIED             # Filter: ACTIVE, INACTIVE, PENDING_VERIFICATION
sort=-created_at
```

---

## 🚀 Implementation Path

### Phase 1: Setup (1-2 jam)
- ✅ Buat `src/utils/pagination.js`
- ✅ Update `src/controllers/adminController.js`
- Create reusable Pagination component frontend

### Phase 2: Controllers (4-6 jam)
- Update `src/controllers/campaignController.js`
- Update `src/controllers/submissionController.js`
- Update `src/controllers/financeController.js`
- Update `src/controllers/walletController.js`
- Update `src/controllers/creatorController.js`

### Phase 3: Frontend Pages (8-10 jam)
- Update Admin pages (3 pages)
- Update Campaign pages (3 pages)
- Update Creator pages (1 page)
- Update Finance pages (1 page)
- Update Wallet pages (2 pages)

### Phase 4: Testing & Deployment (2-4 jam)
- Integration testing
- Performance testing
- Deploy to production

**Total Estimated Time: 15-22 jam**

---

## 📈 Performance Considerations

1. **Database Indexes Required:**
   ```sql
   CREATE INDEX idx_users_status ON users(status);
   CREATE INDEX idx_users_role ON users(role);
   CREATE INDEX idx_campaigns_status ON campaigns(status);
   CREATE INDEX idx_submissions_created_at ON submissions(created_at);
   CREATE INDEX idx_wallets_balance ON wallets(balance);
   -- etc
   ```

2. **Query Optimization:**
   - Max limit 100 items per page
   - Use pagination for large datasets
   - Cache frequently accessed data

3. **API Rate Limiting:**
   - Consider rate limiting untuk list endpoints
   - Especially untuk endpoints yang bisa di-abuse (search, filter)

---

## ✅ Testing Checklist

### Basic Tests:
- [ ] Test without params (default pagination)
- [ ] Test with page & limit
- [ ] Test with search
- [ ] Test with filters
- [ ] Test with sort
- [ ] Test with combinations

### Edge Cases:
- [ ] Test page 0 (should return page 1)
- [ ] Test negative limit (should use default)
- [ ] Test limit > 100 (should cap at 100)
- [ ] Test invalid sort field (should use default)
- [ ] Test search with special characters
- [ ] Test with non-existent filter values

### Performance Tests:
- [ ] Test with 1M+ records
- [ ] Test concurrent requests
- [ ] Test response time
- [ ] Monitor database query time

---

## 📚 Documentation

See also:
- `PAGINATION_FILTER_ANALYSIS.md` - Detailed endpoint analysis
- `CHANGES_DETAILED.md` - Implementation details & code examples
- `FILES_CHANGED_LIST.md` - Complete file changes list

---

**Status: READY FOR IMPLEMENTATION**

All helper functions created. Backend controllers 1/7 complete. Frontend work pending.

**Next steps:** Start copying files to local computer and implementing changes.

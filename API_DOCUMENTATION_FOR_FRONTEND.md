# API Documentation - Pagination, Filter & Search Implementation
## Complete Guide for Frontend Development

**Last Updated:** 2024-04-30  
**Status:** Ready for Frontend Implementation  
**Total Endpoints:** 19  
**Base URL:** `http://localhost:5000/api/v1` (development)

---

## Table of Contents

1. [Overview](#overview)
2. [Standard Response Format](#standard-response-format)
3. [Standard Query Parameters](#standard-query-parameters)
4. [Endpoints Reference](#endpoints-reference)
   - [Admin Endpoints](#admin-endpoints)
   - [Campaign Endpoints](#campaign-endpoints)
   - [Submission Endpoints](#submission-endpoints)
   - [Finance Endpoints](#finance-endpoints)
   - [Wallet Endpoints](#wallet-endpoints)
   - [Creator Endpoints](#creator-endpoints)
5. [Implementation Examples](#implementation-examples)
6. [Frontend Component Template](#frontend-component-template)
7. [Testing Guide](#testing-guide)
8. [Error Handling](#error-handling)

---

## Overview

All list endpoints now support:
- **Pagination** - Navigate through large datasets
- **Filtering** - Filter by specific criteria
- **Search** - Full-text search across fields
- **Sorting** - Sort in ascending/descending order
- **Range Filtering** - Filter by min/max values

This documentation provides complete specifications for all 19 updated endpoints.

---

## Standard Response Format

All list endpoints return a consistent response format:

```json
{
  "status": "success",
  "data": [
    {
      "id": "123",
      "name": "Item Name",
      "created_at": "2024-04-30T10:30:00Z",
      "other_fields": "..."
    }
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

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Always "success" on successful request |
| `data` | array | Array of items for current page |
| `pagination` | object | Pagination metadata |
| `pagination.current_page` | number | Current page number |
| `pagination.per_page` | number | Items per page (limit) |
| `pagination.total_items` | number | Total number of items |
| `pagination.total_pages` | number | Total number of pages |
| `pagination.has_next` | boolean | Whether next page exists |
| `pagination.has_prev` | boolean | Whether previous page exists |

---

## Standard Query Parameters

### Pagination Parameters

```
GET /endpoint?page=1&limit=10
```

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | number | 1 | - | Page number (1-based) |
| `limit` | number | 10 | 100 | Items per page |

**Example:**
```
/endpoint?page=2&limit=20  // Get page 2 with 20 items per page
```

### Search Parameters

```
GET /endpoint?search=keyword
```

Each endpoint has specific fields it searches. See endpoint documentation for details.

**Example:**
```
/admin/users?search=john          // Search in email and username
/campaigns/explore?search=promo    // Search in campaign name
```

### Filter Parameters

Different endpoints support different filters:

```
GET /endpoint?status=ACTIVE&platform=INSTAGRAM
```

**Common filters:**
- `status` - Status of the item
- `platform` - Social media platform (INSTAGRAM, TIKTOK, YOUTUBE)
- `role` - User role (ADMIN, BRAND, CREATOR, FINANCE)
- `kyc_status` - KYC verification status

See endpoint documentation for supported filters.

### Range Filter Parameters

```
GET /endpoint?field_min=100&field_max=1000
```

For numeric and date fields:
- `{field}_min` - Minimum value (inclusive)
- `{field}_max` - Maximum value (inclusive)
- `{field}_start` - Start date for date ranges
- `{field}_end` - End date for date ranges

**Example:**
```
/campaigns/explore?budget_min=1000&budget_max=50000
/submissions?earning_min=100000&earning_max=1000000
```

### Sort Parameters

```
GET /endpoint?sort=field        // Ascending
GET /endpoint?sort=-field       // Descending
```

| Parameter | Format | Description |
|-----------|--------|-------------|
| `sort` | string | Field name = ascending, -field = descending |

**Example:**
```
/admin/users?sort=created_at          // Sort by created_at ascending
/admin/users?sort=-created_at         // Sort by created_at descending
/submissions?sort=-net_earning        // Sort by earning descending
```

### Combined Example

```
GET /campaigns/explore?page=1&limit=20&search=promo&platform=INSTAGRAM&budget_min=1000&budget_max=50000&sort=-created_at
```

---

## Endpoints Reference

### ADMIN ENDPOINTS

#### 1. Get All Users

**Endpoint:** `GET /admin/users`

**Description:** Retrieve all users with pagination, search, filtering, and sorting.

**Query Parameters:**

| Parameter | Type | Required | Values | Description |
|-----------|------|----------|--------|-------------|
| `page` | number | No | 1-∞ | Page number (default: 1) |
| `limit` | number | No | 1-100 | Items per page (default: 10) |
| `search` | string | No | - | Search in: email, username |
| `status` | string | No | ACTIVE, INACTIVE, SUSPENDED | Filter by status |
| `role` | string | No | ADMIN, BRAND, CREATOR, FINANCE | Filter by role |
| `sort` | string | No | created_at, -created_at, email, -email | Sort field |

**Request Examples:**

```bash
# Basic pagination
curl "http://localhost:5000/api/v1/admin/users?page=1&limit=10"

# With search
curl "http://localhost:5000/api/v1/admin/users?page=1&limit=10&search=john"

# With filters
curl "http://localhost:5000/api/v1/admin/users?status=ACTIVE&role=CREATOR"

# Combined
curl "http://localhost:5000/api/v1/admin/users?page=1&limit=20&search=john&status=ACTIVE&sort=-created_at"
```

**Response Example:**

```json
{
  "status": "success",
  "data": [
    {
      "id": "user-123",
      "email": "john@example.com",
      "username": "johndoe",
      "role": "CREATOR",
      "status": "ACTIVE",
      "created_at": "2024-01-15T10:30:00Z",
      "creators": [
        {
          "id": "creator-123",
          "display_name": "John Creator",
          "kyc_status": "VERIFIED"
        }
      ],
      "brands": [
        {
          "id": "brand-123",
          "name": "My Brand"
        }
      ]
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 10,
    "total_items": 245,
    "total_pages": 25,
    "has_next": true,
    "has_prev": false
  }
}
```

---

### CAMPAIGN ENDPOINTS

#### 2. Explore Campaigns

**Endpoint:** `GET /campaigns/explore`

**Description:** Browse available campaigns with advanced filtering and search.

**Query Parameters:**

| Parameter | Type | Required | Values | Description |
|-----------|------|----------|--------|-------------|
| `page` | number | No | 1-∞ | Page number (default: 1) |
| `limit` | number | No | 1-100 | Items per page (default: 10) |
| `search` | string | No | - | Search in: campaign name |
| `platform` | string | No | INSTAGRAM, TIKTOK, YOUTUBE | Filter by platform |
| `status` | string | No | AKTIF, DRAFT, SELESAI | Filter by status |
| `budget_min` | number | No | - | Minimum budget |
| `budget_max` | number | No | - | Maximum budget |
| `sort` | string | No | created_at, -created_at, budget_total, -budget_total | Sort field |

**Request Examples:**

```bash
# Browse all active campaigns
curl "http://localhost:5000/api/v1/campaigns/explore?status=AKTIF"

# Instagram campaigns with budget range
curl "http://localhost:5000/api/v1/campaigns/explore?platform=INSTAGRAM&budget_min=5000&budget_max=100000"

# Search and filter
curl "http://localhost:5000/api/v1/campaigns/explore?search=promo&platform=TIKTOK&page=1&limit=20"

# Sorted by budget descending
curl "http://localhost:5000/api/v1/campaigns/explore?sort=-budget_total&page=1"
```

**Response Example:**

```json
{
  "status": "success",
  "data": [
    {
      "campaign_id": "camp-123",
      "nama_campaign": "Summer Promo Campaign",
      "platform": "INSTAGRAM",
      "status": "AKTIF",
      "budget_total": 25000,
      "komisi_per_view": 100,
      "tanggal_berakhir": "2024-05-30T23:59:59Z",
      "created_at": "2024-04-01T08:00:00Z",
      "brands": {
        "nama_perusahaan": "ABC Brand"
      },
      "brand_name": "ABC Brand",
      "is_joined": false
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 10,
    "total_items": 47,
    "total_pages": 5,
    "has_next": true,
    "has_prev": false
  }
}
```

---

#### 3. Get My Campaigns

**Endpoint:** `GET /campaigns/my-campaigns`

**Description:** Get campaigns that the creator has joined.

**Query Parameters:**

| Parameter | Type | Required | Values | Description |
|-----------|------|----------|--------|-------------|
| `page` | number | No | 1-∞ | Page number (default: 1) |
| `limit` | number | No | 1-100 | Items per page (default: 10) |
| `search` | string | No | - | Search in: campaign name, platform, brand name |
| `platform` | string | No | INSTAGRAM, TIKTOK, YOUTUBE | Filter by platform |
| `status` | string | No | AKTIF, DRAFT, SELESAI | Filter by status |
| `sort` | string | No | joined_at, -joined_at, total_earning, -total_earning | Sort field |

**Request Examples:**

```bash
# Get all my campaigns
curl "http://localhost:5000/api/v1/campaigns/my-campaigns?page=1"

# Only active campaigns
curl "http://localhost:5000/api/v1/campaigns/my-campaigns?status=AKTIF"

# Search my campaigns
curl "http://localhost:5000/api/v1/campaigns/my-campaigns?search=promo&platform=TIKTOK"

# Sorted by earning
curl "http://localhost:5000/api/v1/campaigns/my-campaigns?sort=-total_earning&page=1"
```

**Response Example:**

```json
{
  "status": "success",
  "data": [
    {
      "campaign_id": "camp-123",
      "nama_campaign": "Summer Promo Campaign",
      "platform": "INSTAGRAM",
      "status": "AKTIF",
      "komisi_per_view": 100,
      "tanggal_berakhir": "2024-05-30T23:59:59Z",
      "min_konten_diterima": 5,
      "brand_name": "ABC Brand",
      "joined_at": "2024-04-15T10:30:00Z",
      "submission_count": 3,
      "total_views": 15000,
      "total_earning": 1500
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 10,
    "total_items": 8,
    "total_pages": 1,
    "has_next": false,
    "has_prev": false
  }
}
```

---

#### 4. Get Campaign Participants

**Endpoint:** `GET /campaigns/:campaign_id/participants`

**Description:** Get list of participants in a specific campaign (Brand view).

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `campaign_id` | string | Yes | Campaign ID |

**Query Parameters:**

| Parameter | Type | Required | Values | Description |
|-----------|------|----------|--------|-------------|
| `page` | number | No | 1-∞ | Page number (default: 1) |
| `limit` | number | No | 1-100 | Items per page (default: 10) |
| `search` | string | No | - | Search in: creator name, email |
| `kyc_status` | string | No | PENDING, VERIFIED, REJECTED | Filter by KYC status |
| `submission_count_min` | number | No | - | Minimum submission count |
| `submission_count_max` | number | No | - | Maximum submission count |
| `sort` | string | No | joined_at, -joined_at, submission_count, -submission_count | Sort field |

**Request Examples:**

```bash
# Get all participants
curl "http://localhost:5000/api/v1/campaigns/camp-123/participants?page=1"

# Only verified creators
curl "http://localhost:5000/api/v1/campaigns/camp-123/participants?kyc_status=VERIFIED"

# Search participants
curl "http://localhost:5000/api/v1/campaigns/camp-123/participants?search=john"

# Creators with 5+ submissions
curl "http://localhost:5000/api/v1/campaigns/camp-123/participants?submission_count_min=5"
```

**Response Example:**

```json
{
  "status": "success",
  "data": {
    "campaign_id": "camp-123",
    "campaign_name": "Summer Promo Campaign",
    "total_participants": 45,
    "participants": [
      {
        "participant_id": "part-123",
        "joined_at": "2024-04-15T10:30:00Z",
        "creator_id": "creator-123",
        "nama_lengkap": "John Creator",
        "email": "john@example.com",
        "kyc_status": "VERIFIED",
        "submission_count": 5,
        "total_views": 25000,
        "total_earning": 2500,
        "latest_submission_status": "APPROVED"
      }
    ]
  },
  "pagination": {
    "current_page": 1,
    "per_page": 10,
    "total_items": 45,
    "total_pages": 5,
    "has_next": true,
    "has_prev": false
  }
}
```

---

### SUBMISSION ENDPOINTS

#### 5. Get All Submissions

**Endpoint:** `GET /submissions`

**Description:** Get all creator submissions with pagination and filtering.

**Query Parameters:**

| Parameter | Type | Required | Values | Description |
|-----------|------|----------|--------|-------------|
| `page` | number | No | 1-∞ | Page number (default: 1) |
| `limit` | number | No | 1-100 | Items per page (default: 10) |
| `search` | string | No | - | Search in: campaign name, content URL |
| `status` | string | No | PENDING, APPROVED, REJECTED | Filter by status |
| `platform` | string | No | INSTAGRAM, TIKTOK, YOUTUBE | Filter by platform |
| `earning_min` | number | No | - | Minimum earning |
| `earning_max` | number | No | - | Maximum earning |
| `sort` | string | No | submitted_at, -submitted_at, net_earning, -net_earning, views_tervalidasi, -views_tervalidasi | Sort field |

**Request Examples:**

```bash
# Get all submissions
curl "http://localhost:5000/api/v1/submissions?page=1"

# Only approved submissions
curl "http://localhost:5000/api/v1/submissions?status=APPROVED"

# High earning submissions
curl "http://localhost:5000/api/v1/submissions?earning_min=500000&sort=-net_earning"

# Recent submissions
curl "http://localhost:5000/api/v1/submissions?sort=-submitted_at&page=1"
```

**Response Example:**

```json
{
  "status": "success",
  "data": [
    {
      "submission_id": "sub-123",
      "campaign_id": "camp-123",
      "nama_campaign": "Summer Promo Campaign",
      "platform": "INSTAGRAM",
      "komisi_per_view": 100,
      "content_url": "https://instagram.com/p/abc123",
      "status": "APPROVED",
      "submitted_at": "2024-04-20T15:30:00Z",
      "views": 10000,
      "estimasi_komisi": 500,
      "net_earning": 400,
      "alasan_penolakan": null
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 10,
    "total_items": 67,
    "total_pages": 7,
    "has_next": true,
    "has_prev": false
  }
}
```

---

#### 6. Get Submissions by Campaign

**Endpoint:** `GET /submissions/by-campaign/:campaign_id`

**Description:** Get creator's submissions for a specific campaign.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `campaign_id` | string | Yes | Campaign ID |

**Query Parameters:**

| Parameter | Type | Required | Values | Description |
|-----------|------|----------|--------|-------------|
| `page` | number | No | 1-∞ | Page number (default: 1) |
| `limit` | number | No | 1-100 | Items per page (default: 10) |
| `status` | string | No | PENDING, APPROVED, REJECTED | Filter by status |
| `views_min` | number | No | - | Minimum views |
| `views_max` | number | No | - | Maximum views |
| `sort` | string | No | submitted_at, -submitted_at, views_tervalidasi, -views_tervalidasi, net_earning, -net_earning | Sort field |

**Request Examples:**

```bash
# Get all submissions for a campaign
curl "http://localhost:5000/api/v1/submissions/by-campaign/camp-123?page=1"

# Only approved submissions
curl "http://localhost:5000/api/v1/submissions/by-campaign/camp-123?status=APPROVED"

# High view submissions
curl "http://localhost:5000/api/v1/submissions/by-campaign/camp-123?views_min=5000&sort=-views_tervalidasi"
```

**Response Example:**

```json
{
  "status": "success",
  "data": {
    "campaign_info": {
      "campaign_id": "camp-123",
      "nama_campaign": "Summer Promo Campaign",
      "platform": "INSTAGRAM",
      "komisi_per_view": 100,
      "status": "AKTIF",
      "tanggal_berakhir": "2024-05-30T23:59:59Z",
      "min_konten_diterima": 5,
      "asset_urls": "https://example.com/assets",
      "min_watch_duration": 3,
      "max_submission_per_creator": 10,
      "budget_tersisa": 12500
    },
    "submissions": [
      {
        "submission_id": "sub-123",
        "content_url": "https://instagram.com/p/abc123",
        "status": "APPROVED",
        "submitted_at": "2024-04-20T15:30:00Z",
        "views": 8000,
        "estimasi_komisi": 400,
        "gross_earning": 400,
        "net_earning": 320,
        "alasan_penolakan": null
      }
    ]
  },
  "pagination": {
    "current_page": 1,
    "per_page": 10,
    "total_items": 7,
    "total_pages": 1,
    "has_next": false,
    "has_prev": false
  }
}
```

---

### FINANCE ENDPOINTS

#### 7. Get Large Pending Withdrawals

**Endpoint:** `GET /finance/withdrawals/pending`

**Description:** Get pending withdrawals over 10 million (Admin view).

**Query Parameters:**

| Parameter | Type | Required | Values | Description |
|-----------|------|----------|--------|-------------|
| `page` | number | No | 1-∞ | Page number (default: 1) |
| `limit` | number | No | 1-100 | Items per page (default: 10) |
| `search` | string | No | - | Search in: creator name, bank account |
| `amount_min` | number | No | - | Minimum amount |
| `amount_max` | number | No | - | Maximum amount |
| `sort` | string | No | created_at, -created_at, amount, -amount | Sort field |

**Request Examples:**

```bash
# Get pending withdrawals
curl "http://localhost:5000/api/v1/finance/withdrawals/pending?page=1"

# Search by creator
curl "http://localhost:5000/api/v1/finance/withdrawals/pending?search=john"

# Large withdrawals
curl "http://localhost:5000/api/v1/finance/withdrawals/pending?amount_min=50000000&sort=-amount"
```

**Response Example:**

```json
{
  "status": "success",
  "data": [
    {
      "withdrawal_id": "wd-123",
      "amount": 25000000,
      "status": "QUEUED",
      "created_at": "2024-04-25T10:00:00Z",
      "creators": {
        "id": "creator-123",
        "nama_lengkap": "John Creator"
      },
      "bank_accounts": {
        "account_name": "John Doe",
        "account_number": "1234567890",
        "bank_code": "BCA"
      }
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 10,
    "total_items": 12,
    "total_pages": 2,
    "has_next": true,
    "has_prev": false
  }
}
```

---

#### 8. Get Failed Withdrawals

**Endpoint:** `GET /finance/withdrawals/failed`

**Description:** Get failed withdrawals (Admin view).

**Query Parameters:**

| Parameter | Type | Required | Values | Description |
|-----------|------|----------|--------|-------------|
| `page` | number | No | 1-∞ | Page number (default: 1) |
| `limit` | number | No | 1-100 | Items per page (default: 10) |
| `search` | string | No | - | Search in: creator name, failure reason |
| `amount_min` | number | No | - | Minimum amount |
| `amount_max` | number | No | - | Maximum amount |
| `sort` | string | No | created_at, -created_at, amount, -amount | Sort field |

**Request Examples:**

```bash
# Get failed withdrawals
curl "http://localhost:5000/api/v1/finance/withdrawals/failed?page=1"

# Search by error type
curl "http://localhost:5000/api/v1/finance/withdrawals/failed?search=invalid"

# Sort by amount
curl "http://localhost:5000/api/v1/finance/withdrawals/failed?sort=-amount"
```

---

### WALLET ENDPOINTS

#### 9. Get Wallet Transactions

**Endpoint:** `GET /wallet/transactions`

**Description:** Get wallet transaction history.

**Query Parameters:**

| Parameter | Type | Required | Values | Description |
|-----------|------|----------|--------|-------------|
| `page` | number | No | 1-∞ | Page number (default: 1) |
| `limit` | number | No | 1-100 | Items per page (default: 10) |
| `type` | string | No | CREDIT, DEBIT | Filter by transaction type |
| `amount_min` | number | No | - | Minimum amount |
| `amount_max` | number | No | - | Maximum amount |
| `sort` | string | No | created_at, -created_at, amount, -amount | Sort field |

**Request Examples:**

```bash
# Get all transactions
curl "http://localhost:5000/api/v1/wallet/transactions?page=1"

# Only credits
curl "http://localhost:5000/api/v1/wallet/transactions?type=CREDIT"

# Recent transactions
curl "http://localhost:5000/api/v1/wallet/transactions?sort=-created_at&page=1"

# Large transactions
curl "http://localhost:5000/api/v1/wallet/transactions?amount_min=1000000&sort=-amount"
```

**Response Example:**

```json
{
  "status": "success",
  "data": [
    {
      "id": "txn-123",
      "wallet_id": "wallet-123",
      "type": "CREDIT",
      "amount": 500000,
      "description": "Earning from submission",
      "reference_id": "sub-123",
      "created_at": "2024-04-25T10:30:00Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 10,
    "total_items": 156,
    "total_pages": 16,
    "has_next": true,
    "has_prev": false
  }
}
```

---

#### 10. Get Earning Details

**Endpoint:** `GET /wallet/earnings`

**Description:** Get earnings breakdown by submission/campaign.

**Query Parameters:**

| Parameter | Type | Required | Values | Description |
|-----------|------|----------|--------|-------------|
| `page` | number | No | 1-∞ | Page number (default: 1) |
| `limit` | number | No | 1-100 | Items per page (default: 10) |
| `platform` | string | No | INSTAGRAM, TIKTOK, YOUTUBE | Filter by platform |
| `payment_status` | string | No | DIBAYAR, MENUNGGU_PEMBAYARAN, DITOLAK, BELUM_SELESAI | Filter by payment status |
| `earning_min` | number | No | - | Minimum earning |
| `earning_max` | number | No | - | Maximum earning |
| `sort` | string | No | submitted_at, -submitted_at, net_earning, -net_earning, views, -views | Sort field |

**Request Examples:**

```bash
# Get all earnings
curl "http://localhost:5000/api/v1/wallet/earnings?page=1"

# Only paid earnings
curl "http://localhost:5000/api/v1/wallet/earnings?payment_status=DIBAYAR"

# Instagram earnings
curl "http://localhost:5000/api/v1/wallet/earnings?platform=INSTAGRAM"

# Recent high earnings
curl "http://localhost:5000/api/v1/wallet/earnings?earning_min=500000&sort=-net_earning"
```

**Response Example:**

```json
{
  "status": "success",
  "data": {
    "summary": {
      "total_earned": 5000000,
      "total_pending": 2000000
    },
    "per_campaign": [
      {
        "campaign_id": "camp-123",
        "nama_campaign": "Summer Promo Campaign",
        "platform": "INSTAGRAM",
        "submission_count": 3,
        "total_views": 25000,
        "total_earning": 2500000
      }
    ],
    "earnings": [
      {
        "submission_id": "sub-123",
        "campaign_id": "camp-123",
        "nama_campaign": "Summer Promo Campaign",
        "platform": "INSTAGRAM",
        "content_url": "https://instagram.com/p/abc123",
        "status": "SELESAI",
        "submitted_at": "2024-04-20T15:30:00Z",
        "views": 10000,
        "estimasi_komisi": 500,
        "gross_earning": 500,
        "platform_fee": 100,
        "net_earning": 400,
        "payment_status": "DIBAYAR"
      }
    ]
  },
  "pagination": {
    "current_page": 1,
    "per_page": 10,
    "total_items": 78,
    "total_pages": 8,
    "has_next": true,
    "has_prev": false
  }
}
```

---

### CREATOR ENDPOINTS

#### 11. Get Bank Accounts

**Endpoint:** `GET /creators/bank-accounts`

**Description:** Get creator's bank accounts.

**Query Parameters:**

| Parameter | Type | Required | Values | Description |
|-----------|------|----------|--------|-------------|
| `page` | number | No | 1-∞ | Page number (default: 1) |
| `limit` | number | No | 1-100 | Items per page (default: 10) |
| `is_primary` | boolean | No | true, false | Filter primary account |
| `bank_code` | string | No | - | Filter by bank code (BCA, BRI, etc) |
| `sort` | string | No | created_at, -created_at, is_primary, -is_primary | Sort field |

**Request Examples:**

```bash
# Get all bank accounts
curl "http://localhost:5000/api/v1/creators/bank-accounts?page=1"

# Only primary account
curl "http://localhost:5000/api/v1/creators/bank-accounts?is_primary=true"

# BCA accounts
curl "http://localhost:5000/api/v1/creators/bank-accounts?bank_code=BCA"
```

**Response Example:**

```json
{
  "status": "success",
  "data": [
    {
      "id": "ba-123",
      "account_name": "John Doe",
      "account_number": "1234567890",
      "bank_code": "BCA",
      "bank_name": "Bank Central Asia",
      "is_primary": true,
      "created_at": "2024-01-10T08:00:00Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 10,
    "total_items": 2,
    "total_pages": 1,
    "has_next": false,
    "has_prev": false
  }
}
```

---

## Implementation Examples

### Using Fetch API

```javascript
// Basic pagination
async function fetchUsers(page = 1, limit = 10) {
  const response = await fetch(
    `/api/v1/admin/users?page=${page}&limit=${limit}`
  );
  return response.json();
}

// With filters and search
async function fetchCampaigns(filters = {}) {
  const params = new URLSearchParams();
  
  params.append('page', filters.page || 1);
  params.append('limit', filters.limit || 10);
  
  if (filters.search) params.append('search', filters.search);
  if (filters.platform) params.append('platform', filters.platform);
  if (filters.budget_min) params.append('budget_min', filters.budget_min);
  if (filters.budget_max) params.append('budget_max', filters.budget_max);
  if (filters.sort) params.append('sort', filters.sort);
  
  const response = await fetch(`/api/v1/campaigns/explore?${params}`);
  return response.json();
}

// Usage
const campaigns = await fetchCampaigns({
  page: 1,
  limit: 20,
  search: 'promo',
  platform: 'INSTAGRAM',
  budget_min: 5000,
  budget_max: 50000,
  sort: '-created_at'
});

console.log(campaigns.data);          // Items array
console.log(campaigns.pagination);    // Pagination metadata
```

### Using Axios

```javascript
import axios from 'axios';

const API_URL = 'http://localhost:5000/api/v1';

// Create helper function
function buildQuery(params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      query.append(key, value);
    }
  });
  return query.toString();
}

// Fetch with filters
async function fetchData(endpoint, filters = {}) {
  try {
    const queryString = buildQuery({
      page: filters.page || 1,
      limit: filters.limit || 10,
      search: filters.search,
      ...Object.entries(filters)
        .filter(([key]) => !['page', 'limit', 'search'].includes(key))
        .reduce((obj, [key, value]) => {
          obj[key] = value;
          return obj;
        }, {})
    });
    
    const response = await axios.get(
      `${API_URL}${endpoint}?${queryString}`
    );
    return response.data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Usage
const result = await fetchData('/admin/users', {
  page: 2,
  limit: 20,
  search: 'john',
  status: 'ACTIVE',
  role: 'CREATOR',
  sort: '-created_at'
});

console.log(result.data);
console.log(result.pagination);
```

### Using React Query (Recommended)

```javascript
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api/v1';

// Create custom hook
function useListData(endpoint, filters = {}) {
  const queryKey = [endpoint, filters];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          params.append(key, value);
        }
      });
      
      const response = await axios.get(
        `${API_URL}${endpoint}?${params}`
      );
      return response.data;
    },
    enabled: !!endpoint
  });
}

// Usage in component
function UsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  
  const { data, isLoading, error } = useListData('/admin/users', {
    page,
    limit: 10,
    search,
    ...filters
  });
  
  return (
    <div>
      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        placeholder="Search users..."
      />
      
      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error.message}</p>}
      
      <table>
        <tbody>
          {data?.data.map(user => (
            <tr key={user.id}>
              <td>{user.email}</td>
              <td>{user.role}</td>
              <td>{user.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <Pagination
        current={data?.pagination.current_page || 1}
        total={data?.pagination.total_pages || 1}
        onPageChange={setPage}
      />
    </div>
  );
}
```

---

## Frontend Component Template

### Pagination Component

```javascript
// components/Pagination.jsx
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  loading = false
}) {
  const pages = [];
  const maxVisible = 5;
  
  // Calculate page range
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1);
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  
  return (
    <div className="pagination">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || loading}
        className="pagination-btn"
      >
        ← Previous
      </button>
      
      {start > 1 && (
        <>
          <button
            onClick={() => onPageChange(1)}
            className="pagination-btn"
          >
            1
          </button>
          {start > 2 && <span>...</span>}
        </>
      )}
      
      {pages.map(page => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`pagination-btn ${
            page === currentPage ? 'active' : ''
          }`}
          disabled={loading}
        >
          {page}
        </button>
      ))}
      
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span>...</span>}
          <button
            onClick={() => onPageChange(totalPages)}
            className="pagination-btn"
          >
            {totalPages}
          </button>
        </>
      )}
      
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages || loading}
        className="pagination-btn"
      >
        Next →
      </button>
    </div>
  );
}
```

### Filter Controls Component

```javascript
// components/FilterControls.jsx
export function FilterControls({
  onFiltersChange,
  filters = {},
  loading = false
}) {
  const handleChange = (key, value) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
      page: 1 // Reset to first page when filtering
    });
  };
  
  return (
    <div className="filter-controls">
      <input
        type="text"
        placeholder="Search..."
        value={filters.search || ''}
        onChange={(e) => handleChange('search', e.target.value)}
        disabled={loading}
        className="filter-input"
      />
      
      <select
        value={filters.status || ''}
        onChange={(e) => handleChange('status', e.target.value)}
        disabled={loading}
        className="filter-select"
      >
        <option value="">All Status</option>
        <option value="ACTIVE">Active</option>
        <option value="INACTIVE">Inactive</option>
        <option value="SUSPENDED">Suspended</option>
      </select>
      
      <select
        value={filters.role || ''}
        onChange={(e) => handleChange('role', e.target.value)}
        disabled={loading}
        className="filter-select"
      >
        <option value="">All Roles</option>
        <option value="ADMIN">Admin</option>
        <option value="BRAND">Brand</option>
        <option value="CREATOR">Creator</option>
      </select>
      
      <select
        value={filters.sort || '-created_at'}
        onChange={(e) => handleChange('sort', e.target.value)}
        disabled={loading}
        className="filter-select"
      >
        <option value="-created_at">Newest First</option>
        <option value="created_at">Oldest First</option>
        <option value="email">Email A-Z</option>
        <option value="-email">Email Z-A</option>
      </select>
    </div>
  );
}
```

### Complete Page Example

```javascript
// pages/Users.jsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pagination } from '../components/Pagination';
import { FilterControls } from '../components/FilterControls';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api/v1';

export function UsersPage() {
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    search: '',
    status: '',
    role: '',
    sort: '-created_at'
  });
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['users', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== null) {
          params.append(key, value);
        }
      });
      
      const response = await axios.get(
        `${API_URL}/admin/users?${params}`
      );
      return response.data;
    }
  });
  
  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
  };
  
  return (
    <div className="page">
      <h1>Users Management</h1>
      
      <FilterControls
        filters={filters}
        onFiltersChange={handleFiltersChange}
        loading={isLoading}
      />
      
      {error && (
        <div className="error-message">
          Error loading users: {error.message}
        </div>
      )}
      
      {isLoading && <div className="loading">Loading...</div>}
      
      {data && (
        <>
          <table className="users-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map(user => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.status}</td>
                  <td>
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="pagination-wrapper">
            <p>
              Showing {(filters.page - 1) * filters.limit + 1} to{' '}
              {Math.min(filters.page * filters.limit, data.pagination.total_items)}{' '}
              of {data.pagination.total_items} users
            </p>
            
            <Pagination
              currentPage={data.pagination.current_page}
              totalPages={data.pagination.total_pages}
              onPageChange={(page) =>
                handleFiltersChange({ ...filters, page })
              }
              loading={isLoading}
            />
          </div>
        </>
      )}
    </div>
  );
}
```

---

## Testing Guide

### Using cURL

```bash
# Test 1: Basic pagination
curl "http://localhost:5000/api/v1/admin/users?page=1&limit=10"

# Test 2: With search
curl "http://localhost:5000/api/v1/admin/users?page=1&limit=10&search=john"

# Test 3: With filters
curl "http://localhost:5000/api/v1/admin/users?status=ACTIVE&role=CREATOR"

# Test 4: With sorting
curl "http://localhost:5000/api/v1/admin/users?sort=-created_at&page=1"

# Test 5: Combined
curl "http://localhost:5000/api/v1/admin/users?page=2&limit=20&search=admin&status=ACTIVE&sort=email"
```

### Using Postman

1. Create new collection "Promme API"
2. Add requests for each endpoint
3. Use environment variables for base URL
4. Test with different parameter combinations
5. Save responses as examples

**Example Postman request:**
```
Method: GET
URL: {{base_url}}/admin/users
Params:
  - page: 1
  - limit: 10
  - search: john
  - status: ACTIVE
  - sort: -created_at
```

### Test Checklist

- [ ] Test page=1 with various limits
- [ ] Test search functionality
- [ ] Test filters individually
- [ ] Test multiple filters combined
- [ ] Test sorting (ascending and descending)
- [ ] Test range filters (min/max)
- [ ] Test last page
- [ ] Test invalid page number (should return empty data)
- [ ] Test limit > max (should cap at 100)
- [ ] Test special characters in search

---

## Error Handling

### Common Error Responses

**Bad Request (400)**
```json
{
  "status": "error",
  "message": "Invalid filter value"
}
```

**Not Found (404)**
```json
{
  "status": "error",
  "message": "Resource not found"
}
```

**Unauthorized (401)**
```json
{
  "status": "error",
  "message": "Unauthorized access"
}
```

**Server Error (500)**
```json
{
  "status": "error",
  "message": "Internal server error"
}
```

### Frontend Error Handling

```javascript
async function fetchData(endpoint, filters) {
  try {
    const response = await fetch(`/api/v1${endpoint}?${params}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Request failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    // Handle error gracefully in UI
    showErrorMessage(error.message);
  }
}
```

---

## Summary

This documentation covers:
- ✅ 19 endpoints with full specifications
- ✅ Standard query parameters for pagination, search, filter, sort
- ✅ Response format with pagination metadata
- ✅ Detailed examples for each endpoint
- ✅ Frontend implementation examples (Fetch, Axios, React Query)
- ✅ Reusable component templates
- ✅ Testing guide
- ✅ Error handling

All endpoints are ready for frontend implementation!

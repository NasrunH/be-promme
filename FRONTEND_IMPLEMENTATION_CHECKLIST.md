# Frontend Implementation Checklist
## Pagination, Filter & Search Features

**Target:** Implement pagination, filtering, and search across all list pages  
**Status:** Backend Complete ✅ - Ready for Frontend  
**Timeline:** 2-3 days for experienced team

---

## Phase 1: Setup & Core Components (4-6 hours)

### 1.1 Environment Setup
- [ ] Review API_DOCUMENTATION_FOR_FRONTEND.md (30 min)
- [ ] Verify backend is running (Test with curl)
- [ ] Check API response format with actual data
- [ ] Set up API client/axios configuration

### 1.2 Create Reusable Components
- [ ] Create `components/Pagination.jsx` (1-2 hours)
  - [ ] Props: currentPage, totalPages, onPageChange, loading
  - [ ] Styles for active page, disabled state
  - [ ] Handle edge cases (first page, last page)
  - [ ] Test with different page counts
  
- [ ] Create `components/FilterControls.jsx` (1-2 hours) - Optional but recommended
  - [ ] Input for search
  - [ ] Dropdowns for status, role, platform
  - [ ] Reset filters button
  - [ ] Responsive layout

- [ ] Create `hooks/useListData.ts` (1 hour)
  - [ ] Custom hook for fetching paginated data
  - [ ] Handle filters, search, pagination
  - [ ] Loading, error, success states
  - [ ] Automatic retry on error

### 1.3 Setup Utility Functions
- [ ] Create `utils/queryBuilder.ts` (30 min)
  - [ ] Function to build query params
  - [ ] Handle null/undefined values
  - [ ] Validate filter values

**Phase 1 Subtotal: 4-6 hours**

---

## Phase 2: Admin Pages (4-6 hours)

### 2.1 User Management Page
**File:** `pages/admin/UserManagement.jsx`

**Implementation:**
- [ ] Add state for filters (page, limit, search, status, role, sort)
- [ ] Import useListData hook
- [ ] Add FilterControls component with:
  - [ ] Search input
  - [ ] Status dropdown (ACTIVE, INACTIVE, SUSPENDED)
  - [ ] Role dropdown (ADMIN, BRAND, CREATOR, FINANCE)
  - [ ] Sort dropdown
  - [ ] Reset button
- [ ] Update table to show data from API
- [ ] Add Pagination component
- [ ] Show total count: "Showing X to Y of Z users"
- [ ] Add loading skeleton/spinner
- [ ] Add error handling with retry button
- [ ] Test with different filters
- [ ] Responsive design for mobile

**Time Estimate:** 2-3 hours

### 2.2 Audit Logs Page
**File:** `pages/admin/AuditLogs.jsx`

**Implementation:**
- [ ] Add pagination state
- [ ] Add date range filter (if applicable)
- [ ] Add action type filter
- [ ] Implement search functionality
- [ ] Sort by date/time
- [ ] Display audit trail with timestamp, user, action, IP
- [ ] Add Pagination component
- [ ] Test with large datasets
- [ ] Optimize for performance

**Time Estimate:** 1.5-2 hours

### 2.3 Fraud Detection Page
**File:** `pages/admin/FraudDetection.jsx`

**Implementation:**
- [ ] Add pagination
- [ ] Add filters for anomaly type
- [ ] Add severity level filter
- [ ] Search functionality
- [ ] Sort options
- [ ] Display anomalies in list/table
- [ ] Add action buttons (investigate, dismiss, block)
- [ ] Pagination component

**Time Estimate:** 1.5-2 hours

**Phase 2 Subtotal: 4-6 hours**

---

## Phase 3: Campaign Pages (6-8 hours)

### 3.1 Explore Campaigns Page
**File:** `pages/campaigns/ExploreCampaigns.jsx`

**Implementation:**
- [ ] Add FilterControls with:
  - [ ] Search by campaign name
  - [ ] Platform filter (INSTAGRAM, TIKTOK, YOUTUBE)
  - [ ] Status filter (AKTIF, DRAFT, SELESAI)
  - [ ] Budget range slider (min/max)
  - [ ] Sort dropdown
  - [ ] Clear filters button
- [ ] Display campaigns as cards or table
- [ ] Show: campaign name, platform, budget, brand, status, is_joined indicator
- [ ] Add "Join Campaign" button for non-joined campaigns
- [ ] Add Pagination
- [ ] Show results count
- [ ] Loading state while filtering
- [ ] Responsive grid layout

**Time Estimate:** 2-3 hours

### 3.2 My Campaigns Page
**File:** `pages/campaigns/MyCampaigns.jsx`

**Implementation:**
- [ ] Add FilterControls with:
  - [ ] Search (campaign name, platform, brand)
  - [ ] Platform filter
  - [ ] Status filter
  - [ ] Sort (joined_at, total_earning)
- [ ] Display campaigns table with:
  - [ ] Campaign name
  - [ ] Platform
  - [ ] Status
  - [ ] Submission count
  - [ ] Total views
  - [ ] Total earning
  - [ ] Joined date
- [ ] Add action buttons (View, Submit, View Earnings)
- [ ] Add Pagination
- [ ] Show earning summary at top
- [ ] Responsive design

**Time Estimate:** 2-2.5 hours

### 3.3 Campaign Participants Page
**File:** `pages/campaigns/CampaignParticipants.jsx`

**Implementation:**
- [ ] Add FilterControls with:
  - [ ] Search (creator name, email)
  - [ ] KYC status filter (PENDING, VERIFIED, REJECTED)
  - [ ] Submission count range
  - [ ] Sort options
- [ ] Display participants table with:
  - [ ] Creator name
  - [ ] Email
  - [ ] KYC status
  - [ ] Submission count
  - [ ] Total views
  - [ ] Total earning
  - [ ] Join date
- [ ] Add action buttons (Message, View Profile)
- [ ] Add Pagination
- [ ] Show total participants count
- [ ] Responsive design

**Time Estimate:** 2-2.5 hours

**Phase 3 Subtotal: 6-8 hours**

---

## Phase 4: Submission Pages (3-4 hours)

### 4.1 All Submissions Page
**File:** `pages/creator/Submissions.jsx`

**Implementation:**
- [ ] Add FilterControls with:
  - [ ] Search (campaign name, URL)
  - [ ] Status filter (PENDING, APPROVED, REJECTED)
  - [ ] Platform filter
  - [ ] Earning range (min/max)
  - [ ] Sort options
- [ ] Display submissions table with:
  - [ ] Campaign name
  - [ ] Platform
  - [ ] Content URL (clickable)
  - [ ] Status badge
  - [ ] Views
  - [ ] Earning
  - [ ] Submitted date
  - [ ] Rejection reason (if rejected)
- [ ] Add Pagination
- [ ] Show summary stats (total submissions, approved, pending, rejected)
- [ ] Add view/edit buttons
- [ ] Responsive design

**Time Estimate:** 2 hours

### 4.2 Campaign Submissions Page
**File:** `pages/campaigns/CampaignSubmissions.jsx`

**Implementation:**
- [ ] Add FilterControls with:
  - [ ] Status filter
  - [ ] View range
  - [ ] Sort options
- [ ] Display submissions for specific campaign
- [ ] Show campaign info header
- [ ] Pagination
- [ ] View details button
- [ ] Responsive design

**Time Estimate:** 1-1.5 hours

**Phase 4 Subtotal: 3-4 hours**

---

## Phase 5: Finance Pages (3-4 hours)

### 5.1 Withdrawals Management Page
**File:** `pages/admin/Withdrawals.jsx` or `pages/finance/Withdrawals.jsx`

**Implementation:**
- [ ] Add FilterControls with:
  - [ ] Search (creator name, bank account)
  - [ ] Status filter (if applicable)
  - [ ] Amount range
  - [ ] Sort options
- [ ] Display withdrawals table with:
  - [ ] Creator name
  - [ ] Bank details
  - [ ] Amount
  - [ ] Status
  - [ ] Date
- [ ] Add action buttons (Approve, Reject, View Details)
- [ ] Add Pagination
- [ ] Show total amount pending/failed
- [ ] Responsive design

**Time Estimate:** 2-2.5 hours

### 5.2 Failed Withdrawals Page
**File:** `pages/admin/FailedWithdrawals.jsx`

**Implementation:**
- [ ] Similar to withdrawals page
- [ ] Show failure reason
- [ ] Add retry button
- [ ] Add resolve button

**Time Estimate:** 1-1.5 hours

**Phase 5 Subtotal: 3-4 hours**

---

## Phase 6: Wallet Pages (3-4 hours)

### 6.1 Transactions Page
**File:** `pages/wallet/Transactions.jsx`

**Implementation:**
- [ ] Add FilterControls with:
  - [ ] Type filter (CREDIT, DEBIT)
  - [ ] Amount range
  - [ ] Date range (optional)
  - [ ] Sort options
- [ ] Display transactions table with:
  - [ ] Type (badge with color)
  - [ ] Amount
  - [ ] Description
  - [ ] Reference (submission/campaign)
  - [ ] Date/Time
- [ ] Add Pagination
- [ ] Show balance summary at top
- [ ] Export to CSV button (optional)
- [ ] Responsive design

**Time Estimate:** 1.5-2 hours

### 6.2 Earnings Page
**File:** `pages/wallet/Earnings.jsx`

**Implementation:**
- [ ] Add FilterControls with:
  - [ ] Platform filter
  - [ ] Payment status filter
  - [ ] Earning range
  - [ ] Sort options
- [ ] Display summary cards:
  - [ ] Total earned
  - [ ] Total pending
  - [ ] Per-campaign breakdown
- [ ] Display detailed earnings table with:
  - [ ] Campaign name
  - [ ] Platform
  - [ ] Views
  - [ ] Gross earning
  - [ ] Fee
  - [ ] Net earning
  - [ ] Payment status
  - [ ] Submission date
- [ ] Add Pagination for details
- [ ] Responsive design

**Time Estimate:** 2-2.5 hours

**Phase 6 Subtotal: 3-4 hours**

---

## Phase 7: Testing & Optimization (4-6 hours)

### 7.1 Functionality Testing
- [ ] Test pagination on all pages
  - [ ] First page, middle page, last page
  - [ ] Limit variations (10, 20, 50, 100)
  - [ ] Edge cases (1 item, 0 items)
- [ ] Test filtering on all pages
  - [ ] Single filter
  - [ ] Multiple filters combined
  - [ ] Filter + search + sort
- [ ] Test search functionality
  - [ ] Empty search
  - [ ] Special characters
  - [ ] Case sensitivity
- [ ] Test sorting
  - [ ] Ascending/descending
  - [ ] Different fields
  - [ ] With filters applied
- [ ] Test error states
  - [ ] Network error
  - [ ] 404 response
  - [ ] 500 response
  - [ ] Timeout

### 7.2 Performance Testing
- [ ] Test with large datasets (1000+ items)
- [ ] Check API response time
- [ ] Verify pagination loads correctly
- [ ] Test rapid page changes
- [ ] Check memory usage

### 7.3 UI/UX Testing
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Loading states visibility
- [ ] Error messages clarity
- [ ] Button accessibility
- [ ] Keyboard navigation

### 7.4 Browser Testing
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge

**Phase 7 Subtotal: 4-6 hours**

---

## Implementation Priority

### High Priority (Implement First)
1. [x] Pagination Component
2. [x] useListData Hook
3. [x] User Management Page
4. [x] Explore Campaigns Page
5. [x] My Submissions Page

### Medium Priority (Implement Second)
6. [x] My Campaigns Page
7. [x] Campaign Participants Page
8. [x] Transactions Page
9. [x] Earnings Page
10. [x] Withdrawals Page

### Low Priority (Implement Last)
11. [x] Audit Logs Page
12. [x] Fraud Detection Page
13. [x] Failed Withdrawals Page
14. [x] Bank Accounts Page

---

## Quick Implementation Template

```javascript
// Template for implementing pagination on any page
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Pagination } from '@/components/Pagination';
import { FilterControls } from '@/components/FilterControls';

export function PageTemplate() {
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    search: '',
    status: '',
    sort: '-created_at'
  });
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['data', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== null) {
          params.append(key, value);
        }
      });
      
      const response = await axios.get(
        `/api/v1/endpoint?${params}`
      );
      return response.data;
    }
  });
  
  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
  };
  
  return (
    <div>
      <h1>Page Title</h1>
      
      <FilterControls
        filters={filters}
        onFiltersChange={handleFiltersChange}
        loading={isLoading}
      />
      
      {error && <div className="error">Error: {error.message}</div>}
      {isLoading && <div className="loading">Loading...</div>}
      
      {data && (
        <>
          <table>
            {/* Render data.data */}
          </table>
          
          <Pagination
            currentPage={data.pagination.current_page}
            totalPages={data.pagination.total_pages}
            onPageChange={(page) =>
              handleFiltersChange({ ...filters, page })
            }
            loading={isLoading}
          />
        </>
      )}
    </div>
  );
}
```

---

## Estimated Timeline

| Phase | Tasks | Hours | Days |
|-------|-------|-------|------|
| 1 | Setup & Components | 5 | 0.5 |
| 2 | Admin Pages | 5 | 0.5 |
| 3 | Campaign Pages | 7 | 1 |
| 4 | Submission Pages | 3.5 | 0.5 |
| 5 | Finance Pages | 3.5 | 0.5 |
| 6 | Wallet Pages | 3.5 | 0.5 |
| 7 | Testing & Polish | 5 | 0.5 |
| | **TOTAL** | **32** | **4** |

**With 2 developers:** 2 days  
**With 1 developer:** 4 days  
**With experienced team:** Can be done in 2-3 days

---

## Testing Queries

Use these to test each endpoint:

```bash
# Admin Users
curl "http://localhost:5000/api/v1/admin/users?page=1&limit=10"

# Campaign Explore
curl "http://localhost:5000/api/v1/campaigns/explore?page=1&platform=INSTAGRAM"

# My Campaigns
curl "http://localhost:5000/api/v1/campaigns/my-campaigns?page=1"

# Submissions
curl "http://localhost:5000/api/v1/submissions?page=1&status=APPROVED"

# Wallet
curl "http://localhost:5000/api/v1/wallet/earnings?page=1"

# Transactions
curl "http://localhost:5000/api/v1/wallet/transactions?page=1&type=CREDIT"
```

---

## Common Issues & Solutions

### Issue: Pagination not working after filter change
**Solution:** Reset page to 1 when filters change
```javascript
const handleFilterChange = (newFilters) => {
  setFilters({ ...newFilters, page: 1 });
};
```

### Issue: Data not updating after page change
**Solution:** Make sure queryKey includes all filter values
```javascript
queryKey: ['endpoint', filters], // Include filters in key
```

### Issue: Too many API calls
**Solution:** Debounce search input
```javascript
const [searchTerm, setSearchTerm] = useState('');
const debouncedSearch = useDebounce(searchTerm, 500);

// Use debouncedSearch in filters
```

### Issue: Loading state not showing
**Solution:** Check isLoading flag is connected to spinner
```javascript
{isLoading && <Spinner />}
```

---

## Deliverables Checklist

- [ ] All 11+ pages have pagination implemented
- [ ] All filter controls are functional
- [ ] Search works across all pages
- [ ] Sorting works on all sortable fields
- [ ] Loading states visible
- [ ] Error states handled
- [ ] Pagination component reusable
- [ ] Responsive design implemented
- [ ] All tested on Chrome, Firefox, Safari
- [ ] Performance optimized (< 2s load time)
- [ ] Documentation updated
- [ ] Code reviewed
- [ ] Deployed to staging
- [ ] Deployed to production

---

## Questions & Support

For API questions, refer to: `API_DOCUMENTATION_FOR_FRONTEND.md`  
For backend support, contact: Backend Team  
For design questions, contact: Design Team

---

**Created:** 2024-04-30  
**Status:** Ready for Implementation  
**Contact:** Backend Team (if issues)

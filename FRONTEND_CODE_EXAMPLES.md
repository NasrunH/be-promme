# Frontend Code Examples
## Ready-to-Use Implementation Code

This document contains production-ready code examples for implementing pagination, filtering, and search on all pages.

---

## Table of Contents

1. [Utility Functions](#utility-functions)
2. [Custom Hooks](#custom-hooks)
3. [Reusable Components](#reusable-components)
4. [Page Examples](#page-examples)

---

## Utility Functions

### Query Builder Utility

**File:** `src/utils/queryBuilder.ts`

```typescript
/**
 * Build query string from filter object
 * Removes null/undefined values and encodes properly
 */
export function buildQueryString(filters: Record<string, any>): string {
  const params = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    // Skip null, undefined, empty string, and false (except boolean false that matters)
    if (
      value === null ||
      value === undefined ||
      value === '' ||
      value === false
    ) {
      return;
    }
    
    params.append(key, String(value));
  });
  
  return params.toString();
}

/**
 * Parse pagination metadata from response
 */
export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

/**
 * Create pagination state object
 */
export function createPaginationState(
  currentPage: number = 1,
  perPage: number = 10
) {
  return {
    page: currentPage,
    limit: perPage
  };
}

/**
 * Calculate offset for pagination
 */
export function calculateOffset(
  page: number,
  limit: number
): number {
  return (page - 1) * limit;
}
```

### API Client Configuration

**File:** `src/services/api.ts`

```typescript
import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 
  'http://localhost:5000/api/v1';

class ApiClient {
  private client: AxiosInstance;
  
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Add token to requests if available
    this.client.interceptors.request.use(config => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
    
    // Handle errors globally
    this.client.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 401) {
          // Handle unauthorized
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Fetch list with pagination
   */
  async fetchList(
    endpoint: string,
    filters: Record<string, any> = {}
  ) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params.append(key, String(value));
      }
    });
    
    const response = await this.client.get(endpoint, { params });
    return response.data;
  }
  
  /**
   * Fetch single item
   */
  async fetchOne(endpoint: string) {
    const response = await this.client.get(endpoint);
    return response.data;
  }
  
  /**
   * Create item
   */
  async create(endpoint: string, data: any) {
    const response = await this.client.post(endpoint, data);
    return response.data;
  }
  
  /**
   * Update item
   */
  async update(endpoint: string, data: any) {
    const response = await this.client.put(endpoint, data);
    return response.data;
  }
  
  /**
   * Delete item
   */
  async delete(endpoint: string) {
    const response = await this.client.delete(endpoint);
    return response.data;
  }
}

export const apiClient = new ApiClient();
```

---

## Custom Hooks

### useListData Hook

**File:** `src/hooks/useListData.ts`

```typescript
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { apiClient } from '@/services/api';

export interface ListFilters {
  page?: number;
  limit?: number;
  search?: string;
  [key: string]: any;
}

export interface ListResponse<T> {
  status: 'success' | 'error';
  data: T[];
  pagination: {
    current_page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

/**
 * Hook to fetch paginated list data
 * Handles caching, refetching, and error states
 */
export function useListData<T = any>(
  endpoint: string,
  filters: ListFilters = {},
  options: Partial<UseQueryOptions> = {}
) {
  const { page = 1, limit = 10, ...restFilters } = filters;
  
  return useQuery({
    queryKey: [endpoint, { page, limit, ...restFilters }],
    queryFn: async () => {
      const response = await apiClient.fetchList(endpoint, {
        page,
        limit,
        ...restFilters
      });
      return response as ListResponse<T>;
    },
    keepPreviousData: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options
  });
}

/**
 * Hook with built-in error handling and retry logic
 */
export function useListDataWithRetry<T = any>(
  endpoint: string,
  filters: ListFilters = {},
  onError?: (error: Error) => void
) {
  return useListData<T>(endpoint, filters, {
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: onError || (() => {})
  });
}
```

### useFilters Hook

**File:** `src/hooks/useFilters.ts`

```typescript
import { useState, useCallback } from 'react';

export interface FilterState {
  page: number;
  limit: number;
  search?: string;
  [key: string]: any;
}

/**
 * Hook to manage filter state
 */
export function useFilters(initialFilters: FilterState = { page: 1, limit: 10 }) {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  
  /**
   * Update single filter and reset to page 1
   */
  const updateFilter = useCallback((key: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Reset to first page when filter changes
    }));
  }, []);
  
  /**
   * Update multiple filters at once
   */
  const updateFilters = useCallback((newFilters: Partial<FilterState>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.page ?? 1
    }));
  }, []);
  
  /**
   * Change page
   */
  const changePage = useCallback((page: number) => {
    setFilters(prev => ({ ...prev, page }));
  }, []);
  
  /**
   * Change limit (items per page)
   */
  const changeLimit = useCallback((limit: number) => {
    setFilters(prev => ({ ...prev, limit, page: 1 }));
  }, []);
  
  /**
   * Reset all filters to initial state
   */
  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
  }, [initialFilters]);
  
  return {
    filters,
    updateFilter,
    updateFilters,
    changePage,
    changeLimit,
    resetFilters
  };
}

/**
 * Hook with URL sync - saves filters to URL params
 */
export function useFiltersWithURL(
  initialFilters: FilterState = { page: 1, limit: 10 }
) {
  const [filters, setFilters] = useState<FilterState>(() => {
    // Load from URL on mount
    const params = new URLSearchParams(window.location.search);
    const urlFilters: FilterState = { ...initialFilters };
    
    for (const [key, value] of params) {
      if (key === 'page' || key === 'limit') {
        urlFilters[key] = parseInt(value);
      } else {
        urlFilters[key] = value;
      }
    }
    
    return urlFilters;
  });
  
  const updateFilters = useCallback((newFilters: Partial<FilterState>) => {
    const updated = { ...filters, ...newFilters, page: newFilters.page ?? 1 };
    setFilters(updated);
    
    // Update URL
    const params = new URLSearchParams();
    Object.entries(updated).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params.set(key, String(value));
      }
    });
    
    window.history.replaceState({}, '', `?${params.toString()}`);
  }, [filters]);
  
  const changePage = useCallback((page: number) => {
    updateFilters({ page });
  }, [updateFilters]);
  
  return {
    filters,
    updateFilters,
    changePage,
    setFilters
  };
}
```

### useDebounce Hook

**File:** `src/hooks/useDebounce.ts`

```typescript
import { useState, useEffect } from 'react';

/**
 * Debounce a value
 * Useful for search inputs to avoid too many API calls
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
}
```

---

## Reusable Components

### Pagination Component

**File:** `src/components/Pagination.tsx`

```typescript
import React from 'react';
import './Pagination.css';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  loading = false,
  className = ''
}: PaginationProps) {
  if (totalPages <= 1) return null;
  
  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }
  
  const pages: (number | string)[] = [];
  
  // Add first page
  if (startPage > 1) {
    pages.push(1);
    if (startPage > 2) pages.push('...');
  }
  
  // Add page numbers
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }
  
  // Add last page
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) pages.push('...');
    pages.push(totalPages);
  }
  
  return (
    <div className={`pagination ${className}`}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || loading}
        className="pagination-btn pagination-prev"
        aria-label="Previous page"
      >
        ← Previous
      </button>
      
      <div className="pagination-numbers">
        {pages.map((page, idx) => {
          if (page === '...') {
            return (
              <span key={`ellipsis-${idx}`} className="pagination-ellipsis">
                ...
              </span>
            );
          }
          
          return (
            <button
              key={page}
              onClick={() => onPageChange(page as number)}
              className={`pagination-btn ${
                page === currentPage ? 'active' : ''
              }`}
              disabled={loading}
              aria-label={`Page ${page}`}
              aria-current={page === currentPage ? 'page' : undefined}
            >
              {page}
            </button>
          );
        })}
      </div>
      
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages || loading}
        className="pagination-btn pagination-next"
        aria-label="Next page"
      >
        Next →
      </button>
    </div>
  );
}
```

**Styles:** `src/components/Pagination.css`

```css
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 2rem;
  flex-wrap: wrap;
}

.pagination-btn {
  padding: 0.5rem 0.75rem;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.pagination-btn:hover:not(:disabled) {
  background: #f5f5f5;
  border-color: #999;
}

.pagination-btn.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-numbers {
  display: flex;
  gap: 0.25rem;
}

.pagination-ellipsis {
  padding: 0.5rem 0.25rem;
  color: #999;
}

@media (max-width: 640px) {
  .pagination {
    gap: 0.25rem;
  }
  
  .pagination-btn {
    padding: 0.4rem 0.5rem;
    font-size: 0.75rem;
  }
}
```

### Filter Controls Component

**File:** `src/components/FilterControls.tsx`

```typescript
import React, { useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import './FilterControls.css';

interface FilterOption {
  label: string;
  value: string;
}

interface FilterControlsProps {
  onSearchChange?: (search: string) => void;
  onFilterChange?: (filters: Record<string, string>) => void;
  onReset?: () => void;
  filters?: Record<string, string>;
  loading?: boolean;
  searchPlaceholder?: string;
  filterOptions?: Record<string, FilterOption[]>;
}

export function FilterControls({
  onSearchChange,
  onFilterChange,
  onReset,
  filters = {},
  loading = false,
  searchPlaceholder = 'Search...',
  filterOptions = {}
}: FilterControlsProps) {
  const [search, setSearch] = useState(filters.search || '');
  const debouncedSearch = useDebounce(search, 500);
  
  React.useEffect(() => {
    onSearchChange?.(debouncedSearch);
  }, [debouncedSearch, onSearchChange]);
  
  const handleFilterChange = (key: string, value: string) => {
    onFilterChange?.({
      ...filters,
      [key]: value,
      search: debouncedSearch
    });
  };
  
  const handleReset = () => {
    setSearch('');
    onReset?.();
  };
  
  return (
    <div className="filter-controls">
      <div className="filter-controls-row">
        <div className="filter-controls-search">
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={loading}
            className="filter-input"
            aria-label="Search"
          />
        </div>
        
        {Object.entries(filterOptions).map(([key, options]) => (
          <select
            key={key}
            value={filters[key] || ''}
            onChange={(e) => handleFilterChange(key, e.target.value)}
            disabled={loading}
            className="filter-select"
            aria-label={key}
          >
            <option value="">All {key}</option>
            {options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ))}
        
        <button
          onClick={handleReset}
          disabled={loading}
          className="filter-reset-btn"
          aria-label="Reset filters"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
```

**Styles:** `src/components/FilterControls.css`

```css
.filter-controls {
  background: #f9f9f9;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1.5rem;
  border: 1px solid #eee;
}

.filter-controls-row {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.filter-controls-search {
  flex: 1;
  min-width: 200px;
}

.filter-input,
.filter-select {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.875rem;
  font-family: inherit;
}

.filter-input:focus,
.filter-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.filter-reset-btn {
  padding: 0.5rem 1rem;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
  white-space: nowrap;
}

.filter-reset-btn:hover:not(:disabled) {
  background: #f5f5f5;
}

.filter-reset-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .filter-controls-row {
    gap: 0.5rem;
  }
  
  .filter-controls-search {
    min-width: 100%;
  }
  
  .filter-input,
  .filter-select {
    min-width: 100px;
  }
}
```

### Loading Skeleton

**File:** `src/components/LoadingSkeleton.tsx`

```typescript
import React from 'react';
import './LoadingSkeleton.css';

interface LoadingSkeletonProps {
  rows?: number;
  columns?: number;
}

export function LoadingSkeleton({ rows = 5, columns = 4 }: LoadingSkeletonProps) {
  return (
    <div className="loading-skeleton">
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="skeleton-row">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <div
              key={colIdx}
              className="skeleton-cell"
              style={{
                animationDelay: `${(rowIdx * columns + colIdx) * 100}ms`
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
```

**Styles:** `src/components/LoadingSkeleton.css`

```css
.loading-skeleton {
  width: 100%;
}

.skeleton-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 0.5rem;
  border: 1px solid #eee;
  border-radius: 4px;
}

.skeleton-cell {
  flex: 1;
  height: 20px;
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  border-radius: 4px;
  animation: loading 1.5s infinite;
}

@keyframes loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
```

---

## Page Examples

### Example 1: Users Management Page

**File:** `src/pages/admin/UserManagement.tsx`

```typescript
import React, { useState } from 'react';
import { useListData } from '@/hooks/useListData';
import { useFilters } from '@/hooks/useFilters';
import { Pagination } from '@/components/Pagination';
import { FilterControls } from '@/components/FilterControls';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';

export function UserManagement() {
  const { filters, updateFilter, updateFilters, changePage, resetFilters } =
    useFilters({
      page: 1,
      limit: 10,
      search: '',
      status: '',
      role: '',
      sort: '-created_at'
    });
  
  const { data, isLoading, error } = useListData('/admin/users', filters);
  
  const handleSearch = (search: string) => {
    updateFilter('search', search);
  };
  
  const handleFilterChange = (newFilters: Record<string, string>) => {
    updateFilters(newFilters);
  };
  
  const handleReset = () => {
    resetFilters();
  };
  
  return (
    <div className="user-management-page">
      <div className="page-header">
        <h1>User Management</h1>
        <p>Manage all users in the system</p>
      </div>
      
      <FilterControls
        onSearchChange={handleSearch}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        filters={filters}
        loading={isLoading}
        searchPlaceholder="Search by email or username..."
        filterOptions={{
          status: [
            { label: 'Active', value: 'ACTIVE' },
            { label: 'Inactive', value: 'INACTIVE' },
            { label: 'Suspended', value: 'SUSPENDED' }
          ],
          role: [
            { label: 'Admin', value: 'ADMIN' },
            { label: 'Brand', value: 'BRAND' },
            { label: 'Creator', value: 'CREATOR' },
            { label: 'Finance', value: 'FINANCE' }
          ],
          sort: [
            { label: 'Newest First', value: '-created_at' },
            { label: 'Oldest First', value: 'created_at' },
            { label: 'Email A-Z', value: 'email' },
            { label: 'Email Z-A', value: '-email' }
          ]
        }}
      />
      
      {error && (
        <div className="error-container">
          <p className="error-message">
            Error loading users: {error.message}
          </p>
          <button onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
      )}
      
      {isLoading && <LoadingSkeleton rows={5} columns={5} />}
      
      {data && (
        <>
          <div className="table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.data.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center">
                      No users found
                    </td>
                  </tr>
                ) : (
                  data.data.map(user => (
                    <tr key={user.id}>
                      <td>{user.email}</td>
                      <td>{user.username}</td>
                      <td>
                        <span className={`badge badge-${user.role.toLowerCase()}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <span className={`status-${user.status.toLowerCase()}`}>
                          {user.status}
                        </span>
                      </td>
                      <td>
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <button className="action-btn">View</button>
                        <button className="action-btn">Edit</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <div className="pagination-info">
            <p>
              Showing{' '}
              {(filters.page - 1) * filters.limit + 1} to{' '}
              {Math.min(
                filters.page * filters.limit,
                data.pagination.total_items
              )}{' '}
              of {data.pagination.total_items} users
            </p>
          </div>
          
          <Pagination
            currentPage={data.pagination.current_page}
            totalPages={data.pagination.total_pages}
            onPageChange={changePage}
            loading={isLoading}
          />
        </>
      )}
    </div>
  );
}
```

### Example 2: Campaigns Explore Page

**File:** `src/pages/campaigns/ExploreCampaigns.tsx`

```typescript
import React, { useState } from 'react';
import { useListData } from '@/hooks/useListData';
import { useFilters } from '@/hooks/useFilters';
import { Pagination } from '@/components/Pagination';
import { FilterControls } from '@/components/FilterControls';

export function ExploreCampaigns() {
  const { filters, updateFilters, changePage, resetFilters } = useFilters({
    page: 1,
    limit: 10,
    search: '',
    platform: '',
    status: 'AKTIF',
    sort: '-created_at'
  });
  
  const [budgetRange, setBudgetRange] = useState({ min: '', max: '' });
  
  const { data, isLoading } = useListData('/campaigns/explore', {
    ...filters,
    budget_min: budgetRange.min || undefined,
    budget_max: budgetRange.max || undefined
  });
  
  const handleBudgetChange = (type: 'min' | 'max', value: string) => {
    setBudgetRange(prev => ({ ...prev, [type]: value }));
  };
  
  return (
    <div className="explore-campaigns-page">
      <h1>Explore Campaigns</h1>
      
      <div className="filters">
        <input
          type="text"
          placeholder="Search campaigns..."
          value={filters.search || ''}
          onChange={(e) => updateFilters({ search: e.target.value, page: 1 })}
        />
        
        <select
          value={filters.platform || ''}
          onChange={(e) => updateFilters({ platform: e.target.value, page: 1 })}
        >
          <option value="">All Platforms</option>
          <option value="INSTAGRAM">Instagram</option>
          <option value="TIKTOK">TikTok</option>
          <option value="YOUTUBE">YouTube</option>
        </select>
        
        <div className="budget-filter">
          <input
            type="number"
            placeholder="Min Budget"
            value={budgetRange.min}
            onChange={(e) => handleBudgetChange('min', e.target.value)}
          />
          <input
            type="number"
            placeholder="Max Budget"
            value={budgetRange.max}
            onChange={(e) => handleBudgetChange('max', e.target.value)}
          />
        </div>
        
        <button onClick={resetFilters}>Reset</button>
      </div>
      
      {data && (
        <>
          <div className="campaigns-grid">
            {data.data.map(campaign => (
              <div key={campaign.campaign_id} className="campaign-card">
                <h3>{campaign.nama_campaign}</h3>
                <p className="platform">{campaign.platform}</p>
                <p className="budget">Rp {campaign.budget_total.toLocaleString()}</p>
                <p className="brand">{campaign.brand_name}</p>
                <button className="join-btn">
                  {campaign.is_joined ? 'Joined ✓' : 'Join Campaign'}
                </button>
              </div>
            ))}
          </div>
          
          <Pagination
            currentPage={data.pagination.current_page}
            totalPages={data.pagination.total_pages}
            onPageChange={changePage}
            loading={isLoading}
          />
        </>
      )}
    </div>
  );
}
```

---

## Complete Integration Example

```typescript
// Full page with all features
import React from 'react';
import { useListData } from '@/hooks/useListData';
import { useFilters } from '@/hooks/useFilters';
import { Pagination } from '@/components/Pagination';
import { FilterControls } from '@/components/FilterControls';

export function CompleteExample() {
  // Manage filters
  const { filters, updateFilter, updateFilters, changePage, resetFilters } =
    useFilters({
      page: 1,
      limit: 10,
      search: '',
      status: '',
      sort: '-created_at'
    });
  
  // Fetch data
  const { data, isLoading, error } = useListData('/endpoint', filters);
  
  // Handlers
  const handleSearch = (search: string) => {
    updateFilter('search', search);
  };
  
  const handlePageChange = (page: number) => {
    changePage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  return (
    <div>
      <h1>Page Title</h1>
      
      <FilterControls
        onSearchChange={handleSearch}
        onReset={resetFilters}
        filters={filters}
        loading={isLoading}
      />
      
      {error && <div className="error">{error.message}</div>}
      {isLoading && <div className="loading">Loading...</div>}
      
      {data && (
        <>
          <table>
            <thead>
              <tr>
                {/* Headers */}
              </tr>
            </thead>
            <tbody>
              {data.data.map(item => (
                <tr key={item.id}>{/* Row content */}</tr>
              ))}
            </tbody>
          </table>
          
          <p>
            Total: {data.pagination.total_items} items
          </p>
          
          <Pagination
            currentPage={data.pagination.current_page}
            totalPages={data.pagination.total_pages}
            onPageChange={handlePageChange}
            loading={isLoading}
          />
        </>
      )}
    </div>
  );
}
```

---

**These examples are production-ready and can be used immediately in your project!**

/**
 * Utility untuk handle pagination, filtering, dan search di semua endpoint
 */

/**
 * Parse pagination parameters dari query
 * @param {Object} query - Express query object
 * @returns {Object} - {page, limit, offset}
 */
const parsePagination = (query) => {
  let page = parseInt(query.page) || 1;
  let limit = parseInt(query.limit) || 10;

  // Validasi
  page = page < 1 ? 1 : page;
  limit = limit < 1 ? 10 : limit > 100 ? 100 : limit; // Max 100 per page

  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

/**
 * Parse filter dari query string
 * @param {Object} query - Express query object
 * @param {Array} allowedFields - Field yang boleh di-filter
 * @returns {Object} - Filter object untuk database query
 */
const parseFilters = (query, allowedFields = []) => {
  const filters = {};

  allowedFields.forEach((field) => {
    if (query[field]) {
      filters[field] = query[field];
    }
  });

  return filters;
};

/**
 * Parse range filter (dari, sampai)
 * @param {Object} query - Express query object
 * @param {String} fieldName - Nama field untuk range filter
 * @returns {Object} - Filter object {field: {$gte, $lte}}
 */
const parseRangeFilter = (query, fieldName) => {
  const filter = {};
  const minKey = `${fieldName}_min`;
  const maxKey = `${fieldName}_max`;

  if (query[minKey] || query[maxKey]) {
    filter[fieldName] = {};
    if (query[minKey]) {
      filter[fieldName].$gte = parseFloat(query[minKey]);
    }
    if (query[maxKey]) {
      filter[fieldName].$lte = parseFloat(query[maxKey]);
    }
  }

  return Object.keys(filter).length > 0 ? filter : null;
};

/**
 * Parse date range filter
 * @param {Object} query - Express query object
 * @param {String} fieldName - Nama field untuk date range
 * @returns {Object} - Filter object {field: {$gte, $lte}}
 */
const parseDateRangeFilter = (query, fieldName) => {
  const filter = {};
  const startKey = `${fieldName}_start`;
  const endKey = `${fieldName}_end`;

  if (query[startKey] || query[endKey]) {
    filter[fieldName] = {};
    if (query[startKey]) {
      filter[fieldName].$gte = new Date(query[startKey]);
    }
    if (query[endKey]) {
      filter[fieldName].$lte = new Date(query[endKey]);
    }
  }

  return Object.keys(filter).length > 0 ? filter : null;
};

/**
 * Parse search dari query
 * @param {Object} query - Express query object
 * @param {Array} searchFields - Field mana yang di-search
 * @returns {Object} - Filter object untuk search
 */
const parseSearch = (query, searchFields = []) => {
  if (!query.search || searchFields.length === 0) {
    return null;
  }

  const searchTerm = query.search.trim();
  if (searchTerm.length === 0) {
    return null;
  }

  // Case-insensitive search dengan regex
  const searchRegex = new RegExp(searchTerm, 'i');

  return {
    $or: searchFields.map((field) => ({
      [field]: searchRegex,
    })),
  };
};

/**
 * Parse sort dari query
 * @param {Object} query - Express query object
 * @param {String} defaultSort - Default sort field (e.g., '-created_at')
 * @returns {Object} - Sort object untuk database query
 */
const parseSort = (query, defaultSort = '-created_at') => {
  let sortField = query.sort || defaultSort;
  const sortObj = {};

  if (sortField.startsWith('-')) {
    sortObj[sortField.substring(1)] = -1; // Descending
  } else {
    sortObj[sortField] = 1; // Ascending
  }

  return sortObj;
};

/**
 * Format response dengan pagination metadata
 * @param {Array} data - Data items
 * @param {Number} total - Total items count
 * @param {Number} page - Current page
 * @param {Number} limit - Items per page
 * @returns {Object} - Formatted response object
 */
const formatPaginationResponse = (data, total, page, limit) => {
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      current_page: page,
      per_page: limit,
      total_items: total,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
    },
  };
};

/**
 * Build MongoDB aggregation pipeline untuk pagination dan filtering
 * @param {Object} params - { filters, search, sort, page, limit }
 * @returns {Array} - Aggregation pipeline stages
 */
const buildAggregationPipeline = (params) => {
  const { filters = {}, search = null, sort = {}, page = 1, limit = 10 } = params;

  const pipeline = [];

  // Match stage untuk filters
  const matchStage = { ...filters };
  if (search) {
    Object.assign(matchStage, search);
  }
  pipeline.push({ $match: matchStage });

  // Sort stage
  pipeline.push({ $sort: sort });

  // Skip untuk pagination
  const offset = (page - 1) * limit;
  pipeline.push({ $skip: offset });

  // Limit
  pipeline.push({ $limit: limit });

  return pipeline;
};

/**
 * Utility untuk multiple search fields
 */
const createMultiFieldSearchFilter = (searchTerm, fields) => {
  const regex = new RegExp(searchTerm, 'i');
  return {
    $or: fields.map((field) => ({
      [field]: regex,
    })),
  };
};

module.exports = {
  parsePagination,
  parseFilters,
  parseRangeFilter,
  parseDateRangeFilter,
  parseSearch,
  parseSort,
  formatPaginationResponse,
  buildAggregationPipeline,
  createMultiFieldSearchFilter,
};

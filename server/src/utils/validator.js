/**
 * Input Validation Utilities for Personal Brain routes.
 * Implements Antigravity §12 F-4.
 */

const SAFE_ID_REGEX = /^[A-Za-z0-9_@.\-]+$/;

function validateQuery(query) {
  if (typeof query !== 'string') return false;
  const trimmed = query.trim();
  return trimmed.length >= 1 && trimmed.length <= 2000;
}

function validateMaxResults(val) {
  if (val === undefined || val === null || val === '') return 50;
  const num = parseInt(val, 10);
  if (isNaN(num) || num < 1 || num > 50) return null;
  return num;
}

function validateIsoDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? false : d;
}

function validatePagination(page, pageSize) {
  const p = parseInt(page, 10);
  const ps = parseInt(pageSize, 10);
  const validPage = !isNaN(p) && p >= 1 ? p : 1;
  const validPageSize = !isNaN(ps) && ps >= 1 && ps <= 100 ? ps : 25;
  return { page: validPage, pageSize: validPageSize };
}

function validateEntityId(id) {
  if (typeof id !== 'string') return false;
  return SAFE_ID_REGEX.test(id) && !id.includes('..');
}

module.exports = {
  validateQuery,
  validateMaxResults,
  validateIsoDate,
  validatePagination,
  validateEntityId
};

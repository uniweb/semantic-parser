/**
 * Helper utilities for content transformation
 */

import { createExcerpt, stripMarkup } from './types.js';

/**
 * Get the first item from an array or return default value
 * @param {Array} arr - Array to get first item from
 * @param {*} defaultValue - Value to return if array is empty or undefined
 * @returns {*} First item or default value
 */
function first(arr, defaultValue = null) {
    return arr?.[0] ?? defaultValue;
}

/**
 * Get the last item from an array or return default value
 * @param {Array} arr - Array to get last item from
 * @param {*} defaultValue - Value to return if array is empty or undefined
 * @returns {*} Last item or default value
 */
function last(arr, defaultValue = null) {
    if (!arr || arr.length === 0) return defaultValue;
    return arr[arr.length - 1];
}

/**
 * Transform an array using a mapping function
 * @param {Array} arr - Array to transform
 * @param {Function} transform - Transformation function
 * @returns {Array} Transformed array
 */
function transformArray(arr, transform) {
    if (!Array.isArray(arr)) return [];
    return arr.map(transform);
}

/**
 * Filter array and optionally transform
 * @param {Array} arr - Array to filter
 * @param {Function} predicate - Filter function
 * @param {Function} transform - Optional transformation function
 * @returns {Array} Filtered (and transformed) array
 */
function filterArray(arr, predicate, transform = null) {
    if (!Array.isArray(arr)) return [];
    const filtered = arr.filter(predicate);
    return transform ? filtered.map(transform) : filtered;
}

/**
 * Join array of strings with separator
 * @param {Array} arr - Array to join
 * @param {string} separator - Separator string
 * @returns {string} Joined string
 */
function joinText(arr, separator = ' ') {
    if (!Array.isArray(arr)) return '';
    return arr.filter(Boolean).join(separator);
}

/**
 * Flatten nested array structure
 * @param {Array} arr - Array to flatten
 * @param {number} depth - Depth to flatten (default: 1)
 * @returns {Array} Flattened array
 */
function flatten(arr, depth = 1) {
    if (!Array.isArray(arr)) return [];
    return arr.flat(depth);
}

/**
 * Check if value exists (not null, undefined, or empty string)
 * @param {*} value - Value to check
 * @returns {boolean} True if value exists
 */
function exists(value) {
    return value !== null && value !== undefined && value !== '';
}

/**
 * Get value with fallback
 * @param {*} value - Primary value
 * @param {*} fallback - Fallback value
 * @returns {*} Value or fallback
 */
function withDefault(value, fallback) {
    return exists(value) ? value : fallback;
}

/**
 * Validate that required fields are present
 * @param {Object} data - Data object to validate
 * @param {Array<string>} required - Array of required field names
 * @returns {Object} Validation result { valid: boolean, missing: Array<string> }
 */
function validateRequired(data, required) {
    const missing = required.filter(field => !exists(data[field]));
    return {
        valid: missing.length === 0,
        missing
    };
}

/**
 * Pick specific properties from object
 * @param {Object} obj - Source object
 * @param {Array<string>} keys - Keys to pick
 * @returns {Object} Object with only picked keys
 */
function pick(obj, keys) {
    if (!obj) return {};
    return keys.reduce((result, key) => {
        if (key in obj) {
            result[key] = obj[key];
        }
        return result;
    }, {});
}

/**
 * Omit specific properties from object
 * @param {Object} obj - Source object
 * @param {Array<string>} keys - Keys to omit
 * @returns {Object} Object without omitted keys
 */
function omit(obj, keys) {
    if (!obj) return {};
    const result = { ...obj };
    keys.forEach(key => delete result[key]);
    return result;
}

/**
 * Safely access nested property
 * @param {Object} obj - Object to access
 * @param {string} path - Dot-notation path (e.g., 'a.b.c')
 * @param {*} defaultValue - Default value if path doesn't exist
 * @returns {*} Value at path or default
 */
function get(obj, path, defaultValue = undefined) {
    if (!obj || !path) return defaultValue;

    const keys = path.split('.');
    let result = obj;

    for (const key of keys) {
        if (result === null || result === undefined) {
            return defaultValue;
        }
        result = result[key];
    }

    return result !== undefined ? result : defaultValue;
}

/**
 * Compact an array (remove null, undefined, empty string)
 * @param {Array} arr - Array to compact
 * @returns {Array} Compacted array
 */
function compact(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.filter(exists);
}

/**
 * Create a safe extractor that won't throw on missing data
 * @param {Function} extractFn - Extraction function that might throw
 * @param {*} defaultValue - Default value if extraction fails
 * @returns {Function} Safe extraction function
 */
function safe(extractFn, defaultValue = null) {
    return (...args) => {
        try {
            return extractFn(...args) ?? defaultValue;
        } catch (error) {
            return defaultValue;
        }
    };
}

/**
 * Join paragraphs into a single string
 * @param {Array|string} paragraphs - Array of paragraphs or single paragraph
 * @param {string} separator - Separator to use between paragraphs
 * @returns {string} Joined text
 */
function joinParagraphs(paragraphs, separator = ' ') {
    if (!Array.isArray(paragraphs)) return paragraphs || '';
    return paragraphs.filter(Boolean).join(separator);
}

/**
 * Create an excerpt from paragraphs
 * @param {Array|string} paragraphs - Array of paragraphs or single paragraph
 * @param {Object} options - Excerpt options (maxLength, boundary, ellipsis)
 * @returns {string} Generated excerpt
 */
function excerptFromParagraphs(paragraphs, options = {}) {
    return createExcerpt(paragraphs, options);
}

/**
 * Count words in text or paragraphs
 * @param {Array|string} text - Text or array of paragraphs
 * @returns {number} Word count
 */
function countWords(text) {
    const plain = Array.isArray(text) ? text.join(' ') : text;
    return stripMarkup(plain).split(/\s+/).filter(Boolean).length;
}

export {
    first,
    last,
    transformArray,
    filterArray,
    joinText,
    flatten,
    exists,
    withDefault,
    validateRequired,
    pick,
    omit,
    get,
    compact,
    safe,
    joinParagraphs,
    excerptFromParagraphs,
    countWords
};

/**
 * Path-based accessor for extracting values from parsed content
 */

import { applyType, validateType } from './types.js';

/**
 * Parse a path string into segments, handling array indices
 * @param {string} path - Path string (e.g., 'groups.main.body.imgs[0].url')
 * @returns {Array} Array of path segments
 */
function parsePath(path) {
    const segments = [];
    const parts = path.split('.');

    for (const part of parts) {
        // Check for array index notation: key[0]
        const match = part.match(/^(.+?)\[(\d+)\]$/);
        if (match) {
            segments.push({ key: match[1], type: 'object' });
            segments.push({ index: parseInt(match[2], 10), type: 'array' });
        } else {
            segments.push({ key: part, type: 'object' });
        }
    }

    return segments;
}

/**
 * Get value at path from parsed content
 * @param {Object} parsed - Parsed content from parseContent()
 * @param {string} path - Path to value (e.g., 'groups.main.header.title')
 * @param {Object} options - Options for extraction
 * @param {*} options.defaultValue - Default value if path doesn't exist
 * @param {Function} options.transform - Transformation function to apply to value
 * @param {boolean} options.required - Throw error if value is missing
 * @param {string} options.type - Field type for automatic transformation
 * @param {boolean} options.treatEmptyAsDefault - Treat empty strings as missing
 * @returns {*} Value at path
 */
function getByPath(parsed, path, options = {}) {
    const {
        defaultValue,
        transform,
        required = false,
        type,
        treatEmptyAsDefault = false,
        ...typeOptions
    } = options;

    if (!parsed || !path) {
        if (required) {
            throw new Error('Path is required');
        }
        return defaultValue;
    }

    const segments = parsePath(path);
    let current = parsed;

    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];

        if (current === null || current === undefined) {
            if (required) {
                throw new Error(`Required field missing at path: ${path}`);
            }
            return defaultValue;
        }

        if (segment.type === 'array') {
            if (!Array.isArray(current)) {
                if (required) {
                    throw new Error(`Expected array at path segment ${i} in: ${path}`);
                }
                return defaultValue;
            }
            current = current[segment.index];
        } else {
            current = current[segment.key];
        }
    }

    let value = current !== undefined ? current : defaultValue;

    // Treat empty strings as missing if requested
    if (treatEmptyAsDefault && value === '') {
        value = defaultValue;
    }

    if (required && (value === undefined || value === null || value === '')) {
        throw new Error(`Required field missing at path: ${path}`);
    }

    // Apply type transformation if specified
    if (type && value !== undefined && value !== null) {
        value = applyType(value, type, typeOptions);
    }

    // Apply custom transform after type transformation
    return transform ? transform(value) : value;
}

/**
 * Extract multiple values using a schema
 * @param {Object} parsed - Parsed content from parseContent()
 * @param {Object} schema - Schema defining paths and transformations
 * @param {Object} options - Extraction options
 * @param {string} options.mode - Execution mode ('visual-editor' or 'build')
 * @returns {Object} Extracted values
 *
 * @example
 * const schema = {
 *   title: {
 *     path: 'groups.main.header.title',
 *     type: 'plaintext',
 *     maxLength: 60
 *   },
 *   image: {
 *     path: 'groups.main.body.imgs[0].url',
 *     type: 'image',
 *     defaultValue: '/placeholder.jpg'
 *   },
 *   description: {
 *     path: 'groups.main.body.paragraphs',
 *     type: 'excerpt',
 *     maxLength: 150
 *   }
 * };
 * const data = extractBySchema(parsed, schema, { mode: 'visual-editor' });
 */
function extractBySchema(parsed, schema, options = {}) {
    const { mode = 'visual-editor' } = options;
    const result = {};
    const validationResults = [];

    for (const [key, config] of Object.entries(schema)) {
        // Allow shorthand: key: 'path.to.value'
        if (typeof config === 'string') {
            result[key] = getByPath(parsed, config);
        } else {
            // Full config: { path, type, defaultValue, transform, required, ... }
            const { path, type, ...fieldOptions } = config;

            // Extract value
            result[key] = getByPath(parsed, path, { type, ...fieldOptions });

            // Validate if type specified and in build mode
            if (type && mode === 'build') {
                const rawValue = getByPath(parsed, path, {
                    defaultValue: fieldOptions.defaultValue
                });
                const errors = validateType(rawValue, type, {
                    ...fieldOptions,
                    fieldName: key
                }, mode);
                validationResults.push(...errors);
            }
        }
    }

    // In build mode, log validation results
    if (mode === 'build' && validationResults.length > 0) {
        const errors = validationResults.filter(v => v.severity === 'error');
        const warnings = validationResults.filter(v => v.severity === 'warning');

        if (warnings.length > 0) {
            console.warn('Content validation warnings:');
            warnings.forEach(w => {
                console.warn(`  [${w.field}] ${w.message}${w.autoFix ? ' (auto-fixed)' : ''}`);
            });
        }

        if (errors.length > 0) {
            console.error('Content validation errors:');
            errors.forEach(e => {
                console.error(`  [${e.field}] ${e.message}`);
            });
        }
    }

    return result;
}

/**
 * Check if a path exists in parsed content
 * @param {Object} parsed - Parsed content
 * @param {string} path - Path to check
 * @returns {boolean} True if path exists and has a non-null/undefined value
 */
function hasPath(parsed, path) {
    try {
        const value = getByPath(parsed, path);
        return value !== null && value !== undefined;
    } catch {
        return false;
    }
}

/**
 * Get multiple paths, return first that exists
 * @param {Object} parsed - Parsed content
 * @param {Array<string>} paths - Array of paths to try
 * @param {*} defaultValue - Default if none exist
 * @returns {*} First existing value or default
 */
function getFirstExisting(parsed, paths, defaultValue = null) {
    for (const path of paths) {
        if (hasPath(parsed, path)) {
            return getByPath(parsed, path);
        }
    }
    return defaultValue;
}

/**
 * Extract values from array of items using same path
 * @param {Object} parsed - Parsed content
 * @param {string} arrayPath - Path to array
 * @param {string|Object} itemConfig - Path or config for each item
 * @returns {Array} Extracted values
 *
 * @example
 * // Get all item titles
 * mapArray(parsed, 'groups.items', 'header.title')
 *
 * // Get objects from each item
 * mapArray(parsed, 'groups.items', {
 *   title: 'header.title',
 *   text: { path: 'body.paragraphs', transform: p => p.join(' ') }
 * })
 */
function mapArray(parsed, arrayPath, itemConfig) {
    const array = getByPath(parsed, arrayPath, { defaultValue: [] });

    if (!Array.isArray(array)) {
        return [];
    }

    return array.map(item => {
        if (typeof itemConfig === 'string') {
            return getByPath({ item }, `item.${itemConfig}`);
        } else {
            return extractBySchema({ item },
                Object.entries(itemConfig).reduce((acc, [key, config]) => {
                    if (typeof config === 'string') {
                        acc[key] = `item.${config}`;
                    } else {
                        acc[key] = { ...config, path: `item.${config.path}` };
                    }
                    return acc;
                }, {})
            );
        }
    });
}

/**
 * Validate content against schema without extracting
 * Useful for providing UI hints in visual editor
 * @param {Object} parsed - Parsed content
 * @param {Object} schema - Schema to validate against
 * @param {Object} options - Validation options
 * @param {string} options.mode - Execution mode ('visual-editor' or 'build')
 * @returns {Object} Validation results by field
 *
 * @example
 * const hints = validateSchema(parsed, schema);
 * // {
 * //   title: [{ type: 'max_length', severity: 'info', message: '...' }],
 * //   image: [{ type: 'required', severity: 'error', message: '...' }]
 * // }
 */
function validateSchema(parsed, schema, options = {}) {
    const { mode = 'visual-editor' } = options;
    const results = {};

    for (const [key, config] of Object.entries(schema)) {
        if (typeof config === 'string') {
            continue; // No validation for shorthand
        }

        const { path, type, ...fieldOptions } = config;

        if (type) {
            const rawValue = getByPath(parsed, path, {
                defaultValue: fieldOptions.defaultValue
            });

            const errors = validateType(rawValue, type, {
                ...fieldOptions,
                fieldName: key
            }, mode);

            if (errors.length > 0) {
                results[key] = errors;
            }
        }
    }

    return results;
}

export {
    getByPath,
    extractBySchema,
    validateSchema,
    hasPath,
    getFirstExisting,
    mapArray
};

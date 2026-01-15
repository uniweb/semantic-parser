/**
 * Content mapping utilities for transforming parsed content
 * into component-specific formats
 */

import * as helpers from './helpers.js';
import * as accessor from './accessor.js';
import * as extractors from './extractors.js';
import * as types from './types.js';

export {
    // Helper utilities
    helpers,

    // Path-based accessor
    accessor,

    // Common extractors
    extractors,

    // Type system
    types
};

// Re-export all functions for direct access
export * from './helpers.js';
export * from './accessor.js';
export * from './extractors.js';

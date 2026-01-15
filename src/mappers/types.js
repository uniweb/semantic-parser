/**
 * Field type definitions for content transformation
 * Handles automatic cleanup and transformation based on component requirements
 */

/**
 * Strip all HTML/markup from text, preserving only text content
 * @param {string} text - Text with potential markup
 * @param {Object} options - Stripping options
 * @returns {string} Plain text
 */
function stripMarkup(text, options = {}) {
    if (typeof text !== 'string') return '';

    const {
        preserveLineBreaks = false,
        preserveWhitespace = false
    } = options;

    let result = text;

    // Convert <br> to newlines if preserving line breaks
    if (preserveLineBreaks) {
        result = result.replace(/<br\s*\/?>/gi, '\n');
    }

    // Remove all HTML tags
    result = result.replace(/<[^>]*>/g, '');

    // Decode HTML entities
    result = result
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

    // Normalize whitespace unless preserving
    if (!preserveWhitespace && !preserveLineBreaks) {
        result = result.replace(/\s+/g, ' ').trim();
    } else if (!preserveWhitespace && preserveLineBreaks) {
        // Preserve line breaks but normalize spaces within lines
        result = result.split('\n').map(line => line.replace(/\s+/g, ' ').trim()).join('\n');
    }

    return result;
}

/**
 * Truncate text to specified length with smart boundary detection
 * @param {string} text - Text to truncate
 * @param {Object} options - Truncation options
 * @returns {string} Truncated text
 */
function truncateText(text, options = {}) {
    if (typeof text !== 'string') return '';

    const {
        maxLength,
        boundary = 'word', // 'word', 'sentence', 'character'
        ellipsis = '...',
        stripMarkup: strip = false
    } = options;

    if (!maxLength) return text;

    // Strip markup if requested
    let result = strip ? stripMarkup(text) : text;

    // Already short enough
    if (result.length <= maxLength) return result;

    // Truncate with boundary awareness
    if (boundary === 'character') {
        return result.substring(0, maxLength) + ellipsis;
    }

    if (boundary === 'sentence') {
        // Find last sentence end before maxLength
        const truncated = result.substring(0, maxLength);
        const lastPeriod = Math.max(
            truncated.lastIndexOf('. '),
            truncated.lastIndexOf('! '),
            truncated.lastIndexOf('? ')
        );

        if (lastPeriod > maxLength * 0.5) {
            return result.substring(0, lastPeriod + 1);
        }
    }

    // Word boundary (default)
    const truncated = result.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.7) {
        return result.substring(0, lastSpace) + ellipsis;
    }

    return truncated + ellipsis;
}

/**
 * Sanitize HTML, removing dangerous tags while preserving safe formatting
 * @param {string} html - HTML to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized HTML
 */
function sanitizeHtml(html, options = {}) {
    if (typeof html !== 'string') return '';

    const {
        allowedTags = ['strong', 'em', 'a', 'br'],
        stripTags = ['script', 'style', 'iframe', 'object', 'embed']
    } = options;

    let result = html;

    // Remove explicitly forbidden tags and their content
    stripTags.forEach(tag => {
        const regex = new RegExp(`<${tag}[^>]*>.*?<\/${tag}>`, 'gis');
        result = result.replace(regex, '');
    });

    // Remove tags not in allowedTags
    const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
    result = result.replace(tagRegex, (match, tagName) => {
        if (allowedTags.includes(tagName.toLowerCase())) {
            // Keep allowed tags, but sanitize attributes for anchors
            if (tagName.toLowerCase() === 'a') {
                const hrefMatch = match.match(/href=["']([^"']+)["']/);
                if (hrefMatch) {
                    return `<a href="${hrefMatch[1]}">`;
                }
                return match.includes('</') ? '</a>' : '<a>';
            }
            return match;
        }
        return '';
    });

    return result;
}

/**
 * Create an excerpt from text content
 * @param {string|Array} content - Text or array of paragraphs
 * @param {Object} options - Excerpt options
 * @returns {string} Excerpt
 */
function createExcerpt(content, options = {}) {
    const {
        maxLength = 150,
        boundary = 'word',
        ellipsis = '...',
        preferFirstSentence = true
    } = options;

    // Convert array to string
    let text = Array.isArray(content) ? content.join(' ') : content;
    if (typeof text !== 'string') return '';

    // Always strip markup for excerpts
    text = stripMarkup(text);

    // Try to get first sentence if preferred and not too long
    if (preferFirstSentence) {
        const firstSentence = text.match(/^[^.!?]+[.!?]/);
        if (firstSentence && firstSentence[0].length <= maxLength * 1.2) {
            return firstSentence[0].trim();
        }
    }

    return truncateText(text, { maxLength, boundary, ellipsis });
}

/**
 * Type handlers for field transformations
 */
const typeHandlers = {
    /**
     * Plain text - strips all markup
     */
    plaintext: {
        transform: (value, options = {}) => {
            if (value === null || value === undefined) return '';

            const text = String(value);
            let result = stripMarkup(text, options);

            if (options.maxLength) {
                result = truncateText(result, {
                    maxLength: options.maxLength,
                    boundary: options.boundary || 'word',
                    ellipsis: options.ellipsis || '...'
                });
            }

            if (options.transform) {
                result = options.transform(result);
            }

            return result;
        },

        validate: (value, rules = {}, context = 'visual-editor') => {
            const errors = [];
            const stripped = stripMarkup(String(value || ''));

            // Only warn in build mode
            if (context === 'build') {
                if (/<[^>]*>/.test(value)) {
                    errors.push({
                        field: rules.fieldName,
                        type: 'markup_detected',
                        message: 'Field contains HTML markup but expects plain text',
                        severity: 'warning',
                        autoFix: true
                    });
                }
            }

            if (rules.required && !stripped) {
                errors.push({
                    field: rules.fieldName,
                    type: 'required',
                    message: 'Required field is missing',
                    severity: 'error',
                    autoFix: false
                });
            }

            if (rules.maxLength && stripped.length > rules.maxLength) {
                errors.push({
                    field: rules.fieldName,
                    type: 'max_length',
                    message: `Text is ${stripped.length} characters (max: ${rules.maxLength})`,
                    severity: context === 'build' ? 'warning' : 'info',
                    autoFix: true
                });
            }

            if (rules.minLength && stripped.length < rules.minLength) {
                errors.push({
                    field: rules.fieldName,
                    type: 'min_length',
                    message: `Text is ${stripped.length} characters (min: ${rules.minLength})`,
                    severity: 'warning',
                    autoFix: false
                });
            }

            return errors;
        }
    },

    /**
     * Rich text - preserves safe HTML, removes dangerous tags
     */
    richtext: {
        transform: (value, options = {}) => {
            if (value === null || value === undefined) return '';

            const text = String(value);
            let result = sanitizeHtml(text, {
                allowedTags: options.allowedTags || ['strong', 'em', 'a', 'br'],
                stripTags: options.stripTags || ['script', 'style', 'iframe']
            });

            if (options.maxLength) {
                // For richtext, truncate but preserve markup
                result = truncateText(result, {
                    maxLength: options.maxLength,
                    boundary: options.boundary || 'word',
                    ellipsis: options.ellipsis || '...',
                    stripMarkup: false
                });
            }

            return result;
        },

        validate: (value, rules = {}, context = 'visual-editor') => {
            const errors = [];

            if (rules.required && !stripMarkup(String(value || ''))) {
                errors.push({
                    field: rules.fieldName,
                    type: 'required',
                    message: 'Required field is missing',
                    severity: 'error',
                    autoFix: false
                });
            }

            return errors;
        }
    },

    /**
     * Excerpt - auto-generates excerpt from content
     */
    excerpt: {
        transform: (value, options = {}) => {
            return createExcerpt(value, {
                maxLength: options.maxLength || 150,
                boundary: options.boundary || 'word',
                ellipsis: options.ellipsis || '...',
                preferFirstSentence: options.preferFirstSentence !== false
            });
        },

        validate: () => [] // Excerpts are auto-generated, no validation needed
    },

    /**
     * Number - parses and formats numbers
     */
    number: {
        transform: (value, options = {}) => {
            const num = parseFloat(value);
            if (isNaN(num)) {
                return options.defaultValue !== undefined ? options.defaultValue : 0;
            }

            if (options.format) {
                // Simple number formatting
                const { decimals, thousands = ',', decimal = '.' } = options.format;

                let result = decimals !== undefined
                    ? num.toFixed(decimals)
                    : String(num);

                if (thousands) {
                    const parts = result.split('.');
                    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
                    result = parts.join(decimal);
                }

                return result;
            }

            return num;
        },

        validate: (value, rules = {}) => {
            const errors = [];
            const num = parseFloat(value);

            if (rules.required && isNaN(num)) {
                errors.push({
                    field: rules.fieldName,
                    type: 'invalid_number',
                    message: 'Value is not a valid number',
                    severity: 'error',
                    autoFix: false
                });
            }

            return errors;
        }
    },

    /**
     * Image - processes image data
     */
    image: {
        transform: (value, options = {}) => {
            if (!value) {
                return options.defaultValue || null;
            }

            // Handle string (URL) or object (full image data)
            if (typeof value === 'string') {
                return {
                    url: value,
                    alt: options.defaultAlt || '',
                    caption: null
                };
            }

            return {
                url: value.url || value.src,
                alt: value.alt || options.defaultAlt || '',
                caption: value.caption || value.title || null,
                width: value.width,
                height: value.height
            };
        },

        validate: (value, rules = {}) => {
            const errors = [];

            if (rules.required && !value) {
                errors.push({
                    field: rules.fieldName,
                    type: 'required',
                    message: 'Required image is missing',
                    severity: 'error',
                    autoFix: false
                });
            }

            return errors;
        }
    },

    /**
     * Link - processes link data
     */
    link: {
        transform: (value, options = {}) => {
            if (!value) {
                return options.defaultValue || null;
            }

            // Handle string (URL) or object (full link data)
            if (typeof value === 'string') {
                return {
                    href: value,
                    label: options.defaultLabel || value,
                    target: value.startsWith('http') ? '_blank' : '_self'
                };
            }

            return {
                href: value.href || value.url,
                label: value.label || value.text || value.href,
                target: value.target || (value.external ? '_blank' : '_self')
            };
        },

        validate: (value, rules = {}) => {
            const errors = [];

            if (rules.required && !value) {
                errors.push({
                    field: rules.fieldName,
                    type: 'required',
                    message: 'Required link is missing',
                    severity: 'error',
                    autoFix: false
                });
            }

            return errors;
        }
    }
};

/**
 * Apply type transformation to a value
 * @param {*} value - Value to transform
 * @param {string} type - Field type
 * @param {Object} options - Type-specific options
 * @returns {*} Transformed value
 */
function applyType(value, type, options = {}) {
    const handler = typeHandlers[type];
    if (!handler) {
        console.warn(`Unknown field type: ${type}`);
        return value;
    }

    return handler.transform(value, options);
}

/**
 * Validate value against type and rules
 * @param {*} value - Value to validate
 * @param {string} type - Field type
 * @param {Object} rules - Validation rules
 * @param {string} context - Execution context (visual-editor or build)
 * @returns {Array} Array of validation errors/warnings
 */
function validateType(value, type, rules = {}, context = 'visual-editor') {
    const handler = typeHandlers[type];
    if (!handler) {
        return [];
    }

    return handler.validate(value, rules, context);
}

export {
    typeHandlers,
    applyType,
    validateType,
    // Export utilities for direct use
    stripMarkup,
    truncateText,
    sanitizeHtml,
    createExcerpt
};

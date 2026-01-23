import { processSequence } from "./processors/sequence.js";
import { processGroups } from "./processors/groups.js";
import * as mappers from "./mappers/index.js";

/**
 * Parse ProseMirror/TipTap content into semantic structure
 * @param {Object} doc - ProseMirror document
 * @param {Object} options - Parsing options
 * @param {boolean} options.parseCodeAsJson - Parse code blocks as JSON. Default: false
 * @returns {Object} Flat content structure with sequence for ordered access
 */
function parseContent(doc, options = {}) {
    // Default options
    const opts = {
        parseCodeAsJson: false,
        ...options,
    };

    // Process sequence (ordered elements)
    const sequence = processSequence(doc, opts);

    // Process groups (semantic structure) - returns flat object
    const groups = processGroups(sequence, opts);

    // Return flat structure with sequence at top level
    return {
        raw: doc,
        sequence,
        ...groups,  // Spread flat content: title, paragraphs, items, etc.
    };
}

export { parseContent, mappers };

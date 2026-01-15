import { processSequence } from "./processors/sequence.js";
import { processGroups } from "./processors/groups.js";
import { processByType } from "./processors/byType.js";
import * as mappers from "./mappers/index.js";

/**
 * Parse ProseMirror/TipTap content into semantic structure
 * @param {Object} doc - ProseMirror document
 * @param {Object} options - Parsing options
 * @param {boolean} options.parseCodeAsJson - Parse code blocks as JSON. Default: false
 * @returns {Object} Parsed content structure
 */
function parseContent(doc, options = {}) {
    // Default options
    const opts = {
        parseCodeAsJson: false,
        ...options,
    };

    // Process content in different ways
    const sequence = processSequence(doc, opts);

    const groups = processGroups(sequence, opts);

    const byType = processByType(sequence);

    return {
        raw: doc,
        sequence,
        groups,
        byType,
    };
}

export { parseContent, mappers };

import { processSequence } from "./processors/sequence.js";
import { processGroups } from "./processors/groups.js";
import { buildDoc } from "./builders/doc.js";

/**
 * Parse ProseMirror/TipTap content into semantic structure
 *
 * This is the PUBLIC entry point for deriving the flat shape, and every
 * consumer calls it: the runtime derives a block's content this way, and an
 * editor drawing a surface over the same document derives it the same way. That
 * both sides run one implementation is what makes their readings agree — so a
 * derivation rule must be reachable from here rather than applied privately by
 * whoever produced the ProseMirror.
 *
 * Nothing derived is stored. This runs JIT on each side, every time, which is
 * also why changing a grouping rule re-reads every document that already
 * exists — see `alwaysItems` below.
 *
 * @param {Object} doc - ProseMirror document
 * @param {Object} options - Parsing options
 * @param {boolean} options.parseCodeAsJson - Parse code blocks as JSON. Default: false
 * @param {boolean} options.alwaysItems - Every heading group becomes an item:
 *   no title promotion, no same-level heading merge. The shape a tagged concept
 *   block (```md:faq) always takes, fixed by its fence. Default: false, and the
 *   default path is pinned by tests/grouping-default-path.test.js.
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

export { parseContent, buildDoc };

/**
 * Flatten a group's nested structure to a flat object
 * @param {Object} group Processed group with { header, body, metadata }
 * @returns {Object} Flat content object
 */
function flattenGroup(group) {
    if (!group) return null;
    const flat = {
        title: group.header.title || '',
        pretitle: group.header.pretitle || '',
        subtitle: group.header.subtitle || '',
        paragraphs: group.body.paragraphs || [],
        links: group.body.links || [],
        images: group.body.images || [],
        icons: group.body.icons || [],
        lists: group.body.lists || [],
        videos: group.body.videos || [],
        insets: group.body.insets || [],
        snippets: group.body.snippets || [],
        data: group.body.data || {},
        quotes: group.body.quotes || [],
        headings: group.body.headings || [],
    };
    // Only attach rare collections when present so we don't pay the cost
    // on every page (math is <1% of content in practice; authors who need
    // ordering should use content.sequence anyway).
    if (group.body.math && group.body.math.length) flat.math = group.body.math;
    if (group.body.tables && group.body.tables.length) flat.tables = group.body.tables;
    return flat;
}

/**
 * Transform a sequence into content groups with semantic structure
 *
 * `options.alwaysItems` makes every group an ITEM: it turns off the two rules
 * that otherwise collapse a short document into a titled main block —
 * title promotion (`identifyMainContent`) and same-level heading merge
 * (`readHeadingGroup`'s Case 3). Used for a tagged concept block, whose shape is
 * fixed by its fence rather than by what it happens to contain.
 *
 * It names a GROUPING BEHAVIOUR, not a concept. Nothing here knows what `faq` or
 * `warning` mean, and nothing should: a framework-side registry of concept names
 * is the failure the whole design avoids.
 *
 * DEFAULT OFF, and that matters more than it looks. This parser runs JIT — at
 * render time and at editor time — and nothing derived is ever stored, so a
 * change to a grouping rule retroactively re-reads every document that already
 * exists. Leaking these suppressions into the default path would silently
 * reshape every section body ever authored.
 * `tests/processors/always-items.test.js` pins the default against that.
 *
 * @param {Array} sequence Flat sequence of elements
 * @param {Object} options Parsing options
 * @param {boolean} [options.alwaysItems] Every group is an item; no main block
 * @returns {Object} Flat content object with items array
 */
function processGroups(sequence, options = {}) {
    // Empty content returns flat empty structure
    if (!sequence.length) {
        return {
            title: '',
            pretitle: '',
            subtitle: '',
            paragraphs: [],
            links: [],
            images: [],
            icons: [],
            lists: [],
            videos: [],
            insets: [],
            snippets: [],
            data: {},
            quotes: [],
            headings: [],
            items: [],
        };
    }

    const groups = splitBySlices(sequence, options);

    // Process each group's structure (still nested internally)
    const processedGroups = groups.map((group) =>
        processGroupContent(group, options)
    );

    // Determine main vs items
    let mainGroup = null;
    let itemGroups = [];

    // Suppression 1 of 2: title promotion. Without it a lone heading+body pair
    // is the whole "main" block and yields NO items — the single-question FAQ,
    // and every callout, would arrive empty.
    const shouldBeMain = options.alwaysItems
        ? false
        : identifyMainContent(processedGroups);
    if (shouldBeMain) {
        mainGroup = processedGroups[0];
        itemGroups = processedGroups.slice(1);
    } else {
        itemGroups = processedGroups;
    }

    // Flatten main content (or return empty flat structure)
    const flatMain = flattenGroup(mainGroup) || {
        title: '',
        pretitle: '',
        subtitle: '',
        paragraphs: [],
        links: [],
        images: [],
        icons: [],
        lists: [],
        videos: [],
        insets: [],
        data: {},
        quotes: [],
        headings: [],
    };

    // Flatten items
    const flatItems = itemGroups.map(flattenGroup);

    return {
        ...flatMain,
        items: flatItems,
    };
}

function splitBySlices(sequence, options = {}) {
    const groups = [];
    let currentGroup = [];

    for (let i = 0; i < sequence.length; i++) {
        const element = sequence[i];

        // 1. Handle Dividers (Explicit Split)
        if (element.type === "divider") {
            // Close current group if it has content
            if (currentGroup.length > 0) {
                groups.push(currentGroup);
                currentGroup = [];
            }
            continue; // Consume the divider (don't add to group)
        }

        // 2. Handle Headings (Semantic Split)
        if (element.type === "heading") {
            // SPECIAL CASE: Banner Image for the whole content
            // If we are at the second element (index 1), and the first element was a banner image,
            // we do NOT close the group. We let the heading merge with the image.
            const isBannerMerge = i === 1 && isBannerImage(sequence, 0);

            // A new headline stack starts a new visual block.
            // If we have gathered content in the current group, close it now.
            if (currentGroup.length > 0 && !isBannerMerge) {
                groups.push(currentGroup);
                currentGroup = [];
            }

            // Consume exactly ONE headline stack (pretitle + title + subtitle
            // lines). A longer contiguous run re-enters here on the next
            // iteration and opens the next group.
            const stack = readStack(sequence, i, options);
            const consumed = Math.max(stack.length, 1);
            currentGroup.push(...sequence.slice(i, i + consumed));

            // Advance the index by the number of headings consumed
            // (Loop increments i by 1, so we add consumed - 1)
            i += consumed - 1;
        } else {
            // 3. Handle Content (Body)
            // Paragraphs, images, lists, etc. just append to the current slice.
            currentGroup.push(element);
        }
    }

    // Push the final group if not empty
    if (currentGroup.length > 0) {
        groups.push(currentGroup);
    }

    return groups;
}

/**
 * A `#>` label line — a heading carrying `role: "pretitle"`. It names the
 * block it opens (or sits in) and never competes for the title slot.
 */
function isLabel(el) {
    return el?.type === "heading" && el.attrs?.role === "pretitle";
}

function isBannerImage(sequence, i) {
    return (
        i === 0 &&
        i + 1 < sequence.length &&
        sequence[i].type === "image" &&
        (sequence[i].role === "banner" || sequence[i + 1].type === "heading")
    );
}

/**
 * Read ONE headline stack from a contiguous heading run — the staircase rule:
 * each heading relates to the one before it. The same size extends the current
 * part; one step smaller is the next line of the headline (the subtitle, then
 * further subtitle lines); anything else — two or more steps down, or a step
 * back up — ends the stack, and the rest of the run starts a new block.
 *
 * Before the title: `#>` label lines, and any smaller headings ascending to a
 * more important one, are the pretitle. A label line anywhere in the stack
 * also names the block — it never competes for the title.
 *
 * `alwaysItems` (a tagged concept block's grouping) suppresses the same-size
 * continuation: two bodiless same-level headings are two ITEMS, not one
 * heading split across visual lines. That suppression must happen HERE, at
 * group formation — no amount of suppressing title promotion downstream can
 * split a group that was never split. Descents still join: a concept-block
 * item keeps its subtitle.
 *
 * @returns {{ pre: Array, title: Array, sub: Array, length: number }}
 *   The slot elements and how many sequence elements the stack consumed.
 */
function readStack(sequence, startIdx, options = {}) {
    const pre = [];
    const title = [];
    const sub = [];
    let i = startIdx;

    // Leading `#>` label lines belong to this block's pretitle.
    while (i < sequence.length && isLabel(sequence[i])) {
        pre.push(sequence[i]);
        i++;
    }

    // Positional pretitle: the title is the FIRST occurrence of the run's most
    // important level; every smaller heading stacked above it joins the
    // pretitle, in whatever order they were written (#### / ### / # and
    // ## / ### / # both give a two-line pretitle). An ascending-only walk
    // read a descending stack as a bodiless headline followed by a bigger
    // heading, which demoted the real title into the items.
    let best = i;
    for (let k = i; k < sequence.length; k++) {
        const el = sequence[k];
        if (el.type !== "heading") break;
        if (isLabel(el)) continue;
        if (el.level < sequence[best].level || isLabel(sequence[best])) best = k;
    }
    while (i < best) {
        pre.push(sequence[i]);
        i++;
    }

    // A label-only stack (labels followed by body, or nothing) is legal: the
    // block has a pretitle and no title.
    if (i >= sequence.length || sequence[i].type !== "heading") {
        return { pre, title, sub, length: i - startIdx };
    }

    title.push(sequence[i]);
    let prevLevel = sequence[i].level;
    let part = title;
    i++;

    while (i < sequence.length && sequence[i].type === "heading") {
        const el = sequence[i];
        if (isLabel(el)) {
            // A label inside the stack still names this block.
            pre.push(el);
            i++;
        } else if (el.level === prevLevel && !options.alwaysItems) {
            part.push(el); // another line of the same part
            i++;
        } else if (el.level === prevLevel + 1) {
            sub.push(el); // the next line of the headline, one step down
            part = sub;
            prevLevel = el.level;
            i++;
        } else {
            break; // two+ steps down, or back up: a new block starts here
        }
    }
    return { pre, title, sub, length: i - startIdx };
}

/** Collapse a slot's texts: none → '', one → string, several → array. */
function flattenSlot(texts) {
    if (texts.length === 0) return "";
    if (texts.length === 1) return texts[0];
    return texts;
}

/**
 * Process a group's content to identify its structure
 */
function processGroupContent(elements, options = {}) {
    const header = {
        pretitle: "",
        title: "",
        subtitle: "",
    };

    const body = {
        images: [],
        icons: [],
        videos: [],
        insets: [],
        snippets: [],
        paragraphs: [],
        links: [],
        lists: [],
        data: {},
        quotes: [],
        headings: [],
        // `math` is lazily added in the math_display case when encountered —
        // avoids allocating an empty array on every group (math is rare; most
        // consumers that care about ordering should use content.sequence).
    };

    const metadata = {
        level: null,
        contentTypes: new Set(),
    };

    if (!elements)
        return {
            header,
            body,
            metadata,
        };

    // The group's leading heading run is its headline stack: read the slots
    // with the same staircase rule that decided the group boundary, so the
    // two walks cannot disagree.
    let start = 0;
    if (elements[0]?.type === "heading") {
        const stack = readStack(elements, 0, options);
        header.pretitle = flattenSlot(stack.pre.map((el) => el.text));
        header.title = flattenSlot(stack.title.map((el) => el.text));
        header.subtitle = flattenSlot(stack.sub.map((el) => el.text));
        metadata.level = stack.title[0]?.level ?? null;
        for (const el of [...stack.pre, ...stack.title, ...stack.sub]) {
            if (el.children && Array.isArray(el.children))
                processInlineElements(el.children, body);
        }
        start = Math.max(stack.length, 1);
    }

    for (let i = start; i < elements.length; i++) {
        const element = elements[i];

        if (element.type === "heading") {
            // Only reachable for nested content (blockquote children, list
            // items), where headings can follow body inside one element
            // array — section content is split into groups before this runs.
            if (element.children && Array.isArray(element.children))
                processInlineElements(element.children, body);
            body.headings.push(element.text);
        } else if (element.type === "list") {
            const listItems = element.children;

            body.lists.push(
                listItems.map((listItem) => processGroupContent(listItem).body)
            );
        } else {
            let preserveProps = {
                ...element.attrs,
            };

            switch (element.type) {
                case "paragraph":
                    if (element.children && Array.isArray(element.children))
                        processInlineElements(element.children, body);

                    if (element.text) body.paragraphs.push(element.text);
                    break;

                case "image":
                    // Check if this image is actually an icon (role="icon" from ![](lu-zap) syntax)
                    if (element.attrs?.role === "icon") {
                        body.icons.push(element.attrs);
                    } else {
                        body.images.push(preserveProps);
                    }
                    break;

                case "video":
                    body.videos.push(preserveProps);
                    break;

                case "link":
                    if (element.children && Array.isArray(element.children))
                        processInlineElements(element.children, body);

                    body.links.push(preserveProps);
                    break;

                case "icon":
                    //Might be string
                    body.icons.push(element.attrs);
                    break;

                case "button":
                    // Map button to link with role
                    body.links.push({
                        href: element.attrs?.href || '',
                        label: element.text || '',
                        role: element.attrs?.variant ? `button-${element.attrs.variant}` : 'button',
                        variant: element.attrs?.variant || 'primary',
                        size: element.attrs?.size,
                        icon: element.attrs?.icon,
                        target: element.attrs?.target,
                        class: element.attrs?.class,
                    });
                    break;

                case "blockquote":
                    // Process blockquote content recursively
                    const quoteContent = processGroupContent(element.children);
                    body.quotes.push(quoteContent.body);
                    break;

                case "concept_block": {
                    // A tagged prose fence lands under its tag, sharing the
                    // namespace tagged DATA blocks use (```yaml:nav also lands
                    // at data[nav]) — one place a component looks, whichever
                    // form the author reached for.
                    //
                    // Both views, because two consumers need different ones and
                    // `parseContent` computes them in one pass anyway. `items`
                    // is what an accordion or a step list renders. `sequence` is
                    // what anything rendering a concept it does not RECOGNIZE
                    // has to use: `items` is a bucketed flattening that discards
                    // ordering, and it collapses to [] exactly where `sequence`
                    // survives — two bodiless headings give items 0, sequence 2.
                    //
                    // `alwaysItems` is hard-coded rather than inherited, and
                    // that is the scoping: a concept block's shape is fixed by
                    // its fence no matter how the surrounding document was
                    // parsed, and the suppressions never reach the default path.
                    const children = element.children || [];
                    body.data[element.tag] = {
                        items: processGroups(children, { alwaysItems: true }).items,
                        sequence: children,
                    };
                    break;
                }

                case "dataBlock":
                    // Pre-parsed structured data from content-reader
                    body.data[element.tag] = element.data;
                    break;

                case "codeBlock":
                    body.snippets.push({
                        language: element.attrs?.language || '',
                        code: typeof element.text === 'string' ? element.text : '',
                    });
                    break;

                case "math":
                    // Block-level math from $$...$$ on its own line or ```math
                    // fence. The mathml string is pre-compiled at parse time;
                    // foundations render it by setting dangerouslySetInnerHTML
                    // on the mathml field. The optional id enables numbered
                    // cross-references (see @uniweb/scholar/math).
                    // For ordered rendering alongside paragraphs, prefer
                    // `content.sequence` — this flat collection is convenience
                    // sugar when order doesn't matter. Allocate lazily so
                    // pages without math pay nothing.
                    //
                    // Inline math doesn't reach the groups walker — it's
                    // wrapped inside paragraph HTML strings — so checking
                    // the `display` flag is unnecessary here. If that ever
                    // changes, gate this branch on `element.display === true`.
                    (body.math ||= []).push({
                        id: element.id || null,
                        latex: element.latex || '',
                        mathml: element.mathml || '',
                    });
                    break;

                case "table":
                    // Lazily attached, like `math`: most content has no table,
                    // and a component that cares about ordering should read
                    // `content.sequence` anyway. Before 2026-07-30 the sequence
                    // did not carry tables at all, so there was nothing here to
                    // collect.
                    (body.tables ||= []).push({
                        rows: element.rows || [],
                        attrs: element.attrs || {},
                    });
                    break;

                case "inset":
                    body.insets.push({ refId: element.refId });
                    break;

                case "form":
                    // Route FormBlock data by the schema id it targets, so it
                    // shares a namespace with tagged markdown data blocks
                    // (```yaml:<id>``` also lands at data[<id>]). When no
                    // schemaId is present (legacy content), fall back to the
                    // literal key "form" — eventual deprecation.
                    {
                        const payload = element.data || element.attrs;
                        const key = element.schemaId || "form";
                        body.data[key] = payload;
                    }
                    break;

                case "card-group":
                    // Map cards to data by type: data.person = [...], data.event = [...]
                    // Each card type becomes a key, with an array of cards of that type
                    (element.cards || []).forEach(card => {
                        const cardType = card.cardType || 'card';
                        if (!body.data[cardType]) body.data[cardType] = [];
                        // Remove cardType from the card object since it's now the key
                        const { cardType: _, ...cardData } = card;
                        body.data[cardType].push(cardData);
                    });
                    break;

                case "document-group":
                    // Map documents to links with role=document
                    element.documents.forEach(doc => {
                        body.links.push({
                            href: doc.href || doc.downloadUrl || '',
                            label: doc.title || '',
                            role: 'document',
                            download: true,
                            preview: doc.coverImg,
                            fileType: doc.fileType,
                        });
                    });
                    break;
            }
        }
    }

    return {
        header,
        body,
        metadata,
    };
}

/**
 * Determine if the first group should be treated as main content
 */
function identifyMainContent(groups) {
    if (groups.length === 0) return false;

    // Single group is main content
    if (groups.length === 1) return true;

    // First group should be more important (lower level) than second to be main
    const first = groups[0].metadata.level;
    const second = groups[1].metadata.level;

    // First group has a heading more important than second → main
    if (first && (!second || first < second)) return true;

    // First group has NO heading (just body content before first heading) → promote to main
    // This prevents empty-titled first items when content precedes headings
    if (!first && second) return true;

    return false;
}

function processInlineElements(children, body) {
    children.forEach((item) => {
        if (item.type === "icon") {
            body.icons.push(item.attrs);
        } else if (item.type === "image") {
            // Inline image inside a paragraph (e.g. `![alt](url)` next to
            // text or icons that didn't qualify for block-level hoisting
            // in content-reader). Mirror the top-level partition:
            // icon-role goes to icons[], everything else to images[].
            // Without this branch, inline images vanish from body.images
            // and components reading `item.images?.[0]` see nothing.
            if (item.attrs?.role === "icon") {
                body.icons.push(item.attrs);
            } else {
                body.images.push(item.attrs);
            }
        } else if (item.type === "video") {
            // Mirrors the top-level `case "video"` partition — an inline
            // `{role=video}` belongs in videos[] for the same reason a hoisted
            // one does.
            body.videos.push(item.attrs);
        } else if (item.type === "link") {
            // Handle inline links extracted from paragraph text nodes
            body.links.push(item.attrs);
        }
    });
}

// `splitBySlices` and `readStack` are exported for `lintContent` (src/lint.js),
// which diagnoses grouping near-misses and must see the SAME walk that decided
// the groups — a private reimplementation there would drift. They are not part
// of the package's public API.
export { processGroups, splitBySlices, readStack };

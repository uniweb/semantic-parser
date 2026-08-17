import { parse as parseYaml } from "yaml";

/**
 * Get code block data - prefers pre-parsed attrs.data, falls back to parsing text
 *
 * Content can come from two sources:
 * 1. Pre-parsed at build time: attrs.data contains parsed JS object
 * 2. Legacy/runtime: text needs to be parsed based on language
 *
 * @param {string} text - Raw code block text
 * @param {Object} attrs - Code block attributes (language, tag, data)
 * @returns {*} Parsed data or raw text
 */
/**
 * HTML-attribute encoding for values placed inside double-quoted
 * attributes. Backslashes and braces (common in LaTeX) pass through
 * unchanged; only the four characters that are unsafe in this context
 * need replacing.
 *
 * @param {string} s
 * @returns {string}
 */
function escapeAttr(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function getCodeBlockData(text, attrs) {
    const { language, tag, data } = attrs || {};

    // Only process tagged blocks
    if (!tag) {
        return text;
    }

    // Prefer pre-parsed data from build time (attrs.data)
    if (data !== undefined) {
        return data;
    }

    // Fallback: parse text at runtime (for backwards compatibility)
    const lang = (language || "").toLowerCase();

    if (lang === "json") {
        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }

    if (lang === "yaml" || lang === "yml") {
        try {
            return parseYaml(text);
        } catch {
            return text;
        }
    }

    // Unknown language - return raw text
    return text;
}

/**
 * Check if an inline node is an icon.
 * TipTap editor uses type "UniwebIcon"; markdown pipeline uses type "image" with role "icon".
 */
function isIconNode(node) {
    return node.type === "UniwebIcon" || (node.type === "image" && node.attrs?.role === "icon");
}

/**
 * Process a ProseMirror/TipTap document into a flat sequence
 * @param {Object} doc ProseMirror document
 * @param {Object} options Parsing options
 * @returns {Array} Sequence of content elements
 */
function processSequence(doc, options = {}) {
    const sequence = [];
    processNode(doc, sequence, options);

    return sequence;
}

function processNode(node, sequence, options) {
    if (node.content && Array.isArray(node.content)) {
        node.content?.forEach((child) => {
            const result = createSequenceElement(child, options);

            if (result) {
                // Handle case where element returns multiple items (e.g., paragraph with only links)
                if (Array.isArray(result)) {
                    sequence.push(...result);
                } else {
                    sequence.push(result);
                }
            }
        });
    }
}

function createSequenceElement(node, options = {}) {
    const attrs = node.attrs;
    const content = node.content;

    const linkVal = isLink(node, options);

    if (linkVal) {
        return {
            type: "link",
            attrs: linkVal, //label, href
        };
    }

    // Check for paragraph containing only multiple links (no other text)
    const multipleLinks = isOnlyLinks(node);
    if (multipleLinks) {
        return multipleLinks; // Returns array of link elements
    }

    const styledLink = isStyledLink(node, options);

    if (styledLink) return styledLink;

    switch (node.type) {
        case "heading":
            return {
                type: "heading",
                level: node.attrs.level,
                text: getTextContent(content, options),
                children: processInlineElements(content, options),
                attrs,
            };

        case "paragraph": {
            let textContent = getTextContent(content, options);

            return {
                type: "paragraph",
                text: textContent,
                children: processInlineElements(content, options),
                attrs,
            };
        }
        case "blockquote":
            return {
                type: "blockquote",
                children: processSequence({ content }, options),
                attrs,
            };

        case "inset_block": {
            // The block form of an inset: a component reference that carries
            // real block content. Its children are processed like a
            // blockquote's — the default branch would flatten them to a text
            // string, which loses the author's prose entirely.
            const { component, ...params } = attrs || {};
            return {
                type: "inset_block",
                component,
                params,
                children: processSequence({ content }, options),
            };
        }

        case "concept_block": {
            // A tagged prose fence (```md:faq). Its body is real block content,
            // recursed like a container's — the default branch would flatten it
            // to a text string and lose the author's prose.
            //
            // No markdown is parsed here and none may ever be: this package
            // depends on `yaml` alone, and reaching for a markdown parser would
            // put content-reader inside the runtime. The reader already built
            // this node; the job here is only to WALK it.
            //
            // `options` rides along so nested content is sequenced under the
            // same options as its parent. (`inset_block` and `blockquote` used
            // to drop it and now do the same — harmless while nothing here read
            // `options`, but an asset inside a blockquote would have lost its
            // resolution template once one did.)
            return {
                type: "concept_block",
                tag: attrs?.tag,
                children: processSequence({ content }, options),
            };
        }

        case "dataBlock":
            // Pre-parsed structured data from content-reader
            return {
                type: "dataBlock",
                data: attrs.data,
                tag: attrs.tag,
            };

        case "codeBlock": {
            const codeText = getTextContent(content, options);
            // Tagged code blocks are semantically data blocks, not code
            if (attrs?.tag) {
                return {
                    type: "dataBlock",
                    tag: attrs.tag,
                    data: getCodeBlockData(codeText, attrs),
                };
            }
            return {
                type: "codeBlock",
                text: codeText,
                attrs,
            };
        }

        case "inset_placeholder":
            return {
                type: "inset",
                refId: attrs.refId,
            };

        case "math_display":
            // Block-level math. The mathml string is pre-compiled at parse
            // time (content-reader) and renders natively via kit's HTML
            // renderers. Foundations can read el.mathml from content.sequence.
            // The optional id enables numbered cross-references via
            // @uniweb/scholar/math's <EquationRef>.
            //
            // Element type is `math` with `display: true`. Inline math
            // (math_inline inside paragraphs) reaches downstream as the
            // same `math` IR node with `display: false`. PM-schema names
            // (math_display / math_inline) stay put — they're the
            // content-writer roundtrip contract.
            return {
                type: "math",
                display: true,
                id: node.attrs?.id || null,
                latex: node.attrs?.latex || "",
                mathml: node.attrs?.mathml || "",
                attrs,
            };
        case "ImageBlock":
            return {
                type: "image",
                attrs: parseImgBlock(attrs, options),
            };
        case "image":
            // `role` decides which content array this lands in — the contract
            // published in docs/reference/content-structure.md ("Media Assets"):
            // icon → icons, video → videos, everything else → images.
            //
            // The video branch was missing until 2026-07-30: every
            // `{role=video}` node ran parseImgBlock, which does not carry
            // poster/autoplay/muted/loop/controls, so the author's declaration
            // was demoted to an image AND its playback attrs were dropped —
            // while the build had already generated a poster for it
            // (@uniweb/build site/assets.js). Note this does NOT route to
            // parseVideoBlock: that reader speaks the editor's dialect
            // (coverImg, info), not the markdown one.
            if (attrs?.role === "video") {
                return {
                    type: "video",
                    attrs: parseMarkdownVideo(attrs, options),
                };
            }
            // Standard ProseMirror image node - resolve attrs the same way as
            // ImageBlock so info.identifier lands as a CDN URL. CLI-deployed
            // content uses this node type; without parseImgBlock the url
            // wouldn't be populated and components render an empty slot.
            return {
                type: "image",
                attrs: parseImgBlock(attrs || {}, options),
            };
        case "Video":
            return {
                type: "video",
                attrs: parseVideoBlock(attrs, options),
            };
        case "bulletList":
        case "orderedList": {
            const listItems = content
                .map((c) =>
                    c.type === "listItem" && c.content ? c.content : null
                )
                .filter(Boolean);

            return {
                type: "list",
                style: node.type === "bulletList" ? "bullet" : "ordered",
                children: listItems.map((listItem) => {
                    return processSequence({
                        content: listItem,
                    });
                }),
                attrs,
            };
        }

        case "table": {
            // Rows of cells, each cell a nested SEQUENCE — the same recursion a
            // blockquote or a list item gets, so a cell may hold anything a
            // block can.
            //
            // Added 2026-07-30. Before this a table fell to the `default:`
            // branch and became `{ type: 'table', content: '' }` — not merely
            // unrendered but DESTROYED: `getTextContent` walks for text nodes
            // and a table's children are rows, so even the cell text came back
            // empty. Every consumer of `content.sequence` therefore lost tables
            // entirely, which read as "the renderer has no table case" and was
            // really the vocabulary not carrying one.
            const rows = (content || [])
                .filter((row) => row.type === "tableRow")
                .map((row) => ({
                    cells: (row.content || [])
                        .filter((cell) => cell.type === "tableCell")
                        .map((cell) => ({
                            children: processSequence({ content: cell.content }, options),
                            header: cell.attrs?.header === true,
                            align: cell.attrs?.align || null,
                            colspan: cell.attrs?.colspan || 1,
                            rowspan: cell.attrs?.rowspan || 1,
                        })),
                }));

            return { type: "table", rows, attrs };
        }

        // `divider` is what content-reader emits; `horizontalRule` and
        // `DividerBlock` are the editor's spellings. All three are one element.
        //
        // The reader's own name was NOT listed here until 2026-07-30 — markdown
        // dividers reached consumers only by falling through `default:`, which
        // happens to produce `{ type: 'divider', content: '' }` and happens to
        // match what everything downstream keys on. It worked by coincidence,
        // and the coincidence would have broken the moment `default:` changed.
        case "divider":
        case "DividerBlock":
        case "horizontalRule":
            return {
                type: "divider",
                attrs,
            };

        // Custom TipTap elements
        case "card-group":
            return {
                type: "card-group",
                cards:
                    node.content
                        ?.filter((c) => c.type === "card" && !c.attrs?.hidden)
                        .map((card) => parseCardBlock(card.attrs)) || [],
            };

        case "document-group":
            return {
                type: "document-group",
                documents:
                    node.content
                        ?.filter((c) => c.type === "document")
                        .map((doc) => parseDocumentBlock(doc.attrs)) || [],
            };

        // The editor renamed this node to `StructuredContent` (2026-07-31,
        // editor-internal). Both are accepted: the new name is what the editor
        // emits now, and the old one still arrives from documents authored
        // before the rename, which the framework never rewrites.
        case "StructuredContent":
        case "FormBlock":
            // Parse form data (can be JSON string or object)
            let formData = attrs?.data;
            if (typeof formData === "string") {
                try {
                    formData = JSON.parse(formData);
                } catch (err) {
                    // Keep as string
                }
            }

            return {
                type: "form",
                schemaId: attrs?.activeSchemaId || null,
                data: formData,
                attrs,
            };

        case "button": {
            let textContent = getTextContent(content, options);

            if (!textContent) return null;

            return {
                type: "button",
                text: textContent,
                children: processInlineElements(content, options),
                attrs,
            };
        }
        case "UniwebIcon":
            return {
                type: "icon",
                attrs: parseUniwebIcon(attrs),
            };
        case "Icon":
            return {
                type: "icon",
                attrs: parseIconBlock(attrs),
            };

        default:
            return {
                type: node.type,
                content: getTextContent(content, options),
            };
    }
}

// Extensions that make a link a download rather than a navigation.
const FILE_LINK_EXTENSIONS = [
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "jpg", "jpeg", "png", "webp", "gif", "svg",
    "mp4", "mp3", "wav", "mov", "zip",
];

/**
 * Find a node's link mark, if it carries one.
 */
function getLinkMark(node) {
    return (node?.marks || []).find((mark) => mark.type === "link") || null;
}

/**
 * Whether two nodes belong to the same link.
 *
 * Marked-up text inside a label (`[read *this*](/x)`) arrives as several
 * adjacent nodes that each carry the same link mark. They are one link and
 * must produce one anchor, not one anchor apiece.
 */
function sameLink(a, b) {
    if (!a || !b) return false;
    return JSON.stringify(a.attrs || {}) === JSON.stringify(b.attrs || {});
}

/**
 * Wrap already-styled inline content in an anchor.
 */
function wrapLink(inner, linkMark) {
    const href = linkMark.attrs.href;
    const target = linkMark.attrs.target || "_self";
    const extension = href.split(".").pop()?.toLowerCase();
    const isFileLink = FILE_LINK_EXTENSIONS.includes(extension);

    return `<a href="${href}" target="${target}"${isFileLink ? " download" : ""}>${inner}</a>`;
}

function getTextContent(content, options = {}) {
    if (!content) return "";

    // Group consecutive nodes that share a link mark, so one link yields one
    // anchor however many nodes its label tokenized into. Everything else is
    // a group of one.
    const groups = [];
    for (const node of content) {
        const link = node?.type === "text" ? getLinkMark(node) : null;
        const last = groups[groups.length - 1];

        if (link && last?.link && sameLink(last.link, link)) {
            last.nodes.push(node);
        } else {
            groups.push({ link, nodes: [node] });
        }
    }

    // Icons are emitted as positional markers that a renderer swaps for a real
    // component (see renderInlineNode). The marker carries the icon's ordinal
    // among the icons of THIS content array, which is the same order
    // processInlineElements() puts them in `children` — so a consumer resolves
    // one with `children.filter(c => c.type === 'icon')[index]`. Referencing by
    // ordinal rather than serializing the attrs keeps an inline `svg` blob out
    // of the text stream and leaves `children` the single source of truth.
    const iconOrdinals = new Map();
    let nextIcon = 0;
    for (const node of content) {
        if (isIconNode(node)) iconOrdinals.set(node, nextIcon++);
    }

    return groups
        .reduce((prev, group) => {
            const inner = group.nodes.reduce(
                (acc, node) => acc + renderInlineNode(node, iconOrdinals),
                "",
            );
            if (!inner && !group.link) return prev;
            return prev + (group.link ? wrapLink(inner, group.link) : inner);
        }, "")
        .trim();
}

/**
 * Render one inline node to HTML, applying every mark EXCEPT link — the
 * anchor is applied per group by getTextContent, since it may span nodes.
 */
function renderInlineNode(curr, iconOrdinals) {
    return [curr]
        .reduce((prev, curr) => {
            const { type, marks = [], text } = curr;

            if (type === "text") {
                let styledText = text || "";

                // Apply marks in order: textStyle, highlight, bold, italic, link
                // This ensures proper nesting

                // textStyle (color)
                if (marks.some((mark) => mark.type === "textStyle")) {
                    const color = marks.find(
                        (mark) => mark.type === "textStyle"
                    )?.attrs?.color;
                    if (color) {
                        styledText = `<span style="color: var(--${color})">${styledText}</span>`;
                    }
                }

                // highlight
                if (marks.some((mark) => mark.type === "highlight")) {
                    styledText = `<span style="background-color: var(--highlight)">${styledText}</span>`;
                }

                // span (bracketed spans with class/id/attributes)
                if (marks.some((mark) => mark.type === "span")) {
                    const spanMark = marks.find((mark) => mark.type === "span");
                    const attrs = spanMark?.attrs || {};
                    const attrParts = [];
                    const styleParts = [];

                    if (attrs.class) attrParts.push(`class="${attrs.class}"`);
                    if (attrs.id) attrParts.push(`id="${attrs.id}"`);

                    for (const [key, value] of Object.entries(attrs)) {
                        if (key === 'class' || key === 'id') continue;
                        // Convert color/bg to inline styles
                        if (key === 'color') {
                            styleParts.push(`color: ${value}`);
                        } else if (key === 'bg') {
                            styleParts.push(`background: ${value}`);
                        } else {
                            attrParts.push(`${key}="${value}"`);
                        }
                    }

                    if (styleParts.length > 0) {
                        attrParts.push(`style="${styleParts.join('; ')}"`)
                    }

                    const attrString = attrParts.length > 0 ? ` ${attrParts.join(' ')}` : '';
                    styledText = `<span${attrString}>${styledText}</span>`;
                }

                // code — a bare <code>, styled by the theme rather than here.
                // The mark was previously dropped, so inline code rendered as
                // ordinary prose with no way for a foundation to tell it apart.
                if (marks.some((mark) => mark.type === "code")) {
                    styledText = `<code>${styledText}</code>`;
                }

                // bold
                if (marks.some((mark) => mark.type === "bold")) {
                    styledText = `<strong>${styledText}</strong>`;
                }

                // italic
                if (marks.some((mark) => mark.type === "italic")) {
                    styledText = `<em>${styledText}</em>`;
                }

                // The link mark is deliberately NOT applied here — it is the
                // outermost wrapper and may span several nodes, so
                // getTextContent applies it once per group.

                return prev + styledText;
            } else if (type === "math_inline") {
                // Inline math is a non-text inline atom. The mathml is
                // pre-compiled at parse time (content-reader) and rides
                // inline so kit's Text (dangerouslySetInnerHTML) renders
                // it natively in the browser. Wrapping in a span carries
                // the LaTeX source as `data-latex` so Press's print
                // adapters (typst, latex, etc.) have a structured handle
                // when their Paragraph builder walks the styled string.
                // The wrapper is visually invisible; the inner <math>
                // still renders as MathML in the browser.
                const latex = escapeAttr(curr.attrs?.latex || "");
                const mathml = curr.attrs?.mathml || "";
                return (
                    prev +
                    `<span data-type="math" data-latex="${latex}" data-display="false">${mathml}</span>`
                );
            } else if (type === "inset_placeholder") {
                // Inline inset (e.g. a `[@key]{...}` cite). Emit a marker
                // tag the renderer can split on; the actual inset is
                // rendered via React from `block.getInset(refId)`. The
                // paragraph's `children` array also carries an ordered
                // record of inset entries (see processInlineElements) so
                // consumers that don't want to substring-walk the HTML
                // have an alternative path.
                const refId = curr.attrs?.refId;
                if (!refId) return prev;
                return prev + `<uniweb-inset data-ref-id="${refId}"></uniweb-inset>`;
            } else if (type === "hardBreak") {
                return prev + "<br>";
            } else if (isIconNode(curr)) {
                // An icon sitting IN the prose — `Click the ![](lu-save) button`.
                // It rides as a positional marker for the same reason an inline
                // inset does: the paragraph's text is an HTML string, and an
                // icon needs a component (kit's <Icon>, which resolves the
                // library+name against the icon CDN at render time).
                //
                // Until 2026-08-12 this fell through to the catch-all below and
                // the icon vanished — the text kept a gap where it had been, the
                // entry stayed in `children` and in `content.icons`, and nothing
                // put it back. Every other inline atom (math, insets) already
                // had a marker; this was the one that did not.
                const index = iconOrdinals?.get(curr);
                if (index === undefined) return prev;
                return prev + `<uniweb-icon data-index="${index}"></uniweb-icon>`;
            } else {
                // console.warn(`unhandled text content type: ${type}`, curr);
                return prev;
            }
        }, "");
}

function processInlineElements(content, options = {}) {
    if (!content) return [];

    const items = [];

    for (const item of content) {
        if (isIconNode(item)) {
            items.push({
                type: "icon",
                attrs: parseUniwebIcon(item.attrs),
            });
        } else if (item.type === "image" || item.type === "ImageBlock") {
            // A media node that stayed inside its paragraph — content-reader
            // hoists a standalone one to the document root, but an image sitting
            // beside text does not qualify (parser/block.js `isBlockEligible`).
            //
            // Without this branch such a node reached NOTHING: getTextContent
            // skips it, so it was absent from the paragraph's `text`, absent
            // from `children`, and absent from `body.images` — the author's
            // image silently deleted. groups.js has carried the receiving
            // branch (and a comment describing exactly this failure) since it
            // was written, but nothing ever emitted the item it reads.
            const isVideo = item.attrs?.role === "video";
            items.push({
                type: isVideo ? "video" : "image",
                attrs: isVideo
                    ? parseMarkdownVideo(item.attrs, options)
                    : parseImgBlock(item.attrs || {}, options),
            });
        } else if (item.type === "math-inline" || item.type === "math_inline") {
            items.push(item);
        } else if (item.type === "inset_placeholder") {
            // Inline inset (e.g., a `[@key]{...}` cite or a mid-prose
            // visual inset). The Render path looks the actual block up
            // via block.getInset(refId); we just carry the marker here so
            // its position in the text flow is preserved.
            items.push({
                type: "inset",
                refId: item.attrs?.refId,
                embedKind: item.attrs?.embedKind || "visual",
            });
        } else if (item.type === "text" && item.marks) {
            // Extract links from text nodes with link marks
            const linkMark = item.marks.find((m) => m.type === "link");
            if (linkMark) {
                items.push({
                    type: "link",
                    attrs: {
                        ...linkMark.attrs,  // Preserve all link attributes (role, target, etc.)
                        label: item.text || "",
                    },
                });
            }
        }
    }

    return items;
}

/**
 * Resolve a STORE-HELD asset (`assetId` + `assetExt`) through the host's
 * template — the current mechanism, and the one to reach for.
 *
 * The host declares `config.assets.url` on the published payload; the runtime
 * hands it here as `options.assets.url`. We substitute `{id}` and `{ext}` and
 * do nothing else: the template names a host and carries the store's whole path
 * layout, so a framework package never composes a serve location or guesses an
 * origin — a host may move its assets without a framework release.
 *
 * ⛔ Three ways this returns '' — "unresolved", never a guess:
 *   - **no template** (the host declared none) — absent ⇒ absent
 *   - **an unknown placeholder** — never emit a half-substituted URL
 *   - **`{ext}` with no `assetExt`** — `base.` is a broken URL that reads like
 *     a typo rather than a missing field
 *
 * Callers treat '' as "fall through to the next reference form", which is what
 * makes an id-bearing node safe to write before any deployment emits a template.
 *
 * @param {string} assetId  - the store's opaque id (backend mints a sha256)
 * @param {string} assetExt - the extension, minted separately (never derived
 *                            from the id, which carries no extension)
 * @param {string} template - `config.assets.url`, e.g. `https://cdn/x/{id}/base.{ext}`
 * @returns {string} the resolved URL, or '' when it cannot be resolved
 */
function resolveAssetUrl(assetId, assetExt, template) {
    if (!assetId || typeof assetId !== "string") return "";
    if (!template || typeof template !== "string") return "";
    let resolvable = true;
    const url = template.replace(/\{(\w+)\}/g, (match, name) => {
        if (name === "id") return assetId;
        if (name === "ext" && assetExt) return assetExt;
        resolvable = false;
        return match;
    });
    return resolvable ? url : "";
}

/** `resolveAssetUrl` against a node's attrs + the parse options. */
function assetUrlFromAttrs(attrs, options) {
    return resolveAssetUrl(attrs?.assetId, attrs?.assetExt, options?.assets?.url);
}

// ⛔ LEGACY BELOW — the PHP-estate identifier path. Do not extend it.
//
// `{version}/{filename}` identifiers have no current producer — the CLI emits
// `src`, and editors store the URL their host hands them. Only content authored
// against the original hosted service still carries one, and the hardcoded host
// below cannot be correct for any other deployment: the CLI can be pointed at
// any host. New references use `assetId`/`assetExt` above.
const ASSET_BASE_URL = "https://assets.uniweb.app/";

/**
 * Resolve an asset identifier ({version}/{filename}) to a direct URL.
 * Assets are hosted at assets.uniweb.app under dist/{version}/base.{ext}.
 */
function resolveAssetIdentifier(identifier) {
    if (!identifier || typeof identifier !== "string") return "";
    // ⛔ An identifier that is ALREADY a URL or a rooted path is not an
    // identifier — it is a serve URL sitting in the identifier slot, and it is
    // usable exactly as it stands. Composing it against the legacy base
    // destroys it: `split("/")` on `/gateway/asset/dist/{id}/base.png` takes
    // `""` as the version and `"gateway"` as the filename, yielding
    // `https://assets.uniweb.app/dist//base.gateway` — not a 404 and not a
    // validation failure, a URL-shaped string that renders a broken image and
    // reads like a missing file.
    //
    // The legacy grammar is `{version}/{filename}` with no leading slash, so
    // nothing legitimate is caught here. Passing it through is not constructing
    // a serve location: it is declining to construct one over a value that is
    // already an address. (Measured 2026-08-17 against a real producer.)
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(identifier)) return identifier;
    const [version, filename] = identifier.split("/");
    if (!filename) return "";
    const ext = filename.substring(filename.lastIndexOf(".") + 1);
    return `${ASSET_BASE_URL}dist/${version}/base.${ext}`;
}

function makeAssetUrl(info) {
    const src = info?.src || info?.url || "";
    if (src) return src;
    if (info?.identifier) return resolveAssetIdentifier(info.identifier);
    return "";
}

function parseCardBlock(itemAttrs) {
    const { address, ...others } = itemAttrs;

    let parsedAddress = null;

    try {
        if (address) {
            parsedAddress = JSON.parse(address);
        }
    } catch {}

    const { coverImg = null, icon } = others;

    if (icon) {
        others.icon = parseUniwebIcon(icon);
    }

    return {
        ...others,
        address: parsedAddress,
        coverImg: makeAssetUrl(coverImg),
    };
}

function parseDocumentBlock(itemAttrs) {
    const { src, info = {}, coverImg = null, ...others } = itemAttrs;

    let ele = {
        ...others,
        coverImg: makeAssetUrl(coverImg),
    };

    if (src) {
        ele.href = src;
    } else {
        const { identifier = "" } = info;

        if (identifier) {
            ele.downloadUrl = resolveAssetIdentifier(identifier);
        }
    }

    return ele;
}

function parseUniwebIcon(itemAttrs) {
    const { svg, url, src, size, color, preserveColors, href, target, library, name } = itemAttrs || {};

    // Build object with only defined fields — icon source varies:
    // TipTap editor: svg/url (resolved inline)
    // Markdown pipeline: library + name (resolved at runtime via CDN)
    //                    OR a file, which arrives as `src`
    const icon = {};
    if (svg) icon.svg = svg;
    // Standard ProseMirror `image` nodes use `src`; the editor's `UniwebIcon`
    // uses `url`. Honor either, exactly as parseImgBlock does below — a
    // file-sourced icon is authored `![Logo](icon:./logo.svg)` or
    // `![Logo](./logo.svg){role=icon}` (both documented in AGENTS.md and
    // docs/reference/content-structure.md), and reaches here as `src` with no
    // library/name. Until 2026-07-30 this reader dropped it, so every
    // documented file-sourced icon delivered `{}` and rendered nothing.
    // `url` is the key kit's <Icon> fetches from.
    if (url || src) icon.url = url || src;
    if (size) icon.size = size;
    if (color) icon.color = color;
    if (preserveColors) icon.preserveColors = preserveColors;
    if (href) icon.href = href;
    if (target) icon.target = target;
    // The editor carries the family inside `name` as `family:id`; the markdown
    // pipeline carries them separately. Normalize to the separate form, which
    // is what `<Icon library name />` consumes.
    let resolvedLibrary = library;
    let resolvedName = name;
    if (!resolvedLibrary && typeof name === "string" && name.includes(":")) {
        const [family, ...rest] = name.split(":");
        resolvedLibrary = family;
        resolvedName = rest.join(":");
    }
    if (resolvedLibrary) icon.library = resolvedLibrary;
    if (resolvedName) icon.name = resolvedName;

    return icon;
}

// The editor's `Icon` node carries an inline SVG blob plus a theme. Return an
// ATTRS OBJECT, like every other parser in this file — not the bare `svg`
// string it used to return.
//
// The string form was a live bug, not just an inconsistency: kit renders a
// sequence icon with `<Icon {...element.attrs} />` (styled/Prose/index.jsx),
// and spreading a string yields indexed character props — `{0:'<', 1:'s', …}`
// — so the icon rendered as nothing and React saw a wall of unknown props. It
// failed silently because `attrs.svg` on a string is `undefined`, never an
// error.
//
// Keys are omitted when absent so a consumer can distinguish "not provided"
// from "empty", matching parseUniwebIcon's shape above.
function parseIconBlock(itemAttrs) {
    const { svg, theme } = itemAttrs || {};

    const icon = {};
    if (svg) icon.svg = svg;
    if (theme) icon.theme = theme;

    return icon;
}

function parseImgBlock(itemAttrs, options) {
    let {
        info: imgInfo,
        targetId,
        caption = "",
        direction,
        filter,
        alt = "",
        src,
        url,
        href = "",
        target = "",
        theme,
        role,
        credit = "",
        id, // {#fig-id} cross-reference label — preserved so Press
            // adapters can emit \label{id} (LaTeX) / <id> (Typst).
        // ── Markdown-authored attributes ────────────────────────────────
        // This function was written for the EDITOR's `ImageBlock` node and
        // later reused for the markdown `image` node (see `case "image"`), so
        // its vocabulary is the editor's: contentType, direction, filter,
        // theme, credit. Everything markdown declares and the editor does not
        // was therefore tokenized, declared, and then dropped one layer before
        // delivery — the published "Image Attributes" table
        // (docs/reference/content-structure.md) reached no component, and
        // neither did the `role=pdf` set added 2026-07-29 for the editor's
        // `document` fold-in. Carried 2026-07-30.
        width,
        height,
        loading,
        fit,
        position,
        preview,     // role=pdf — the preview image
        author,      // role=pdf — resource metadata, rendered beside the preview
        description, // role=pdf — describes the RESOURCE, not the image (≠ alt)
    } = itemAttrs;

    let { contentType, viewType, contentId, identifier } = imgInfo || {};

    const sizes = {
        center: "basic",
        wide: "lg",
        fill: "full",
    };

    caption = stripTags(caption);

    // Reference precedence. Standard ProseMirror `image` nodes use `src`; the
    // custom `ImageBlock` node uses `url`. Honor either so callers don't have to
    // pre-normalize.
    //
    // ⭐ A store-held asset (`assetId`) wins WHEN IT RESOLVES — not merely when
    // it is present. That distinction is the whole reason a producer can write
    // `assetId` alongside `src` before any deployment declares
    // `config.assets.url`: until one does, resolution yields '' and the node
    // renders through `src` exactly as it does today. Content written now stays
    // correct whichever order the halves arrive in.
    //
    // `identifier` is the LEGACY estate path and keeps its old precedence over a
    // stale `src`.
    const assetUrl = assetUrlFromAttrs(itemAttrs, options);
    if (assetUrl) {
        url = assetUrl;
    } else if (identifier) {
        url = makeAssetUrl(imgInfo);
    } else if (!url && src) {
        url = src;
    }

    return {
        contentType,
        viewType,
        contentId: targetId || contentId,
        url,
        value: identifier || "",
        alt: alt || caption,
        caption,
        direction,
        filter,
        imgPos: direction === "left" || direction === "right" ? direction : "",
        // NOTE: `size` here is the direction-derived LAYOUT size
        // (basic/lg/full), not the author's `{size=…}` — that attribute is
        // icon-only and is read by parseUniwebIcon. Do not wire `{size=…}`
        // through here; the two meanings collide on one key.
        size: sizes[direction] || "basic",
        href,
        target,
        theme,
        role,
        credit,
        id: id || undefined,
        // Omitted when absent, so an existing consumer sees no new empty keys.
        ...(width !== undefined && width !== null && { width }),
        ...(height !== undefined && height !== null && { height }),
        ...(loading && { loading }),
        ...(fit && { fit }),
        ...(position && { position }),
        ...(preview && { preview }),
        ...(author && { author }),
        ...(description && { description }),
    };
}

// A video authored in markdown: `![alt](./demo.mp4){role=video …}`.
//
// Distinct from parseVideoBlock below, which reads the EDITOR's `Video` node
// (`coverImg`, `info`). The two surfaces name the same concepts differently and
// collapsing them would drop one side's spelling; this reader carries the
// attribute set that docs/reference/content-structure.md publishes for the
// video role, and the shape it documents: `{ src, href, target }` plus the
// playback flags.
function parseMarkdownVideo(itemAttrs, options) {
    const {
        src,
        url,
        info,
        poster,
        alt = "",
        caption = "",
        autoplay,
        muted,
        loop,
        controls,
        href = "",
        target = "",
        role,
        id, // {#fig-id} cross-reference label, same as parseImgBlock
    } = itemAttrs || {};

    // Reference precedence, now genuinely identical to parseImgBlock: a
    // resolvable store-held asset, then the legacy identifier, then the authored
    // src/url.
    //
    // ⚠️ The comment here used to claim identifier-precedence "matching
    // parseImgBlock" while the code did the opposite — it passed `src` INTO
    // `makeAssetUrl`, which returns a src/url before it ever looks at
    // `identifier`. So image and video resolved differently for years and the
    // comment asserted they did not. Aligned to the documented intent (2026-08-17).
    const assetUrl = assetUrlFromAttrs(itemAttrs, options);
    const video = {
        src: assetUrl || makeAssetUrl(info) || url || src || "",
        alt,
        caption: stripTags(caption),
        role,
        href,
        target,
    };

    // Playback attributes are omitted rather than defaulted: a component can
    // then tell "the author said nothing" from "the author said false", and
    // kit's <Media> supplies its own defaults (controls on, the rest off).
    if (poster) video.poster = poster;
    if (autoplay !== undefined) video.autoplay = autoplay;
    if (muted !== undefined) video.muted = muted;
    if (loop !== undefined) video.loop = loop;
    if (controls !== undefined) video.controls = controls;
    if (id) video.id = id;

    return video;
}

function parseVideoBlock(itemAttrs, options) {
    let {
        src,
        caption = "",
        direction,
        info = {},
        coverImg = {},
        alt,
        href = "",
        target = "",
    } = itemAttrs;

    // Same precedence as parseImgBlock / parseMarkdownVideo: a resolvable
    // store-held asset, then the legacy identifier, then the authored src.
    const video = assetUrlFromAttrs(itemAttrs, options) || makeAssetUrl(info) || src || "";

    return {
        src: video,
        caption,
        direction,
        coverImg: makeAssetUrl(coverImg),
        alt,
        href,
        target,
    };
}

function stripTags(htmlString) {
    if (!htmlString || typeof htmlString !== "string") return "";

    // Remove HTML tags using regular expression.
    const plainString = htmlString.replace(/<[^>]*>/g, "");

    // Decode the HTML entity subset citestyle / content-reader / kit emit.
    // The previous DOMParser-based path covered every entity in the spec,
    // but DOMParser is browser-only and crashes Node SSR (which the
    // unipress compile pipeline runs in). The regex below covers the
    // entities that actually appear in this codebase's emitted HTML.
    return plainString
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function isLink(item, options = {}) {
    // Detect paragraphs/headings that are semantically "just a link"
    // (single link text, possibly with decorative icons)
    //
    // For single-link paragraphs, the icon-link association is unambiguous:
    // - Icons before the link text → iconBefore
    // - Icons after the link text → iconAfter
    //
    // This supports natural content authoring: insert icon, type link text, add href
    if (["paragraph", "heading"].includes(item.type)) {
        const originalContent = item?.content || [];

        // Filter out icons and whitespace to check for single link
        const textContent = originalContent.filter((c) => {
            if (isIconNode(c)) {
                return false;
            } else if (c.type === "text") {
                return (c.text || "").trim() !== "";
            }
            return true;
        });

        if (textContent.length === 1) {
            let contentItem = textContent[0];
            let marks = contentItem?.marks || [];

            for (let l = 0; l < marks.length; l++) {
                let mark = marks[l];

                if (mark?.type === "link") {
                    // Find the position of the link text in the original content
                    const linkIndex = originalContent.findIndex(
                        (c) => c.type === "text" && c.text === contentItem.text
                    );

                    // Collect icons before and after the link text
                    let iconBefore = null;
                    let iconAfter = null;

                    for (let i = 0; i < originalContent.length; i++) {
                        if (isIconNode(originalContent[i])) {
                            const iconAttrs = parseUniwebIcon(originalContent[i].attrs);
                            if (i < linkIndex) {
                                // Take the last icon before the link
                                iconBefore = iconAttrs;
                            } else if (i > linkIndex) {
                                // Take the first icon after the link
                                if (!iconAfter) iconAfter = iconAttrs;
                            }
                        }
                    }

                    return {
                        ...mark?.attrs,  // Preserve all link attributes (role, target, etc.)
                        label: contentItem?.text || "",
                        iconBefore,
                        iconAfter,
                        // Preserve all inline elements for advanced rendering
                        children: processInlineElements(originalContent, options),
                    };
                }
            }
        }
    }

    return false;
}

/**
 * Check if a paragraph contains ONLY links (multiple links, no other text)
 * If so, return array of link data to be added to sequence separately.
 *
 * This handles the common pattern of writing links on consecutive lines:
 * ```
 * [Privacy Policy](/privacy)
 * [Terms of Service](/terms)
 * ```
 * Markdown treats these as a single paragraph, but semantically they're separate links.
 *
 * @param {Object} item - Sequence item (paragraph)
 * @returns {Array|false} Array of link objects or false
 */
function isOnlyLinks(item) {
    if (item.type !== "paragraph") return false;

    const content = item?.content || [];
    if (!content.length) return false;

    // Filter to get only significant content (no icons, no whitespace)
    const textContent = content.filter((c) => {
        if (isIconNode(c)) return false;
        if (c.type === "text" && !(c.text || "").trim()) return false;
        return true;
    });

    if (textContent.length < 2) return false; // Single link handled by isLink

    // Check if ALL remaining content items are text nodes with link marks
    const allLinks = textContent.every((c) => {
        if (c.type !== "text") return false;
        const hasLinkMark = c.marks?.some((m) => m.type === "link");
        return hasLinkMark;
    });

    if (!allLinks) return false;

    // Extract links with all their attributes
    // Icons in this paragraph go to body.icons separately (no association)
    return textContent.map((c) => {
        const linkMark = c.marks.find((m) => m.type === "link");
        return {
            type: "link",
            attrs: {
                ...linkMark?.attrs,  // Preserve all link attributes (role, target, etc.)
                label: c.text || "",
            },
        };
    });
}

// method to check if given item has multiple content parts and each of them has the same link attrs with different inline style (plain, em, strong, u)
// if so, it will return the link attrs and all the content parts whose link mark has been removed
// warning: This method will not work if the any of the content parts are not link marks
function isStyledLink(item, options = {}) {
    if (!["paragraph", "heading"].includes(item.type)) return false;

    let content = item?.content || [];

    if (!content.length) return false;

    content = content.filter((c) => {
        if (isIconNode(c)) {
            return false;
        }

        return true;
    });

    // check if all content items have the same link mark
    let firstLinkMark = content[0]?.marks?.find(
        (mark) => mark.type === "link" && mark.attrs
    );
    if (!firstLinkMark) return false;
    if (
        !content.every(
            (c) =>
                c?.marks?.some(
                    (mark) =>
                        mark.type === "link" &&
                        mark.attrs?.href === firstLinkMark.attrs?.href
                ) || false
        )
    )
        return false;

    const { href, target } = firstLinkMark.attrs;

    const cleanedContent = content.map((c) => {
        // remove link marks from content items
        const cleanedMarks =
            c.marks?.filter((mark) => mark.type !== "link") || [];
        return {
            ...c,
            marks: cleanedMarks,
        };
    });

    let textContent = getTextContent(cleanedContent);

    if (!textContent) return false;

    return {
        type: "paragraph",
        children: processInlineElements(item.content, options),
        text: `<a target="${target}" href="${href}">${textContent}</a>`,
        attrs: item.attrs,
    };
}

export { processSequence, resolveAssetUrl };

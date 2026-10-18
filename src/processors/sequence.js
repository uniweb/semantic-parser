import { mimeFor, fileNameOf } from "../utils/mime.js";
import {
    escapeText,
    escapeAttribute as escapeAttr,
    sanitizeMathML,
    isSafeLink,
    isLinkTarget,
    isStyleName,
    isCssColor,
} from "../sanitize.js";

// ⭐ A text node holds TEXT. Every string this file builds for kit's HTML
// renderers escapes it, and every attribute value, so content cannot carry a
// tag, a handler or a script URL into a page. The only markup that passes is
// rebuilt from an allowlist: a math node's MathML and an icon's SVG
// (`../sanitize.js`). ⛔ Until 2026-10-14 text was pasted in as stored, on the
// rule that a text node held HTML — so `<img src=x onerror=…>` written in
// content ran on the published page, and `if a<b then` showed as `if a`.

/** Check if an inline node is an icon: an `image` with role "icon". */
function isIconNode(node) {
    return node.type === "image" && node.attrs?.role === "icon";
}

/**
 * Is an inline node a picture — an `image` that is not an icon, a video or a
 * file? These are the nodes processInlineElements() delivers as `image`
 * children, so the marker's ordinal (getTextContent) counts exactly them.
 */
function isInlinePicture(node) {
    if (node?.type !== "image" || isIconNode(node)) return false;
    const role = node.attrs?.role;
    return role !== "video" && role !== "pdf";
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

    // A link whose URL may not be followed is not a link: the paragraph falls
    // through to ordinary text, where `anchor` leaves its label unlinked.
    const linkVal = isLink(node, options);

    if (linkVal && isSafeLink(linkVal.href)) {
        return {
            type: "link",
            attrs: linkVal, //label, href
        };
    }

    // Check for paragraph containing only multiple links (no other text)
    const multipleLinks = isOnlyLinks(node);
    if (multipleLinks && multipleLinks.every((l) => isSafeLink(l.attrs?.href))) {
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
            // parses NOTHING and has no parser dependency at all, and reaching
            // for a markdown parser would put content-reader inside the
            // runtime. The reader already built this node; the job here is only
            // to WALK it.
            //
            // `options` rides along so nested content is sequenced under the
            // same options as its parent. (`inset_block` and `blockquote` used
            // to drop it and now do the same — harmless while nothing here read
            // `options`, but an asset inside a blockquote would have lost its
            // resolution pattern once one did.)
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
            // Tagged code blocks are semantically data blocks, not code — the
            // tag is what routes them to `data[tag]`, so the routing holds even
            // though the payload here is raw text.
            //
            // ⛔ NOTHING IS PARSED HERE, and nothing may be. A tagged block the
            // reader could parse arrives as a `dataBlock` carrying `attrs.data`
            // (the case above); content-reader emits THIS shape only when
            // `parseCodeBlockData` already returned null — i.e. the text is not
            // valid JSON or YAML. Re-running a parser on it in the browser
            // cannot succeed, and it used to cost every site the whole `yaml`
            // package: 98 KB minified, ~29 KB gzip, pinned into the bundle by a
            // static import that no bundler could shake. Removed 2026-09-01.
            if (attrs?.tag) {
                return {
                    type: "dataBlock",
                    tag: attrs.tag,
                    data: codeText,
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
                mathml: sanitizeMathML(node.attrs?.mathml || ""),
                attrs,
            };
        case "image":
            // `role` decides which content array this lands in — the contract
            // published in docs/reference/content-structure.md ("Media Assets"):
            // icon → icons, video → videos, pdf → documents, everything else →
            // images.
            //
            // A document is stored as this node, as a video is, and delivered as
            // a kind of its own (`parseMarkdownDocument`). Until 2026-09-29 it
            // landed in `images`, drawn as an image of the file, while the
            // runtime had guaranteed an empty `content.documents` since January.
            if (attrs?.role === "pdf") {
                return {
                    type: "document",
                    attrs: parseMarkdownDocument(attrs, options),
                };
            }
            //
            // The video branch was missing until 2026-07-30: every
            // `{role=video}` node ran parseImgBlock, which does not carry
            // poster/autoplay/muted/loop/controls, so the author's declaration
            // was demoted to an image AND its playback attrs were dropped —
            // while the build had already generated a poster for it
            // (@uniweb/build site/assets.js).
            if (attrs?.role === "video") {
                return {
                    type: "video",
                    attrs: parseMarkdownVideo(attrs, options),
                };
            }
            // Standard ProseMirror image node - read through parseImgBlock, so
            // its address lands in `url`. Without parseImgBlock the url
            // wouldn't be populated and components render an empty slot.
            return {
                type: "image",
                attrs: parseImgBlock(attrs || {}, options),
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

        // The reader's own name was NOT listed here until 2026-07-30 — markdown
        // dividers reached consumers only by falling through `default:`, which
        // happens to produce `{ type: 'divider', content: '' }` and happens to
        // match what everything downstream keys on. It worked by coincidence,
        // and the coincidence would have broken the moment `default:` changed.
        //
        // ⭐ The vocabulary's names are the only ones read. ⛔ Until 2026-10-18 the
        // editor's spellings were read too: `DividerBlock` and `horizontalRule` as
        // a divider, and its form node — `StructuredContent`, and `FormBlock`, its
        // name before 2026-07-31 — as a `form` element whose data landed at
        // `content.data[<schema id>]`. The editor writes `divider` and `dataBlock`
        // itself now, and no writer produces the others, as none does its
        // `card-group`, `document-group`, `ImageBlock`, `Video`, `UniwebIcon`,
        // `Icon` and `button` nodes.
        case "divider":
            return {
                type: "divider",
                attrs,
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
 * A text's link, if it carries one: its `link` mark, or its `button` mark read
 * as a link whose `role` is `button` — a button is a link, with a hint for how
 * a component may draw it (`[Go](/x){button}`, documented in
 * docs/reference/content-structure.md). ⛔ Until 2026-10-14 nothing here read
 * the `button` mark: its label reached the page as plain text and the link was
 * lost, wherever it sat.
 */
function linkMarkOf(marks) {
    for (const mark of marks || []) {
        if (mark?.type === "link") return mark;
        if (mark?.type === "button") {
            return { type: "link", attrs: { ...mark.attrs, role: mark.attrs?.role ?? "button" } };
        }
    }
    return null;
}

/**
 * Find a node's link mark, if it carries one.
 */
function getLinkMark(node) {
    return linkMarkOf(node?.marks);
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
    return anchor(linkMark.attrs.href, linkMark.attrs.target, inner);
}

/**
 * An anchor around already-escaped inner HTML. A link whose URL may not be
 * followed (`javascript:`, `data:`, any scheme `isSafeLink` refuses) is not
 * drawn as a link: its label stays, as text.
 */
function anchor(href, target, inner) {
    if (typeof href !== "string" || !isSafeLink(href)) return inner;
    const t = isLinkTarget(target) ? target : "_self";
    const extension = href.split(".").pop()?.toLowerCase();
    const isFileLink = FILE_LINK_EXTENSIONS.includes(extension);

    return `<a href="${escapeAttr(href)}" target="${t}"${isFileLink ? " download" : ""}>${inner}</a>`;
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
    //
    // A picture beside text is marked the same way, by its ordinal among the
    // pictures of this array — `children.filter(c => c.type === 'image')[index]`.
    const iconOrdinals = new Map();
    const pictureOrdinals = new Map();
    let nextIcon = 0;
    let nextPicture = 0;
    for (const node of content) {
        if (isIconNode(node)) iconOrdinals.set(node, nextIcon++);
        else if (isInlinePicture(node)) pictureOrdinals.set(node, nextPicture++);
    }

    return groups
        .reduce((prev, group) => {
            const inner = group.nodes.reduce(
                (acc, node) => acc + renderInlineNode(node, iconOrdinals, pictureOrdinals),
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
function renderInlineNode(curr, iconOrdinals, pictureOrdinals) {
    return [curr]
        .reduce((prev, curr) => {
            const { type, marks = [], text } = curr;

            if (type === "text") {
                let styledText = escapeText(text || "");

                // Apply marks in order: span, code, bold, italic — the link is
                // applied per group by getTextContent. This ensures proper nesting.
                //
                // ⛔ Until 2026-10-18 the editor's `textStyle` (a theme color) and
                // `highlight` marks were applied first. The editor saves both as
                // the vocabulary's `span` — `[x]{accent}`, `[x]{highlight}` — so
                // neither is read now.

                // span (bracketed spans with class/id/attributes)
                if (marks.some((mark) => mark.type === "span")) {
                    const spanMark = marks.find((mark) => mark.type === "span");
                    const attrs = spanMark?.attrs || {};
                    const attrParts = [];
                    const styleParts = [];

                    if (attrs.class) attrParts.push(`class="${escapeAttr(attrs.class)}"`);
                    if (attrs.id) attrParts.push(`id="${escapeAttr(attrs.id)}"`);

                    for (const [key, value] of Object.entries(attrs)) {
                        if (key === 'class' || key === 'id') continue;
                        // Convert color/bg to inline styles
                        if (key === 'color' || key === 'bg') {
                            if (isCssColor(value)) {
                                styleParts.push(`${key === 'color' ? 'color' : 'background'}: ${value}`);
                            }
                        } else if (isStyleName(key)) {
                            // A named inline style becomes an attribute of its
                            // span — `[text]{accent}` is `<span accent="true">`
                            // — so the name is held to a style name: never a
                            // handler, a URL or a style attribute, nothing a
                            // pasted value can turn into one.
                            attrParts.push(`${key}="${escapeAttr(value)}"`);
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
                const mathml = sanitizeMathML(curr.attrs?.mathml || "");
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
                return prev + `<uniweb-inset data-ref-id="${escapeAttr(refId)}"></uniweb-inset>`;
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
            } else if (isInlinePicture(curr)) {
                // A picture sitting IN the prose — `as the figure ![](./cells.jpg)
                // shows` — marked for the icon's reason: a renderer draws it with a
                // component (kit's <Image>), from the entry processInlineElements()
                // puts in `children`, its address resolved there.
                //
                // ⛔ Until 2026-10-18 it fell through to the catch-all below, as an
                // icon did before 2026-08-12: the text kept a gap, the picture stayed
                // in `children` and `content.images`, and a walker drew nothing.
                const index = pictureOrdinals?.get(curr);
                if (index === undefined) return prev;
                return prev + `<uniweb-image data-index="${index}"></uniweb-image>`;
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
                attrs: parseIcon(item.attrs),
            });
        } else if (item.type === "image") {
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
            // The role partitions it as the block case does.
            const role = item.attrs?.role;
            if (role === "video") {
                items.push({ type: "video", attrs: parseMarkdownVideo(item.attrs, options) });
            } else if (role === "pdf") {
                items.push({ type: "document", attrs: parseMarkdownDocument(item.attrs, options) });
            } else {
                items.push({ type: "image", attrs: parseImgBlock(item.attrs || {}, options) });
            }
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
            const linkMark = linkMarkOf(item.marks);
            if (linkMark && isSafeLink(linkMark.attrs?.href)) {
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
 * URL pattern — the current mechanism, and the one to reach for.
 *
 * The host declares `config.assets.url` on the published payload; the runtime
 * hands it here as `options.assets.url`. We substitute `{id}` and `{ext}` and
 * do nothing else: the pattern names a host and carries the store's whole path
 * layout, so a framework package never composes a serve location or guesses an
 * origin — a host may move its assets without a framework release.
 *
 * ⛔ No asset host is built into this package: a reference resolves through this
 * pattern, or is the address the content holds. Until 2026-10-17 an
 * `info.identifier` (`{version}/{filename}`) was composed against a fixed host;
 * it is not read.
 *
 * ⛔ Three ways this returns '' — "unresolved", never a guess:
 *   - **no pattern** (the host declared none) — absent ⇒ absent
 *   - **an unknown placeholder** — never emit a half-substituted URL
 *   - **`{ext}` with no `assetExt`** — `base.` is a broken URL that reads like
 *     a typo rather than a missing field
 *
 * Callers treat '' as "fall through to the next reference form", which is what
 * makes an id-bearing node safe to write before any deployment emits a pattern.
 *
 * @param {string} assetId  - the store's opaque id (backend mints a sha256)
 * @param {string} assetExt - the extension, minted separately (never derived
 *                            from the id, which carries no extension)
 * @param {string} pattern - `config.assets.url`, e.g. `https://cdn/x/{id}/base.{ext}`
 * @returns {string} the resolved URL, or '' when it cannot be resolved
 */
/**
 * The asset-bearing slots on a media node — the ONE definition, exported so no
 * consumer keeps its own.
 *
 * ⭐ A node carries more than one asset reference. An image has `src`; a video
 * adds a `poster`; a document embed adds a `preview`. Identity therefore cannot
 * be a single pair of attrs — it has to name WHICH reference it identifies, or a
 * producer cannot stamp a poster without inventing vocabulary.
 *
 * The identity attrs are **flat and declared**, not a nested `assets: {…}` map,
 * and that is deliberate: a nested map puts identity inside a value the schema
 * sweep cannot see, which is exactly the class of defect that makes a reference
 * buried in an opaque field unenumerable and un-re-pointable. Flat attrs stay
 * visible to `getBaseSchema()`, to the parity sweep, and to anything generating
 * an adapter from the declared schema.
 *
 * `assetId`/`assetExt` are unprefixed because `src` is the PRIMARY reference —
 * the one every fallback path already resolves to. The convention is: unprefixed
 * identifies the primary; a prefix names the attr it belongs to.
 *
 * `url` rides in the primary slot because the editor's `ImageBlock` used it where
 * `image` uses `src`. This parser reads `src` alone since 2026-10-18; the entry
 * stays because this list is exported and read outside it.
 */
export const ASSET_SLOTS = [
    { urls: ["src", "url"], id: "assetId", ext: "assetExt" },
    { urls: ["poster"], id: "posterAssetId", ext: "posterAssetExt" },
    { urls: ["preview"], id: "previewAssetId", ext: "previewAssetExt" },
];

function resolveAssetUrl(assetId, assetExt, pattern) {
    if (!assetId || typeof assetId !== "string") return "";
    if (!pattern || typeof pattern !== "string") return "";
    let resolvable = true;
    const url = pattern.replace(/\{(\w+)\}/g, (match, name) => {
        if (name === "id") return assetId;
        if (name === "ext" && assetExt) return assetExt;
        resolvable = false;
        return match;
    });
    return resolvable ? url : "";
}

/** `resolveAssetUrl` against a node's attrs + the parse options, for one slot. */
function assetUrlFromAttrs(attrs, options, slot = ASSET_SLOTS[0]) {
    return resolveAssetUrl(attrs?.[slot.id], attrs?.[slot.ext], options?.assets?.url);
}

/** The slot whose identity attrs name a given url attr (`poster` → posterAsset*). */
const slotFor = (urlAttr) => ASSET_SLOTS.find((s) => s.urls.includes(urlAttr));

/**
 * Resolve a secondary reference (`poster`, `preview`) the same way the primary
 * one resolves: identity wins when it resolves, else the stored URL stands.
 * A poster is an asset like any other — it just is not the node's primary.
 */
function secondaryAssetUrl(attrs, options, urlAttr) {
    const slot = slotFor(urlAttr);
    const resolved = slot ? assetUrlFromAttrs(attrs, options, slot) : "";
    return resolved || attrs?.[urlAttr] || "";
}

// A document authored in markdown: `![Annual report](./report.pdf){role=pdf …}`.
//
// Read through `parseImgBlock`, which resolves the address and the preview's the
// way every image's are, and then narrowed to what a document IS: where the file
// is, what it is called, and the resource's own metadata. Where a picture sits
// in a flow (`placement`) is not a file's, and is left out.
function parseMarkdownDocument(itemAttrs, options) {
    const { url, alt, caption, role, href, target, id, preview, author, description } =
        parseImgBlock(itemAttrs || {}, options);
    return {
        url,
        ...fileFacts(url, itemAttrs),
        alt,
        caption,
        role,
        ...(href && { href }),
        ...(target && { target }),
        ...(id && { id }),
        ...(preview && { preview }),
        ...(author && { author }),
        ...(description && { description }),
    };
}

/**
 * A document's file, as a file record's value names it: `name` (the file's name) and
 * `mime` from its address, and `size` — known only where the file is — when a
 * producer stamped one. A stamped `name` or `mime` wins over the address: the build
 * copies a local file under a hashed name, so it stamps the one the author gave it.
 * ✅ The field names are a file record's [Diego, 2026-09-29], so one component can
 * render a downloads list from either.
 */
function fileFacts(url, attrs = {}) {
    const name = typeof attrs?.name === "string" && attrs.name ? attrs.name : fileNameOf(url);
    const mime = typeof attrs?.mime === "string" && attrs.mime ? attrs.mime : name ? mimeFor(name) : "";
    const size = Number.isFinite(attrs?.size) ? attrs.size : null;
    return {
        ...(name && { name }),
        ...(mime && { mime }),
        ...(size !== null && { size }),
    };
}

/**
 * An icon: named (`library` + `name`, resolved at render through the icon
 * corpus) or a file (`src`) — `![Logo](icon:./logo.svg)` or
 * `![Logo](./logo.svg){role=icon}`, both documented in AGENTS.md and
 * docs/reference/content-structure.md. Until 2026-07-30 a file-sourced icon
 * delivered `{}` and rendered nothing. `url` is the key kit's <Icon> fetches
 * from. Keys are omitted when absent.
 *
 * ⛔ Until 2026-10-18 this also read the editor's `UniwebIcon` (an inline `svg`,
 * a `url`, `preserveColors`, a `family:id` name) and its `Icon` node.
 */
function parseIcon(itemAttrs) {
    const { src, size, color, href, target, library, name } = itemAttrs || {};

    const icon = {};
    if (src) icon.url = src;
    if (size) icon.size = size;
    if (color) icon.color = color;
    if (href) icon.href = href;
    if (target) icon.target = target;
    if (library) icon.library = library;
    if (name) icon.name = name;

    return icon;
}

function parseImgBlock(itemAttrs, options) {
    let {
        caption = "",
        alt = "",
        src,
        href = "",
        target = "",
        role,
        id, // {#fig-id} cross-reference label — preserved so Press
            // adapters can emit \label{id} (LaTeX) / <id> (Typst).
        // ⭐ An element holds the vocabulary's words. ⛔ This function was
        // written for the editor's `ImageBlock` and read its words too — `url`,
        // `credit`, an `info` envelope (`contentType`, `viewType`, `contentId`)
        // and `targetId` — until 2026-10-18; and until 2026-10-15 its
        // `direction`, `imgPos`, a layout `size`, `filter` and `theme`. A
        // component handing the element to kit's <Image> passed that `size` as
        // Image's avatar preset, so a "wide" image drew as a 96px square.
        width,
        height,
        loading,
        fit,
        position,
        placement,   // where it sits in a flow: left, right, wide, full
        preview,     // role=pdf — the preview image
        author,      // the image's attribution; for role=pdf, the resource's
        description, // role=pdf — describes the RESOURCE, not the image (≠ alt)
    } = itemAttrs;

    caption = stripTags(caption);

    // ⭐ A store-held asset (`assetId`) wins WHEN IT RESOLVES — not merely when
    // it is present. That distinction is the whole reason a producer can write
    // `assetId` alongside `src` before any deployment declares
    // `config.assets.url`: until one does, resolution yields '' and the node
    // renders through `src` exactly as it does today. Content written now stays
    // correct whichever order the halves arrive in.
    const url = assetUrlFromAttrs(itemAttrs, options) || src || undefined;

    return {
        url,
        alt: alt || caption,
        caption,
        href,
        target,
        role,
        id: id || undefined,
        // Omitted when absent, so an existing consumer sees no new empty keys.
        ...(width !== undefined && width !== null && { width }),
        ...(height !== undefined && height !== null && { height }),
        ...(loading && { loading }),
        ...(fit && { fit }),
        ...(position && { position }),
        ...(placement && { placement }),
        ...((() => {
            // Same rule for a document's preview image.
            const p = secondaryAssetUrl(itemAttrs, options, "preview");
            return p ? { preview: p } : {};
        })()),
        ...(author && { author }),
        ...(description && { description }),
    };
}

// A video authored in markdown: `![alt](./demo.mp4){role=video …}`.
//
// This reader carries the attribute set that docs/reference/content-structure.md
// publishes for the video role, and the shape it documents: `{ src, href,
// target }` plus the playback flags. ⛔ Until 2026-10-18 the editor's `Video`
// node had a reader of its own, `parseVideoBlock`, and this one took the
// editor's `url` and `info` too.
function parseMarkdownVideo(itemAttrs, options) {
    const {
        src,
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
        placement, // where it sits in a flow, same as parseImgBlock
    } = itemAttrs || {};

    // Reference precedence, as parseImgBlock's: a resolvable store-held asset,
    // then the address the node holds.
    const assetUrl = assetUrlFromAttrs(itemAttrs, options);
    const video = {
        src: assetUrl || src || "",
        alt,
        caption: stripTags(caption),
        role,
        href,
        target,
    };

    // Playback attributes are omitted rather than defaulted: a component can
    // then tell "the author said nothing" from "the author said false", and
    // kit's <Media> supplies its own defaults (controls on, the rest off).
    // A poster is an asset like any other — identity resolves it when it can,
    // and the stored URL stands when it cannot. Same rule as the primary `src`.
    const posterUrl = secondaryAssetUrl(itemAttrs, options, "poster");
    if (posterUrl) video.poster = posterUrl;
    if (autoplay !== undefined) video.autoplay = autoplay;
    if (muted !== undefined) video.muted = muted;
    if (loop !== undefined) video.loop = loop;
    if (controls !== undefined) video.controls = controls;
    if (id) video.id = id;
    if (placement) video.placement = placement;

    return video;
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
            const mark = linkMarkOf(contentItem?.marks);

            if (mark) {
                // Find the position of the link text in the original content
                const linkIndex = originalContent.findIndex(
                    (c) => c.type === "text" && c.text === contentItem.text
                );

                // Collect icons before and after the link text
                let iconBefore = null;
                let iconAfter = null;

                for (let i = 0; i < originalContent.length; i++) {
                    if (isIconNode(originalContent[i])) {
                        const iconAttrs = parseIcon(originalContent[i].attrs);
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
        return Boolean(linkMarkOf(c.marks));
    });

    if (!allLinks) return false;

    // Extract links with all their attributes
    // Icons in this paragraph go to body.icons separately (no association)
    return textContent.map((c) => {
        const linkMark = linkMarkOf(c.marks);
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
    let firstLinkMark = linkMarkOf(content[0]?.marks);
    if (!firstLinkMark?.attrs) return false;
    if (
        !content.every(
            (c) => linkMarkOf(c?.marks)?.attrs?.href === firstLinkMark.attrs?.href
        )
    )
        return false;

    const { href, target } = firstLinkMark.attrs;

    const cleanedContent = content.map((c) => {
        // remove link marks from content items
        const cleanedMarks =
            c.marks?.filter((mark) => mark.type !== "link" && mark.type !== "button") || [];
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
        text: anchor(href, target, textContent),
        attrs: item.attrs,
    };
}

export { processSequence, resolveAssetUrl };

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

    const linkVal = isLink(node);

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

    const styledLink = isStyledLink(node);

    if (styledLink) return styledLink;

    switch (node.type) {
        case "heading":
            return {
                type: "heading",
                level: node.attrs.level,
                text: getTextContent(content, options),
                children: processInlineElements(content),
                attrs,
            };

        case "paragraph": {
            let textContent = getTextContent(content, options);

            return {
                type: "paragraph",
                text: textContent,
                children: processInlineElements(content),
                attrs,
            };
        }
        case "blockquote":
            return {
                type: "blockquote",
                children: processSequence({
                    content,
                }),
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
                children: processSequence({ content }),
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
                attrs: parseImgBlock(attrs),
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
                    attrs: parseMarkdownVideo(attrs),
                };
            }
            // Standard ProseMirror image node - resolve attrs the same way as
            // ImageBlock so info.identifier lands as a CDN URL. CLI-deployed
            // content uses this node type; without parseImgBlock the url
            // wouldn't be populated and components render an empty slot.
            return {
                type: "image",
                attrs: parseImgBlock(attrs || {}),
            };
        case "Video":
            return {
                type: "video",
                attrs: parseVideoBlock(attrs),
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

        case "DividerBlock":
        case "horizontalRule":
            return {
                type: "divider",
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
                children: processInlineElements(content),
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

    return groups
        .reduce((prev, group) => {
            const inner = group.nodes.reduce(
                (acc, node) => acc + renderInlineNode(node),
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
function renderInlineNode(curr) {
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
            } else {
                // console.warn(`unhandled text content type: ${type}`, curr);
                return prev;
            }
        }, "");
}

function processInlineElements(content) {
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
                    ? parseMarkdownVideo(item.attrs)
                    : parseImgBlock(item.attrs || {}),
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

const ASSET_BASE_URL = "https://assets.uniweb.app/";

/**
 * Resolve an asset identifier ({version}/{filename}) to a direct URL.
 * Assets are hosted at assets.uniweb.app under dist/{version}/base.{ext}.
 */
function resolveAssetIdentifier(identifier) {
    if (!identifier || typeof identifier !== "string") return "";
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

function parseImgBlock(itemAttrs) {
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

    // Standard ProseMirror `image` nodes use `src`; the custom
    // `ImageBlock` node uses `url`. Honor either so callers don't have
    // to pre-normalize. `identifier` (CDN-resolvable asset id) wins
    // when present so an editor-deployed image with a stale `src`
    // doesn't shadow the CDN copy.
    if (identifier) {
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
function parseMarkdownVideo(itemAttrs) {
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

    const video = {
        // `identifier` (a CDN-resolvable asset id) wins when present, matching
        // parseImgBlock — an editor-deployed asset with a stale src must not
        // shadow the CDN copy.
        src: makeAssetUrl({ src: url || src, ...info }),
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

function parseVideoBlock(itemAttrs) {
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

    let video = makeAssetUrl({
        src,
        ...info,
    });

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

function isLink(item) {
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
                        children: processInlineElements(originalContent),
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
function isStyledLink(item) {
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
        children: processInlineElements(item.content),
        text: `<a target="${target}" href="${href}">${textContent}</a>`,
        attrs: item.attrs,
    };
}

export { processSequence };

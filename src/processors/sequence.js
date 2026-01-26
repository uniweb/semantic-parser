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

        case "dataBlock":
            // Pre-parsed structured data from content-reader
            return {
                type: "dataBlock",
                data: attrs.data,
                tag: attrs.tag,
            };

        case "codeBlock":
            const codeText = getTextContent(content, options);
            return {
                type: "codeBlock",
                text: getCodeBlockData(codeText, attrs),
                attrs,
            };

        case "ImageBlock":
            return {
                type: "image",
                attrs: parseImgBlock(attrs),
            };
        case "image":
            // Standard ProseMirror image node - wrap attrs like ImageBlock
            return {
                type: "image",
                attrs: attrs || {},
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

function getTextContent(content, options = {}) {
    if (!content) return "";

    return content
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

                    if (attrs.class) attrParts.push(`class="${attrs.class}"`);
                    if (attrs.id) attrParts.push(`id="${attrs.id}"`);

                    // Add any other custom attributes (data-*, etc.)
                    for (const [key, value] of Object.entries(attrs)) {
                        if (key !== 'class' && key !== 'id') {
                            attrParts.push(`${key}="${value}"`);
                        }
                    }

                    const attrString = attrParts.length > 0 ? ` ${attrParts.join(' ')}` : '';
                    styledText = `<span${attrString}>${styledText}</span>`;
                }

                // bold
                if (marks.some((mark) => mark.type === "bold")) {
                    styledText = `<strong>${styledText}</strong>`;
                }

                // italic
                if (marks.some((mark) => mark.type === "italic")) {
                    styledText = `<em>${styledText}</em>`;
                }

                // link (outermost)
                if (marks.some((mark) => mark.type === "link")) {
                    const linkMark = marks.find((mark) => mark.type === "link");
                    const href = linkMark.attrs.href;
                    const target = linkMark.attrs.target || "_self";

                    // Check if it's a file link (add download attribute)
                    const fileExtensions = [
                        "pdf",
                        "doc",
                        "docx",
                        "xls",
                        "xlsx",
                        "ppt",
                        "pptx",
                        "jpg",
                        "jpeg",
                        "png",
                        "webp",
                        "gif",
                        "svg",
                        "mp4",
                        "mp3",
                        "wav",
                        "mov",
                        "zip",
                    ];
                    const extension = href.split(".").pop()?.toLowerCase();
                    const isFileLink = fileExtensions.includes(extension);

                    styledText = `<a href="${href}" target="${target}"${
                        isFileLink ? " download" : ""
                    }>${styledText}</a>`;
                }

                return prev + styledText;
            } else if (type === "hardBreak") {
                return prev + "<br>";
            } else {
                // console.warn(`unhandled text content type: ${type}`, curr);
                return prev;
            }
        }, "")
        .trim();
}

function processInlineElements(content) {
    if (!content) return [];

    const items = [];

    for (const item of content) {
        if (item.type === "UniwebIcon") {
            items.push({
                type: "icon",
                attrs: parseUniwebIcon(item.attrs),
            });
        } else if (item.type === "math-inline") {
            items.push(item);
        } else if (item.type === "text" && item.marks) {
            // Extract links from text nodes with link marks
            const linkMark = item.marks.find((m) => m.type === "link");
            if (linkMark) {
                items.push({
                    type: "link",
                    attrs: {
                        href: linkMark.attrs?.href,
                        label: item.text || "",
                    },
                });
            }
        }
    }

    return items;
}

function makeAssetUrl(info) {
    let url = "";

    let src = info?.src || info?.url || "";

    if (src) {
        url = src;
    } else if (info?.identifier) {
        url =
            new uniweb.Profile(`docufolio/profile`, "_template").getAssetInfo(
                info.identifier
            )?.src || "";
    }

    return url;
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
            ele.downloadUrl = new uniweb.Profile(
                `docufolio/profile`,
                "_template"
            ).getAssetInfo(identifier)?.href;
        }
    }

    return ele;
}

function parseUniwebIcon(itemAttrs) {
    let { svg, url, size, color, preserveColors, href, target } = itemAttrs || {};

    return {
        svg,
        url,
        size,
        color,
        preserveColors,
        href,
        target,
    };
}

function parseIconBlock(itemAttrs) {
    let { svg } = itemAttrs;

    return svg;
}

function parseImgBlock(itemAttrs) {
    let {
        info: imgInfo,
        targetId,
        caption = "",
        direction,
        filter,
        alt = "",
        url,
        href = "",
        target = "",
        theme,
        role,
        credit = "",
    } = itemAttrs;

    let { contentType, viewType, contentId, identifier } = imgInfo || {};

    const sizes = {
        center: "basic",
        wide: "lg",
        fill: "full",
    };

    caption = stripTags(caption);

    if (identifier) {
        url = makeAssetUrl(imgInfo);
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
        size: sizes[direction] || "basic",
        href,
        target,
        theme,
        role,
        credit,
    };
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

    // Remove HTML tags using regular expression
    const plainString = htmlString.replace(/<[^>]*>/g, "");

    // Decode HTML entities
    const decodedString = new DOMParser().parseFromString(
        plainString,
        "text/html"
    ).body.textContent;

    return decodedString;
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
            if (c.type === "UniwebIcon") {
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
                        if (originalContent[i].type === "UniwebIcon") {
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
                        href: mark?.attrs?.href,
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
        if (c.type === "UniwebIcon") return false;
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

    // Extract links as simple {href, label} objects
    // Icons in this paragraph go to body.icons separately (no association)
    return textContent.map((c) => {
        const linkMark = c.marks.find((m) => m.type === "link");
        return {
            type: "link",
            attrs: {
                href: linkMark?.attrs?.href,
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
        if (c.type === "UniwebIcon") {
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

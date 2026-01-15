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
    // Special handling for root doc node
    if (node.type === "doc") {
        node.content?.forEach((child) => processNode(child, sequence, options));
        return;
    }

    // Create element based on node type
    const element = createSequenceElement(node, options);

    if (element) {
        sequence.push(element);
    }
}

function createSequenceElement(node, options = {}) {
    function isLink() {
        if (node.type === "paragraph" && node.content.length === 1) {
            return (
                node.content[0].marks?.some((mark) => mark.type === "link") ||
                false
            );
        }
    }

    function isStyledLink() {
        // Check if paragraph has multiple content parts with same link mark
        if (
            node.type === "paragraph" &&
            node.content &&
            node.content.length > 1
        ) {
            // Filter out icons
            const content = node.content.filter(
                (c) => c.type !== "UniwebIcon" && c.type !== "image"
            );

            if (content.length === 0) return false;

            // Get first link mark
            const firstLinkMark = content[0]?.marks?.find(
                (mark) => mark.type === "link" && mark.attrs
            );
            if (!firstLinkMark) return false;

            // Check if all content items have same link mark
            const allHaveSameLink = content.every((c) =>
                c?.marks?.some(
                    (mark) =>
                        mark.type === "link" &&
                        mark.attrs?.href === firstLinkMark.attrs.href
                )
            );

            return allHaveSameLink ? firstLinkMark : false;
        }
        return false;
    }

    function isImage() {
        if (node.type === "paragraph" && node.content.length === 1) {
            return (
                node.content[0].type === "image" &&
                (node.content[0].attrs.role === "image" ||
                    node.content[0].attrs.role === "banner")
            );
        }
    }

    function isIcon() {
        if (node.type === "paragraph" && node.content.length === 1) {
            return (
                node.content[0].type === "image" &&
                node.content[0].attrs.role === "icon"
            );
        }
    }

    function isButton() {
        if (node.type === "paragraph" && node.content.length === 1) {
            return (
                node.content[0].type === "text" &&
                node.content[0].marks?.some((mark) => mark.type === "button")
            );
        }
    }

    function isVideo() {
        if (node.type === "paragraph" && node.content.length === 1) {
            return (
                node.content[0].type === "image" &&
                node.content[0].attrs.role === "video"
            );
        }
    }

    // extract pure [type] content from the paragraph node for easier handling in the byGroup processor

    // Check styled link first (multi-part link)
    const styledLinkMark = isStyledLink();
    if (styledLinkMark) {
        // Remove link marks from content, keep other styling
        const cleanedContent = node.content
            .filter((c) => c.type !== "UniwebIcon" && c.type !== "image")
            .map((c) => ({
                ...c,
                marks: c.marks?.filter((mark) => mark.type !== "link") || [],
            }));

        return {
            type: "styledLink",
            href: styledLinkMark.attrs.href,
            target: styledLinkMark.attrs.target || "_self",
            content: getTextContent(
                { ...node, content: cleanedContent },
                options
            ),
        };
    }

    // Simple single-part link
    if (isLink()) {
        return {
            type: "link",
            content: {
                href: node.content[0].marks.find((mark) => mark.type === "link")
                    .attrs.href,
                label: node.content[0].text,
            },
        };
    }

    if (isImage()) {
        return {
            type: "image",
            src: node.content[0].attrs.src,
            caption: node.content[0].attrs.title,
            alt: node.content[0].attrs.alt || node.content[0].attrs.title,
            role: node.content[0].attrs.role,
        };
    }

    if (isIcon()) {
        return {
            type: "icon",
            svg: node.content[0].attrs.svg,
        };
    }

    if (isButton()) {
        return {
            type: "button",
            content: node.content[0].text,
            attrs: node.content[0].marks.find((mark) => mark.type === "button")
                .attrs,
        };
    }

    if (isVideo()) {
        return {
            type: "video",
            src: node.content[0].attrs.src,
            caption: node.content[0].attrs.title,
            alt: node.content[0].attrs.alt || node.content[0].attrs.title,
        };
    }

    switch (node.type) {
        case "heading":
            return {
                type: "heading",
                level: node.attrs.level,
                content: getTextContent(node, options),
                attrs: node.attrs, // Pass through all attributes (including textAlign)
            };

        case "paragraph":
            return {
                type: "paragraph",
                content: getTextContent(node, options),
            };

        case "blockquote":
            // Process blockquote content recursively
            return {
                type: "blockquote",
                content:
                    node.content
                        ?.map((child) => createSequenceElement(child, options))
                        .filter(Boolean) || [],
            };

        case "codeBlock":
            const textContent = getTextContent(node, options);
            let parsedJson = null;

            if (options.parseCodeAsJson) {
                try {
                    parsedJson = JSON.parse(textContent);
                } catch (err) {
                    // Invalid JSON, keep as string
                }
            }

            return {
                type: "codeBlock",
                content: textContent,
                parsed: parsedJson,
            };

        case "image":
            return {
                type: "image",
                src: node.attrs.src,
                alt: node.attrs.alt,
                role: node.attrs.role,
            };

        case "bulletList":
        case "orderedList":
            return {
                type: "list",
                style: node.type === "bulletList" ? "bullet" : "ordered",
                items: processListItems(node, options),
            };

        case "listItem":
            return {
                type: "listItem",
                content: getTextContent(node, options),
            };

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
                        .map((card) => ({
                            ...card.attrs,
                            type: "card",
                        })) || [],
            };

        case "document-group":
            return {
                type: "document-group",
                documents:
                    node.content
                        ?.filter((c) => c.type === "document")
                        .map((doc) => ({
                            ...doc.attrs,
                            type: "document",
                        })) || [],
            };

        case "FormBlock":
            // Parse form data (can be JSON string or object)
            let formData = node.attrs?.data;
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
                attrs: node.attrs,
            };

        case "text":
            return null;

        default:
            return {
                type: node.type,
                content: getTextContent(node, options),
            };
    }
}

function getTextContent(node, options = {}) {
    if (!node.content) return "";

    return node.content.reduce((prev, curr) => {
        const { type, marks = [], text } = curr;

        if (type === "text") {
            let styledText = text || "";

            // Apply marks in order: textStyle, highlight, bold, italic, link
            // This ensures proper nesting

            // textStyle (color)
            if (marks.some((mark) => mark.type === "textStyle")) {
                const color = marks.find((mark) => mark.type === "textStyle")
                    ?.attrs?.color;
                if (color) {
                    styledText = `<span style="color: var(--${color})">${styledText}</span>`;
                }
            }

            // highlight
            if (marks.some((mark) => mark.type === "highlight")) {
                styledText = `<span style="background-color: var(--highlight)">${styledText}</span>`;
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
            console.warn(`unhandled text content type: ${type}`, curr);
            return prev;
        }
    }, "");
}

function processListItems(node, options = {}) {
    const items = [];
    node.content?.forEach((item) => {
        if (item.type === "listItem") {
            items.push({
                content: item.content
                    ?.filter((child) => !child.type.endsWith("List"))
                    ?.map((child) => createSequenceElement(child, options)),
                items: item.content
                    ?.filter((child) => child.type.endsWith("List"))
                    .flatMap((list) => processListItems(list, options)),
            });
        }
    });

    return items;
}

export { processSequence };

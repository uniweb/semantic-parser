/**
 * Flatten a group's nested structure to a flat object
 * @param {Object} group Processed group with { header, body, metadata }
 * @returns {Object} Flat content object
 */
function flattenGroup(group) {
    if (!group) return null;
    return {
        title: group.header.title || '',
        pretitle: group.header.pretitle || '',
        subtitle: group.header.subtitle || '',
        subtitle2: group.header.subtitle2 || '',
        paragraphs: group.body.paragraphs || [],
        links: group.body.links || [],
        imgs: group.body.imgs || [],
        icons: group.body.icons || [],
        lists: group.body.lists || [],
        videos: group.body.videos || [],
        data: group.body.data || {},
        quotes: group.body.quotes || [],
        headings: group.body.headings || [],
    };
}

/**
 * Transform a sequence into content groups with semantic structure
 * @param {Array} sequence Flat sequence of elements
 * @param {Object} options Parsing options
 * @returns {Object} Flat content object with items array
 */
function processGroups(sequence, options = {}) {
    // Empty content returns flat empty structure
    if (!sequence.length) {
        return {
            title: '',
            pretitle: '',
            subtitle: '',
            subtitle2: '',
            paragraphs: [],
            links: [],
            imgs: [],
            icons: [],
            lists: [],
            videos: [],
            data: {},
            quotes: [],
            headings: [],
            items: [],
        };
    }

    const groups = splitBySlices(sequence);

    // Process each group's structure (still nested internally)
    const processedGroups = groups.map((group) => processGroupContent(group));

    // Determine main vs items
    let mainGroup = null;
    let itemGroups = [];

    const shouldBeMain = identifyMainContent(processedGroups);
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
        subtitle2: '',
        paragraphs: [],
        links: [],
        imgs: [],
        icons: [],
        lists: [],
        videos: [],
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

function splitBySlices(sequence) {
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

            // A new Heading Group starts a new visual block.
            // If we have gathered content in the current group, close it now.
            if (currentGroup.length > 0 && !isBannerMerge) {
                groups.push(currentGroup);
                currentGroup = [];
            }

            // Consume the entire semantic heading block (Title + Subtitles)
            // We reuse your smart readHeadingGroup logic here!
            const headingBlock = readHeadingGroup(sequence, i);
            currentGroup.push(...headingBlock);

            // Advance the index by the number of headings consumed
            // (Loop increments i by 1, so we add length - 1)
            i += headingBlock.length - 1;
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
 * Check if this is a pretitle - any heading followed by a more important heading
 * (e.g., H3→H1, H2→H1, H6→H5, etc.)
 */
function isPreTitle(sequence, i) {
    return (
        i + 1 < sequence.length &&
        sequence[i].type === "heading" &&
        sequence[i + 1].type === "heading" &&
        sequence[i].level > sequence[i + 1].level // Smaller heading before larger
    );
}

function isBannerImage(sequence, i) {
    return (
        i === 0 &&
        i + 1 < sequence.length &&
        sequence[i].type === "image" &&
        (sequence[i].role === "banner" || sequence[i + 1].type === "heading")
    );
}

function readHeadingGroup(sequence, startIdx) {
    const elements = [sequence[startIdx]];

    // Iterate starting from the next element
    for (let i = startIdx + 1; i < sequence.length; i++) {
        const element = sequence[i];
        const previousElement = elements[elements.length - 1];

        if (element.type !== "heading") {
            break;
        }

        // Case 1: Strictly Deeper (Standard Subtitle/Deep Header)
        // e.g. H1 -> H2
        if (element.level > previousElement.level) {
            elements.push(element);
            continue;
        }

        // Case 2: Pretitle Promotion (Small -> Big)
        // Only allowed if we haven't gone deep yet (length is 1)
        // e.g. H2 -> H1
        if (elements.length === 1 && element.level < previousElement.level) {
            elements.push(element);
            continue;
        }

        // Otherwise (Sibling or New Section), stop.
        break;
    }
    return elements;
}

/**
 * Process a group's content to identify its structure
 */
function processGroupContent(elements) {
    const header = {
        pretitle: "",
        title: "",
        subtitle: "",
        subtitle2: "",
    };

    const body = {
        imgs: [],
        icons: [],
        videos: [],
        paragraphs: [],
        links: [],
        lists: [],
        data: {},
        quotes: [],
        headings: [],
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

    for (let i = 0; i < elements.length; i++) {
        //We shuold only set pretitle once
        if (isPreTitle(elements, i) && !header.pretitle) {
            header.pretitle = elements[i].text;
            i++; // move to known next heading (H1 or h2)
        }

        const element = elements[i];

        if (element.type === "heading") {
            if (element.children && Array.isArray(element.children))
                processInlineElements(element.children, body);

            //We shuold set the group level to the highest one instead of the first one.
            metadata.level ??= element.level;

            // h3 h2 h1 h1
            // Assign to header fields
            // h3 h2 h3 h4
            if (!header.title) {
                header.title = element.text;
            } else if (!header.subtitle) {
                header.subtitle = element.text;
            } else if (!header.subtitle2) {
                header.subtitle2 = element.text;
            } else {
                // After subtitle2, we're in body - collect heading
                body.headings.push(element.text);
            }
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
                    body.imgs.push(preserveProps);
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

                case "dataBlock":
                    // Pre-parsed structured data from content-reader
                    body.data[element.tag] = element.data;
                    break;

                case "codeBlock":
                    // Fallback: tagged code blocks where parsing failed at build time
                    // Untagged blocks stay in sequence for display
                    const tag = element.attrs?.tag;
                    if (tag) {
                        body.data[tag] = element.text;
                    }
                    break;

                case "form":
                    // Map FormBlock to data.form
                    body.data.form = element.data || element.attrs;
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

    return first ? !second || first < second : false;
}

function processInlineElements(children, body) {
    children.forEach((item) => {
        if (item.type === "icon") {
            body.icons.push(item.attrs);
        } else if (item.type === "link") {
            // Handle inline links extracted from paragraph text nodes
            body.links.push(item.attrs);
        }
    });
}

export { processGroups };

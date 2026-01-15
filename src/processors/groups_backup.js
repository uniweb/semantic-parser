/**
 * Transform a sequence into content groups with semantic structure
 * @param {Array} sequence Flat sequence of elements
 * @param {Object} options Parsing options
 * @returns {Object} Content organized into groups with identified main content
 */
function processGroups(sequence, options = {}) {
    const result = {
        main: null,
        items: [],
        metadata: {
            dividerMode: false,
            groups: 0,
        },
    };

    if (!sequence.length) return result;

    // Check if using divider mode
    result.metadata.dividerMode = sequence.some((el) => el.type === "divider");

    // Split sequence into raw groups
    const groups = result.metadata.dividerMode
        ? splitByDividers(sequence)
        : splitByHeadings(sequence, options);

    // Process each group's structure
    const processedGroups = groups.map((group) => processGroupContent(group));

    // Special handling for first group in divider mode
    if (result.metadata.dividerMode && groups.startsWithDivider) {
        result.items = processedGroups;
    } else {
        // Organize into main content and items
        const shouldBeMain = identifyMainContent(processedGroups);
        if (shouldBeMain) {
            result.main = processedGroups[0];
            result.items = processedGroups.slice(1);
        } else {
            result.items = processedGroups;
        }
    }

    // result.metadata.groups = processedGroups.length;
    return result;
}

/**
 * Split sequence into groups using dividers
 */
function splitByDividers(sequence) {
    const groups = [];
    let currentGroup = [];
    let startsWithDivider = false;

    // Check if content effectively starts with divider (ignoring whitespace etc)
    for (let i = 0; i < sequence.length; i++) {
        const element = sequence[i];

        if (element.type === "divider") {
            if (currentGroup.length === 0 && groups.length === 0) {
                startsWithDivider = true;
            } else if (currentGroup.length > 0) {
                groups.push(currentGroup);
                currentGroup = [];
            }
        } else {
            currentGroup.push(element);
        }
    }

    if (currentGroup.length > 0) {
        groups.push(currentGroup);
    }

    groups.startsWithDivider = startsWithDivider;
    return groups;
}

/**
 * Split sequence into groups using heading patterns
 */
function splitByHeadings(sequence, options = {}) {
    const groups = [];
    let currentGroup = [];
    let isPreOpened = false;

    // Consider if current group is pre opened (only has banner or pretitle)
    // before starting a new group.
    const startGroup = (preOpen) => {
        if (currentGroup.length && !isPreOpened) {
            groups.push(currentGroup);
            currentGroup = [];
        }
        isPreOpened = preOpen;
    };

    for (let i = 0; i < sequence.length; i++) {
        // Only allow a banner for the first group
        if (!groups.length && isBannerImage(sequence, i)) {
            startGroup(true); // pre open a new group
            currentGroup.push(sequence[i]);
            i++; // move to known next element (it will be a heading)
        }

        // Handle special pretitle case before consuming all consecutive
        // headings with increasing levels
        if (isPreTitle(sequence, i)) {
            startGroup(true); // pre open a new group
            currentGroup.push(sequence[i]);
            i++; // move to known next element (it will be a heading)
        }

        const element = sequence[i];

        if (element.type === "heading") {
            const headings = readHeadingGroup(sequence, i);
            startGroup(false);

            // Add headings to the current group
            currentGroup.push(...headings);
            i += headings.length - 1; // skip all the added headings
        } else {
            currentGroup.push(element);
        }
    }

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
        i + 1 < sequence.length &&
        sequence[i].type === "image" &&
        (sequence[i].role === "banner" || sequence[i + 1].type === "heading")
    );
}

/**
 * Eagerly consume all consecutive headings with increasing levels
 * and return them as an array.
 */
function readHeadingGroup(sequence, i) {
    const elements = [sequence[i]];
    for (i++; i < sequence.length; i++) {
        const element = sequence[i];

        if (
            element.type === "heading" &&
            element.level > sequence[i - 1].level
        ) {
            elements.push(element);
        } else {
            break;
        }
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
        alignment: null,
    };
    let banner = null;
    const body = {
        imgs: [],
        icons: [],
        videos: [],
        paragraphs: [],
        links: [],
        lists: [],
        buttons: [],
        properties: {},
        propertyBlocks: [],
        cards: [],
        documents: [],
        forms: [],
        quotes: [],
        headings: [],
    };

    const metadata = {
        level: null,
        contentTypes: new Set(),
    };

    let inBody = false; // Track when we've finished header section

    for (let i = 0; i < elements.length; i++) {
        if (isPreTitle(elements, i)) {
            header.pretitle = elements[i].content;
            i++; // move to known next heading (H1 or h2)
        }

        if (isBannerImage(elements, i)) {
            banner = {
                url: elements[i].src,
                caption: elements[i].caption,
                alt: elements[i].alt,
            };
            i++;
        }

        const element = elements[i];

        if (element.type === "heading") {
            metadata.level ??= element.level;

            // Extract alignment from first heading
            if (!header.alignment && element.attrs?.textAlign) {
                header.alignment = element.attrs.textAlign;
            }

            // Assign to header fields
            if (!header.title) {
                header.title = element.content;
            } else if (!header.subtitle) {
                header.subtitle = element.content;
            } else if (!header.subtitle2) {
                header.subtitle2 = element.content;
            } else {
                // After subtitle2, we're in body - collect heading
                inBody = true;
                body.headings.push(element.content);
            }
        } else if (element.type === "list") {
            inBody = true;
            body.lists.push(processListContent(element));
        } else {
            inBody = true;

            switch (element.type) {
                case "paragraph":
                    body.paragraphs.push(element.content);
                    break;

                case "image":
                    body.imgs.push({
                        url: element.src,
                        caption: element.caption,
                        alt: element.alt,
                    });
                    break;

                case "link":
                    body.links.push({
                        href: element.content.href,
                        label: element.content.label,
                    });
                    break;

                case "styledLink":
                    // Styled link (multi-part with same href)
                    body.links.push({
                        href: element.href,
                        label: element.content,
                        target: element.target,
                    });
                    break;

                case "icon":
                    body.icons.push(element.svg);
                    break;

                case "button":
                    body.buttons.push(element);
                    break;

                case "video":
                    body.videos.push({
                        src: element.src,
                        caption: element.caption,
                        alt: element.alt,
                    });
                    break;

                case "blockquote":
                    // Process blockquote content recursively
                    const quoteContent = processGroupContent(
                        element.content,
                        options
                    );
                    body.quotes.push(quoteContent.body);
                    break;

                case "codeBlock":
                    // Use parsed JSON if available, otherwise use text content
                    const codeData =
                        element.parsed !== null
                            ? element.parsed
                            : element.content;
                    body.properties = codeData; // Last one
                    body.propertyBlocks.push(codeData); // All of them
                    break;

                case "card-group":
                    body.cards.push(...element.cards);
                    break;

                case "document-group":
                    body.documents.push(...element.documents);
                    break;

                case "form":
                    body.forms.push(element.data || element.attrs);
                    break;
            }
        }
    }

    return {
        header,
        body,
        banner,
        metadata,
    };
}

function processListContent(list) {
    const { items } = list;

    return items.map((item) => {
        const { items: nestedList, content: listContent } = item;

        const parsedContent = processGroupContent(listContent).body;

        if (nestedList.length) {
            const parsedNestedList = nestedList.map(
                (nestedItem) => processGroupContent(nestedItem.content).body
            );

            parsedContent.lists = [parsedNestedList];
        }

        return parsedContent;
    });
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

export { processGroups };

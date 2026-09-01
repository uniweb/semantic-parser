export const dividerGroups = {
    type: "doc",
    content: [
        {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Main Section" }],
        },
        {
            type: "paragraph",
            content: [{ type: "text", text: "Main content." }],
        },
        {
            type: "horizontalRule",
        },
        {
            type: "paragraph",
            content: [{ type: "text", text: "First group content." }],
        },
        {
            type: "horizontalRule",
        },
        {
            type: "paragraph",
            content: [{ type: "text", text: "Second group content." }],
        },
    ],
};

export const headingGroups = {
    type: "doc",
    content: [
        {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Features" }],
        },
        {
            type: "paragraph",
            content: [{ type: "text", text: "Our main features." }],
        },
        {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Feature One" }],
        },
        {
            type: "paragraph",
            content: [{ type: "text", text: "First feature description." }],
        },
        {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Feature Two" }],
        },
        {
            type: "paragraph",
            content: [{ type: "text", text: "Second feature description." }],
        },
    ],
};

export const nestedHeadings = {
    type: "doc",
    content: [
        {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "WELCOME" }],
        },
        {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Main Title" }],
        },
        {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Subtitle" }],
        },
        {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Subsubtitle" }],
        },
        {
            type: "paragraph",
            content: [{ type: "text", text: "Content." }],
        },
    ],
};

export const multipleH1s = {
    type: "doc",
    content: [
        {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "First H1" }],
        },
        {
            type: "paragraph",
            content: [{ type: "text", text: "First content." }],
        },
        {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Second H1" }],
        },
        {
            type: "paragraph",
            content: [{ type: "text", text: "Second content." }],
        },
    ],
};

//The standard Resume pattern (H1 → H2 Items with H3 children).
export const academicExperience = {
    type: "doc",
    content: [
        {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Academic Experience" }],
        },
        {
            type: "divier",
        },
        // Item 1
        {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Ph.D. in CS" }],
        },
        {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "2014-2018" }],
        },
        { type: "paragraph", content: [{ type: "text", text: "MIT" }] },
        // Item 2
        {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Masters in Data" }],
        },
        {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "2012-2014" }],
        },
        { type: "paragraph", content: [{ type: "text", text: "Berkeley" }] },
    ],
};

//The ambiguous case where the first H2 is a subtitle (Leaf) and subsequent H2s are items (Branches).
export const subtitleAndItems = {
    type: "doc",
    content: [
        {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Work History" }],
        },
        // This H2 has no children (Leaf) -> Should be merged as Subtitle
        {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "A summary of my roles." }],
        },
        // This H2 has children (Branch) -> Should start a new Item
        {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Google" }],
        },
        {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "2020-Present" }],
        },
        // Another Item
        {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Facebook" }],
        },
        {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "2018-2020" }],
        },
    ],
};

// complexHierarchy: A stress test mixing Pre-titles, H1, H2 Subtitles, and H2 Items.
export const complexHierarchy = {
    type: "doc",
    content: [
        // Pre-title
        {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "INTRO" }],
        },
        // Main Title
        {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "About Me" }],
        },
        // Subtitle (Leaf followed by Branch)
        {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Short Bio" }],
        },
        // First Item
        {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "My Hobbies" }],
        },
        {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Reading" }],
        },
        {
            type: "paragraph",
            content: [{ type: "text", text: "I love books." }],
        },
    ],
};

//simpleList: A basic sibling list without an H1 container.
export const simpleList = {
    type: "doc",
    content: [
        {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Apple" }],
        },
        { type: "paragraph", content: [{ type: "text", text: "Red fruit." }] },
        {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Banana" }],
        },
        {
            type: "paragraph",
            content: [{ type: "text", text: "Yellow fruit." }],
        },
    ],
};

export const skippedLevels = {
    type: "doc",
    content: [
        {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Skills" }],
        },
        // Jump straight to H3.
        {
            type: "divider",
        },
        {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "JavaScript" }],
        },
        {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Python" }],
        },
    ],
};

// Tagged JSON code blocks (```json:tag-name)
export const taggedJsonBlocks = {
    type: "doc",
    content: [
        {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Navigation" }],
        },
        {
            type: "paragraph",
            content: [{ type: "text", text: "Site navigation links." }],
        },
        // Tagged JSON block, pre-parsed by content-reader
        {
            type: "dataBlock",
            attrs: {
                language: "json",
                tag: "nav-links",
                data: [
                    { label: "Home", href: "/" },
                    { label: "About", href: "/about" },
                ],
            },
        },
        // Another tagged block with different tag
        {
            type: "dataBlock",
            attrs: {
                language: "json",
                tag: "settings",
                data: { theme: "dark", showLogo: true },
            },
        },
    ],
};

// Tagged YAML code blocks (```yaml:tag-name)
export const taggedYamlBlocks = {
    type: "doc",
    content: [
        {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Config" }],
        },
        {
            type: "dataBlock",
            attrs: {
                language: "yaml",
                tag: "site-config",
                data: {
                    title: "My Site",
                    theme: "dark",
                    features: ["seo", "analytics"],
                },
            },
        },
    ],
};

// Untagged code blocks (for display only, not parsed)
export const untaggedCodeBlocks = {
    type: "doc",
    content: [
        {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Example" }],
        },
        // Untagged JSON block - stays in sequence, not parsed as data
        {
            type: "codeBlock",
            attrs: { language: "json" },
            content: [
                {
                    type: "text",
                    text: '{"key": "value"}',
                },
            ],
        },
    ],
};

// Body content before first heading (e.g., footer with tagline before columns)
export const bodyBeforeHeadings = {
    type: "doc",
    content: [
        {
            type: "paragraph",
            content: [{ type: "text", text: "Tagline paragraph" }],
        },
        {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Column 1" }],
        },
        {
            type: "paragraph",
            content: [
                {
                    type: "text",
                    text: "Column 1 content.",
                },
            ],
        },
        {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Column 2" }],
        },
        {
            type: "paragraph",
            content: [
                {
                    type: "text",
                    text: "Column 2 content.",
                },
            ],
        },
    ],
};

// Mixed tagged and untagged blocks
// Two consecutive H1s with no body between them → multi-line title
export const consecutiveH1s = {
    type: "doc",
    content: [
        {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Build the future" }],
        },
        {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "with confidence" }],
        },
        {
            type: "paragraph",
            content: [{ type: "text", text: "The platform for modern teams." }],
        },
    ],
};

// Consecutive H1s followed by H2 subtitle
export const consecutiveH1sWithSubtitle = {
    type: "doc",
    content: [
        {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Build the future" }],
        },
        {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "with confidence" }],
        },
        {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "The platform for modern teams" }],
        },
    ],
};

// Pretitle + consecutive H1s
export const pretitleWithConsecutiveH1s = {
    type: "doc",
    content: [
        {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Our Mission" }],
        },
        {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Build the future" }],
        },
        {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "with confidence" }],
        },
    ],
};

// Consecutive same-level H3s in items position
export const consecutiveH3Items = {
    type: "doc",
    content: [
        {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Features" }],
        },
        {
            type: "paragraph",
            content: [{ type: "text", text: "Our key features." }],
        },
        {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Fast" }],
        },
        {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Blazing fast" }],
        },
        {
            type: "paragraph",
            content: [{ type: "text", text: "Speed is our priority." }],
        },
        {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Secure" }],
        },
        {
            type: "paragraph",
            content: [{ type: "text", text: "Built with security in mind." }],
        },
    ],
};

// H1 followed immediately by H3s — skipped levels without divider.
// The level gap (2+) signals a structural tier change, so H3s become
// items rather than grouping as subtitle of H1.
export const skippedLevelConsecutive = {
    type: "doc",
    content: [
        {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Features" }],
        },
        {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Speed" }],
        },
        {
            type: "paragraph",
            content: [{ type: "text", text: "We are blazingly fast." }],
        },
        {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: "Security" }],
        },
        {
            type: "paragraph",
            content: [
                { type: "text", text: "Enterprise-grade protection." },
            ],
        },
    ],
};

// H2 followed by H4s — same skipped-level rule at a different tier.
export const skippedLevelH2toH4 = {
    type: "doc",
    content: [
        {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Overview" }],
        },
        {
            type: "heading",
            attrs: { level: 4 },
            content: [{ type: "text", text: "Detail A" }],
        },
        {
            type: "paragraph",
            content: [{ type: "text", text: "First detail." }],
        },
        {
            type: "heading",
            attrs: { level: 4 },
            content: [{ type: "text", text: "Detail B" }],
        },
        {
            type: "paragraph",
            content: [{ type: "text", text: "Second detail." }],
        },
    ],
};

export const mixedCodeBlocks = {
    type: "doc",
    content: [
        {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Component" }],
        },
        // Tagged block -> data (pre-parsed by content-reader)
        {
            type: "dataBlock",
            attrs: {
                language: "json",
                tag: "team-member",
                data: { name: "Sarah", role: "Engineer" },
            },
        },
        // Untagged block -> stays in sequence only (not parsed as data)
        {
            type: "codeBlock",
            attrs: { language: "json" },
            content: [
                {
                    type: "text",
                    text: '{"example": "code"}',
                },
            ],
        },
    ],
};

// A tagged code block that content-reader could NOT parse. It emits this shape
// only when `parseCodeBlockData` returned null, so the text is not valid JSON
// or YAML — the tag still routes it to `data[tag]`, carrying the raw string.
export const unparsedTaggedBlock = {
    type: "doc",
    content: [
        {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Config" }],
        },
        {
            type: "codeBlock",
            attrs: { language: "yaml", tag: "site-config" },
            content: [
                {
                    type: "text",
                    text: "title: My Site\n  bad: [indent",
                },
            ],
        },
    ],
};

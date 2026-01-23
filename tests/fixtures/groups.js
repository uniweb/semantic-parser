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
        // Tagged JSON block
        {
            type: "codeBlock",
            attrs: { language: "json", tag: "nav-links" },
            content: [
                {
                    type: "text",
                    text: '[{"label": "Home", "href": "/"}, {"label": "About", "href": "/about"}]',
                },
            ],
        },
        // Another tagged block with different tag
        {
            type: "codeBlock",
            attrs: { language: "json", tag: "settings" },
            content: [
                {
                    type: "text",
                    text: '{"theme": "dark", "showLogo": true}',
                },
            ],
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
            type: "codeBlock",
            attrs: { language: "yaml", tag: "site-config" },
            content: [
                {
                    type: "text",
                    text: "title: My Site\ntheme: dark\nfeatures:\n  - seo\n  - analytics",
                },
            ],
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

// Mixed tagged and untagged blocks
export const mixedCodeBlocks = {
    type: "doc",
    content: [
        {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Component" }],
        },
        // Tagged block -> data (parsed)
        {
            type: "codeBlock",
            attrs: { language: "json", tag: "team-member" },
            content: [
                {
                    type: "text",
                    text: '{"name": "Sarah", "role": "Engineer"}',
                },
            ],
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

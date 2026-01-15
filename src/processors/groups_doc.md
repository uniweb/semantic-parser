# Content Grouping Logic

This document outlines how the `processGroups` function interprets flat arrays of content (Headings, Paragraphs, etc.) and organizes them into semantic **Main Content** and **List Items**.

## The Core Challenge

The parser must distinguish between two visually similar but semantically different patterns:

1. **Subtitles:** A smaller heading that belongs to the main title (Merge).

2. **List Items:** A smaller heading that starts a new list item (Split).

## The Logic (Heuristics)

To make this decision, the parser looks ahead at the structure:

1. **Sibling Boundary:** If we are at Level X and encounter another Level X, it is always a sibling. We **Split**.

2. **Peer Detection:** If we are stepping down (H1 → H2), we check if that H2 has a "peer" (another H2) later in the section.

3. **Leaf vs. Branch:**

    - **Leaf:** A heading with no sub-headings underneath it.

    - **Branch:** A heading with sub-headings (e.g., H2 followed by H3 dates).

## Supported Patterns & Behavior

### 1. The "Resume" Pattern (Items)

-   **Structure:** `H1` → `H2 (Branch)` → `H2 (Branch)`

-   **Use Case:** Academic Experience, Work History.

-   **Behavior:** The parser sees the first H2 has a peer. Both are "Branches" (have children).

-   **Result:** **Split**. The H1 becomes Main; the H2s become separate Items.

**Input Data Structure:**

```
{
  "type": "doc",
  "content": [
    { "type": "heading", "attrs": { "level": 1 }, "content": [{ "type": "text", "text": "Academic Experience" }] },
    { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Ph.D. in CS" }] },
    { "type": "heading", "attrs": { "level": 3 }, "content": [{ "type": "text", "text": "2014-2018" }] },
    { "type": "paragraph", "content": [{ "type": "text", "text": "MIT" }] },
    { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Masters in Data" }] },
    { "type": "heading", "attrs": { "level": 3 }, "content": [{ "type": "text", "text": "2012-2014" }] },
    { "type": "paragraph", "content": [{ "type": "text", "text": "Berkeley" }] }
  ]
}
```

**Parsed Output::**

```
[Main]  title: Academic Experience

[Item]  title: Ph.D. in CS
        subtitle: 2014-2018

[Item]  title: Masters in Data
        subtitle: 2012-2014
```

### 2. The "Standard" Pattern (Leaf Items)

-   **Structure:** `H1` → `H2 (Leaf)` → `H2 (Leaf)`

-   **Use Case:** Features list, standard sections.

-   **Behavior:** Even though the H2s are leaves (no children), the parser detects a peer (another H2).

-   **Result:** **Split**. Sibling detection forces them into separate items.

**Input Data Structure:**

```
{
  "type": "doc",
  "content": [
    { "type": "heading", "attrs": { "level": 1 }, "content": [{ "type": "text", "text": "Features" }] },
    { "type": "paragraph", "content": [{ "type": "text", "text": "Our main features." }] },
    { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Feature One" }] },
    { "type": "paragraph", "content": [{ "type": "text", "text": "First feature description." }] },
    { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Feature Two" }] },
    { "type": "paragraph", "content": [{ "type": "text", "text": "Second feature description." }] }
  ]
}
```

**Parsed Output::**

```
[Main]  title: Features
        body: Our main features.

[Item]  title: Feature One
        body: First feature description.

[Item]  title: Feature Two
        body: Second feature description.
```

### 3. The "Hybrid" Pattern (Intro Subtitle + Items)

-   **Structure:** `H1` → `H2 (Leaf)` → `H2 (Branch)`

-   **Use Case:** A section with a summary heading before the list starts.

-   **Behavior:** The parser compares the first H2 (Leaf) against the second H2 (Branch).

-   **Result:** **Merge then Split**. The first H2 merges into Main. The second H2 starts the first Item.

**Input Data Structure:**

```
{
  "type": "doc",
  "content": [
    { "type": "heading", "attrs": { "level": 1 }, "content": [{ "type": "text", "text": "Work History" }] },
    { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "A summary of my roles." }] },
    { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Google" }] },
    { "type": "heading", "attrs": { "level": 3 }, "content": [{ "type": "text", "text": "2020-Present" }] },
    { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Facebook" }] },
    { "type": "heading", "attrs": { "level": 3 }, "content": [{ "type": "text", "text": "2018-2020" }] }
  ]
}
```

**Parsed Output::**

```
[Main]  title: Work History
        subtitle: "A summary of my roles."

[Item]  title: Google
        subtitle: 2020-Present

[Item]  title: Facebook
        subtitle: 2018-2020
```

### 4. The "Deep Header" Pattern

-   **Structure:** `H3` → `H1` → `H2` -> `H3`

-   **Use Case:** Complex Hero sections with pre-titles and multiple subtitles.

-   **Behavior:** The headings are strictly sequential or hierarchical components of a single block.

-   **Result:** **Merge then Split**. Treats the hierarchy as a single deep header block.

**Input Data Structure:**

```
{
  "type": "doc",
  "content": [
    { "type": "heading", "attrs": { "level": 3 }, "content": [{ "type": "text", "text": "WELCOME" }] },
    { "type": "heading", "attrs": { "level": 1 }, "content": [{ "type": "text", "text": "Main Title" }] },
    { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Subtitle" }] },
    { "type": "heading", "attrs": { "level": 3 }, "content": [{ "type": "text", "text": "Subsubtitle" }] },
    { "type": "paragraph", "content": [{ "type": "text", "text": "Content." }] }
  ]
}

```

**Parsed Output::**

```
[Main]  title: Main Title
        pretitle: WELCOME
        subtitle: Subtitle
        subtitle2: Subsubtitle
```

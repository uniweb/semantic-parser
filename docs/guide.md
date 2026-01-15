# Content Writing Guide

This guide explains how to write content that works well with our semantic parser. The parser helps web components understand and render your content effectively by identifying its structure and meaning.

## Core Concepts

The parser recognizes two key elements in your content:

- **Main Content**: The primary content that introduces your section
- **Groups**: Additional content blocks that follow a consistent structure

## Main Content

Main content provides the primary context for your section. Here's how to write it:

```markdown
### SOLUTIONS

# Build Better Websites

## For Everyone

Transform how you create web content with our powerful platform.
```

Your main content must have exactly one main title, which can be either:

- A single H1 heading, or
- A single H2 heading (if no H1 exists)

You can also add:

- A pretitle (H3 before main title)
- A subtitle (next level heading after main title)

For line breaks in titles, use HTML break tags:

```markdown
# Build Better<br>Websites Today
```

## Content Groups

After your main content, you can add multiple content groups. Groups can start with any heading level, and each group can have its own structure.

H3s can serve two different roles depending on context:

1. As a pretitle when followed by a higher-level heading:

```markdown
### SPEED MATTERS

## Performance Features

Modern websites need to be fast. Our platform ensures quick load times
across all devices.
```

2. As a regular group title when followed by content or lower-level headings:

```markdown
### Getting Started

Start building your website in minutes.

### Installation Guide

#### Prerequisites

Make sure you have Node.js installed...
```

Each group can have:

- A title (any heading level that starts the group)
- A pretitle (H3 followed by higher-level heading)
- A subtitle (lower-level heading after title)
- Content (text, lists, media)

## Creating Groups

There are two ways to create groups: using headings or using dividers.

### Using Headings

Headings naturally create groups when they appear after content:

```markdown
# Main Features

Our platform offers powerful capabilities.

## Fast Performance

Lightning quick response times...

## Easy Integration

Connect with your existing tools...
```

Multiple H1s or multiple H2s (with no H1) will create separate groups:

```markdown
# First Group

Content for first group...

# Second Group

Content for second group...
```

### Using Dividers

Alternatively, you can use dividers (---) to explicitly separate groups:

```markdown
# Welcome Section

Our main welcome message.

---

Get started with our platform
with these simple steps.

---

Contact us to learn more
about enterprise solutions.
```

Important: Once you use a divider, you must use dividers for all group separations in that section. Don't mix heading-based and divider-based group creation.

## Rich Content

### Lists

Lists maintain their hierarchy, making them perfect for structured data:

```markdown
## Features

- Enterprise
  - Role-based access
  - Audit logs
- Team
  - Collaboration
  - API access
```

### Media

Images and videos can have explicit roles:

```markdown
![Hero](hero.jpg){role="background"}
![Icon](icon.svg){role="icon"}
![](photo.jpg) # Default role is "content"
```

Common roles include:

- background
- content
- gallery
- icon

### Links

Links can have roles to indicate their purpose:

```markdown
[Get Started](./start){role="button-primary"}
[Learn More](./docs){role="button"}
[Privacy](./legal){role="footer-link"}
```

Common link roles include:

- button-primary
- button
- button-outline
- nav-link
- footer-link

## Important Notes

1. Main content is only recognized when there's exactly one main title (H1 or H2).

2. Avoid these patterns as they'll result in no main content:

```markdown
# First Title

Content...

# Second Title

Content...
```

3. All content is optional - components may choose what to render based on their needs and configuration.

4. Be consistent with your group creation method - use either headings or dividers, not both.

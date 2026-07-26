/**
 * Reverse conversion: content structure → TipTap document.
 *
 * Mirrors the forward parser (processors/sequence.js + processors/groups.js)
 * so that parseContent(buildDoc(content)) roundtrips cleanly.
 *
 * Starter content uses plain strings (no HTML marks), so the conversion
 * is straightforward — no need to reverse inline HTML formatting.
 */

// --- TipTap node builders ---

function textNode(text) {
  return { type: 'text', text }
}

function heading(level, text) {
  if (!text) return null
  // Multi-line title: string[] → multiple headings at same level
  if (Array.isArray(text)) {
    return text.map(t => heading(level, t)).filter(Boolean)
  }
  return {
    type: 'heading',
    attrs: { level },
    content: [textNode(text)],
  }
}

function paragraph(text) {
  if (!text) return null
  return {
    type: 'paragraph',
    content: [textNode(text)],
  }
}

function linkParagraph({ text, href, target }) {
  if (!text || !href) return null
  const mark = { type: 'link', attrs: { href } }
  if (target) mark.attrs.target = target
  return {
    type: 'paragraph',
    content: [{ type: 'text', text, marks: [mark] }],
  }
}

function imageBlock({ src, alt = '', caption = '', direction, role, width, height }) {
  const attrs = { url: src, alt }
  if (caption) attrs.caption = caption
  if (direction) attrs.direction = direction
  if (role) attrs.role = role
  if (width && height) {
    attrs.aspect_ratio = { width, height, ratio: (height / width) * 100 }
  }
  return { type: 'ImageBlock', attrs }
}

function iconNode({ src, svg, library, name, size, color }) {
  // UniwebIcon supports multiple source types.
  //
  // The family rides INSIDE `name` as `family:id`. The editor's node declares
  // `{ name, svg, url, size, color, preserveColors, info }` and no `library`,
  // and ProseMirror silently drops undeclared attrs on `fromJSON` — so emitting
  // a separate `library` lost the family without a trace, on the path that
  // builds starter content for every new section.
  const attrs = {}
  if (svg || src) attrs.svg = svg || src
  if (name) attrs.name = library ? `${library}:${name}` : name
  if (size) attrs.size = size
  if (color) attrs.color = color
  return { type: 'UniwebIcon', attrs }
}

function videoNode({ src, caption, direction, coverImg }) {
  const attrs = { src }
  if (caption) attrs.caption = caption
  if (direction) attrs.direction = direction
  if (coverImg) attrs.coverImg = coverImg
  return { type: 'Video', attrs }
}

function dividerBlock() {
  return { type: 'DividerBlock' }
}

function bulletList(items) {
  if (!items || !items.length) return null
  return {
    type: 'bulletList',
    content: items.map(item => ({
      type: 'listItem',
      content: [paragraph(item)].filter(Boolean),
    })),
  }
}

// --- Group builder ---

/**
 * Build TipTap nodes from a content group (main or item).
 *
 * @param {Object} group - Content structure: { pretitle, title, subtitle, paragraphs, images, ... }
 * @param {number} titleLevel - Heading level for title (1 for main, 2 for items)
 * @returns {Array} Array of TipTap nodes
 */
function buildGroupNodes(group, titleLevel = 1) {
  const nodes = []

  // 1. Headings: pretitle → title → subtitle
  // Pretitle uses a higher level number (less important) than title
  // e.g., H3 before H1 — mirrors isPreTitle() in groups.js
  if (group.pretitle) {
    const pre = heading(titleLevel + 2, group.pretitle)
    if (Array.isArray(pre)) nodes.push(...pre)
    else if (pre) nodes.push(pre)
  }

  if (group.title) {
    const t = heading(titleLevel, group.title)
    if (Array.isArray(t)) nodes.push(...t)
    else if (t) nodes.push(t)
  }

  // Subtitle is one level below title
  if (group.subtitle) {
    const sub = heading(titleLevel + 1, group.subtitle)
    if (Array.isArray(sub)) nodes.push(...sub)
    else if (sub) nodes.push(sub)
  }

  // 2. Body fields in document order
  if (group.paragraphs) {
    for (const p of group.paragraphs) {
      const node = paragraph(p)
      if (node) nodes.push(node)
    }
  }

  if (group.images) {
    for (const img of group.images) {
      nodes.push(imageBlock(img))
    }
  }

  if (group.links) {
    for (const link of group.links) {
      const node = linkParagraph(link)
      if (node) nodes.push(node)
    }
  }

  if (group.icons) {
    for (const icon of group.icons) {
      nodes.push(iconNode(icon))
    }
  }

  if (group.videos) {
    for (const video of group.videos) {
      nodes.push(videoNode(video))
    }
  }

  if (group.lists) {
    for (const list of group.lists) {
      const node = bulletList(list)
      if (node) nodes.push(node)
    }
  }

  return nodes
}

// --- Main export ---

/**
 * Build a TipTap document from a content structure.
 *
 * This is the reverse of parseContent(): given a flat content object
 * (title, paragraphs, items, etc.), produce a TipTap document that
 * roundtrips through parseContent() to yield the same structure.
 *
 * @param {Object} content - Content structure (same shape as parseContent output / starter)
 * @returns {Object|null} TipTap document { type: 'doc', content: [...] }, or null if empty
 */
function buildDoc(content) {
  if (!content) return null

  const nodes = []

  // Main group content (title level 1)
  nodes.push(...buildGroupNodes(content, 1))

  // Items: separated by DividerBlock (mirrors divider-based grouping in groups.js)
  if (content.items && content.items.length > 0) {
    for (const item of content.items) {
      nodes.push(dividerBlock())
      // Item headings use level 2 (one below main H1)
      nodes.push(...buildGroupNodes(item, 2))
    }
  }

  if (nodes.length === 0) return null

  return { type: 'doc', content: nodes }
}

export { buildDoc }

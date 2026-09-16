/**
 * Reverse conversion: content structure → TipTap document.
 *
 * Mirrors the forward parser (processors/sequence.js + processors/groups.js)
 * so that parseContent(buildDoc(content)) roundtrips cleanly.
 *
 * Starter content uses plain strings (no HTML marks), so the conversion
 * is straightforward — no need to reverse inline HTML formatting.
 *
 * ## ⭐ IT ACCEPTS THE PARSER'S OWN VOCABULARY TOO — and that is a contract
 *
 * This builder was written with its own spelling for several concepts, and
 * `parseContent` emits a DIFFERENT one for the same thing: a link's text is
 * `text` here and `label` there; an image's address is `src` here and `url`
 * there; a video's cover is a string here and `{ src | url | identifier }`
 * there; a list item is a plain string here and a whole content GROUP there.
 *
 * ⛔ EVERY ONE OF THOSE MISMATCHES FAILED SILENTLY, which is why the rule is
 * now written down. Measured 2026-09-16, all four on the shapes a caller would
 * most naturally reach for:
 *
 *   { links:  [{ label, href }] }        → buildDoc returns **null** outright
 *   { images: [{ url, alt }] }           → an ImageBlock with NO url attr
 *   { videos: [{ coverImg: '/p.jpg' }] } → the cover parses back as ""
 *   { lists:  parsed.lists }             → a text node whose `text` is an
 *                                          OBJECT — an invalid document
 *
 * None of them threw. A generator author reaches for `label` and `url` because
 * those are the names in `docs/reference/component-metadata.md` and the names a
 * component actually reads off `content` — so the natural spelling was the
 * broken one, and it produced an empty section rather than an error.
 *
 * ⇒ For every concept where the two sides disagree, ACCEPT BOTH SPELLINGS. The
 * emitted document is unchanged — this only widens what may come in — so the
 * round-trip assertions above still pin the output. A new field whose name
 * differs from the parser's needs the same treatment, or it joins this list.
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

function linkParagraph({ text, label, href, target }) {
  // `label` is what parseContent emits and what a component reads off
  // `content.links[]`; `text` is this builder's original spelling.
  const caption = text || label
  if (!caption || !href) return null
  const mark = { type: 'link', attrs: { href } }
  if (target) mark.attrs.target = target
  return {
    type: 'paragraph',
    content: [{ type: 'text', text: caption, marks: [mark] }],
  }
}

function imageBlock({ src, url, alt = '', caption = '', direction, role, width, height }) {
  // The node attr is `url` and so is the parsed field; `src` is this builder's
  // original spelling. Either one in, `url` out.
  const attrs = { url: src || url, alt }
  if (caption) attrs.caption = caption
  if (direction) attrs.direction = direction
  if (role) attrs.role = role
  if (width && height) {
    attrs.aspect_ratio = { width, height, ratio: (height / width) * 100 }
  }
  return { type: 'ImageBlock', attrs }
}

function iconNode({ src, url, svg, library, name, size, color }) {
  // UniwebIcon supports multiple source types.
  //
  // The family rides INSIDE `name` as `family:id`. The editor's node declares
  // `{ name, svg, url, size, color, preserveColors, info }` and no `library`,
  // and ProseMirror silently drops undeclared attrs on `fromJSON` — so emitting
  // a separate `library` lost the family without a trace, on the path that
  // builds starter content for every new section.
  //
  // `svg` is MARKUP and `url` is a URL — on both sides. A file-sourced icon
  // arrives here as `src` and belongs in `url`, not in the markup slot; putting
  // a path where a consumer expects `<svg …>` renders nothing. (Fixed
  // 2026-07-30; `url` is declared on the editor's node, so it crosses intact.)
  const attrs = {}
  if (svg) attrs.svg = svg
  // Either spelling in, one spelling out — `parseUniwebIcon` now emits `url`
  // for a file-sourced icon, and this builder's documented invariant is that
  // parseContent(buildDoc(x)) round-trips.
  if (url || src) attrs.url = url || src
  if (name) attrs.name = library ? `${library}:${name}` : name
  if (size) attrs.size = size
  if (color) attrs.color = color
  return { type: 'UniwebIcon', attrs }
}

function videoNode({ src, url, caption, direction, coverImg }) {
  const attrs = { src: src || url }
  if (caption) attrs.caption = caption
  if (direction) attrs.direction = direction
  // ⛔ The editor's `Video` node holds `coverImg` as an OBJECT — the reader is
  // `makeAssetUrl`, which looks for `.src` / `.url` / `.identifier`. A bare
  // string passed straight through parses back as "": `info?.src` on a string
  // is undefined. Normalize here so a caller may write either.
  const cover = typeof coverImg === 'string' ? { src: coverImg } : coverImg
  if (cover && (cover.src || cover.url || cover.identifier)) attrs.coverImg = cover
  return { type: 'Video', attrs }
}

function dividerBlock() {
  return { type: 'DividerBlock' }
}

function bulletList(items) {
  if (!items || !items.length) return null
  const entries = items.map(listItemText).filter(Boolean)
  if (!entries.length) return null
  return {
    type: 'bulletList',
    content: entries.map(text => ({
      type: 'listItem',
      content: [paragraph(text)].filter(Boolean),
    })),
  }
}

/**
 * One list entry's text. A generator writes plain strings; `parseContent`
 * emits a full content GROUP per entry ({ paragraphs, links, … }), and feeding
 * that back produced a text node whose `text` was an object — an invalid
 * document that threw nowhere.
 */
function listItemText(item) {
  if (typeof item === 'string') return item
  if (!item || typeof item !== 'object') return ''
  if (Array.isArray(item.paragraphs) && item.paragraphs.length) {
    return item.paragraphs.join(' ')
  }
  return item.title || ''
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

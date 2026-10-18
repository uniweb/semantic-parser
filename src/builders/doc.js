/**
 * Reverse conversion: content structure → a ProseMirror document in the
 * rich-text vocabulary (`@uniweb/content-reader`'s schema).
 *
 * Mirrors the forward parser (processors/sequence.js + processors/groups.js)
 * so that parseContent(buildDoc(content)) roundtrips cleanly.
 *
 * Starter content uses plain strings (no HTML marks), so the conversion
 * is straightforward — no need to reverse inline HTML formatting.
 *
 * ## ⭐ IT WRITES THE VOCABULARY, IN THE SHAPES MARKDOWN READS TO
 *
 * Every node is one content-reader writes for the same markdown: a picture, a
 * video and a document are an `image` with its `role`, an icon an `image` with
 * `role: 'icon'` inside a paragraph, a divider a `divider`. What this returns is
 * stored as it is and opened like any stored document, so it holds what every
 * reader of a stored document reads — never one editor's own node names.
 * ⛔ Until 2026-10-15 it wrote an editor's TipTap nodes (`ImageBlock`,
 * `UniwebIcon`, `Video`, `DividerBlock`), which the vocabulary does not hold.
 *
 * ## ⭐ IT ACCEPTS THE PARSER'S OWN VOCABULARY TOO — and that is a contract
 *
 * This builder was written with its own spelling for several concepts, and
 * `parseContent` emits a DIFFERENT one for the same thing: a link's text is
 * `text` here and `label` there; an image's address is `src` here and `url`
 * there; a list item is a plain string here and a whole content GROUP there.
 * (A video's cover was a fourth — an editor's `coverImg` — until the parser
 * stopped reading the editor's `Video`, 2026-10-18; both sides say `poster`.)
 *
 * ⛔ EVERY ONE OF THOSE MISMATCHES FAILED SILENTLY, which is why the rule is
 * now written down. Measured 2026-09-16, all four on the shapes a caller would
 * most naturally reach for:
 *
 *   { links:  [{ label, href }] }        → buildDoc returns **null** outright
 *   { images: [{ url, alt }] }           → an image node with NO address
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

// --- Node builders ---

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

/**
 * A label line — `#> Text` — which is how a pretitle is written.
 *
 * ⛔ NOT A SMALLER HEADING BEFORE THE TITLE. That positional form still parses,
 * and it is what this builder emitted until 2026-09-16, but it is the old
 * spelling and it is fragile in a way the label line is not: it means "pretitle"
 * only by sitting before a bigger heading, so the same line moved, or left
 * alone, becomes something else. `#>` says what it is wherever it lands.
 *
 * ⭐ THE `#` COUNT MEANS NOTHING. `#>`, `##>` and `###>` are the same thing —
 * content-reader keeps the authored count in `level` purely so a file
 * round-trips byte-for-byte. We match the level of the title it labels, which is
 * what an author writing by hand does (`##>` above an `##` item title).
 *
 * On the wire it is an ordinary heading carrying `role: 'pretitle'`, so every
 * consumer that already understands headings keeps working.
 */
function labelLine(level, text) {
  if (!text) return null
  if (Array.isArray(text)) return text.map(t => labelLine(level, t)).filter(Boolean)
  return {
    type: 'heading',
    attrs: { level, role: 'pretitle' },
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

/** The attributes an image may hold beside its address, copied when they hold a value. */
const IMAGE_EXTRAS = ['href', 'target', 'author', 'id', 'fit', 'position', 'loading']

function imageNode(image) {
  const { src, url, alt = '', caption = '', placement, role, width, height } = image
  // The node's attr is `src`, this builder's original spelling; the parsed
  // field is `url`. Either one in, `src` out.
  const attrs = { src: src || url, alt, role: role || 'image' }
  if (caption) attrs.caption = caption
  // The picture's own size. Its proportions are these two, so nothing else
  // carries them — ⛔ until 2026-10-15 this wrote an `aspect_ratio` computed
  // from them, which the vocabulary does not hold.
  if (width) attrs.width = width
  if (height) attrs.height = height
  if (placement) attrs.placement = placement
  for (const key of IMAGE_EXTRAS) if (image[key]) attrs[key] = image[key]
  return { type: 'image', attrs }
}

// A document is STORED as the image row with `role: 'pdf'` — the node the
// markdown reader writes and the parser reads as a `document` — so that is what
// this emits. `url` (the parser's spelling) or `src` (this builder's) in.
function documentNode({ url, src, alt = '', caption = '', preview, author, description }) {
  const attrs = { src: url || src, alt, role: 'pdf' }
  if (caption) attrs.caption = caption
  if (preview) attrs.preview = preview
  if (author) attrs.author = author
  if (description) attrs.description = description
  return { type: 'image', attrs }
}

/**
 * An icon, as markdown's `![](lu-house)` reads: an `image` with `role: 'icon'`
 * inside a paragraph — from a library by `library` and `name`, or from a file
 * by its address.
 *
 * `svg` is MARKUP, and a stored document holds none (the vocabulary has no
 * attribute for it), so an icon given only as markup is left out: the builder
 * returns null rather than a node that names no picture. A file-sourced icon
 * arrives as `url` (what the parser emits) or `src`.
 */
function iconNode({ src, url, library, name, size, color }) {
  const attrs = { role: 'icon' }
  if (src || url) {
    attrs.src = src || url
  } else if (name) {
    // A parsed editor node may carry the family inside the name, `family:id`.
    // The vocabulary holds the two apart, as `![](lu-house)` reads.
    if (!library && typeof name === 'string' && name.includes(':')) {
      const [family, ...id] = name.split(':')
      library = family
      name = id.join(':')
    }
    if (library) attrs.library = library
    attrs.name = name
  } else {
    return null
  }
  if (size) attrs.size = size
  if (color) attrs.color = color
  return { type: 'paragraph', content: [{ type: 'image', attrs }] }
}

const PLAYBACK_FLAGS = ['autoplay', 'muted', 'loop', 'controls']

function videoNode(video) {
  const { src, url, alt, caption, placement, poster } = video
  const attrs = { src: src || url, role: 'video' }
  if (alt) attrs.alt = alt
  if (caption) attrs.caption = caption
  // The cover is `poster`, what the parser emits for a video and what a
  // component reads. ⛔ Until 2026-10-18 an editor's `coverImg` was taken too.
  if (poster) attrs.poster = poster
  if (placement) attrs.placement = placement
  for (const flag of PLAYBACK_FLAGS) if (typeof video[flag] === 'boolean') attrs[flag] = video[flag]
  return { type: 'image', attrs }
}

function dividerNode() {
  return { type: 'divider' }
}

/**
 * A code block for DISPLAY — what lands in `content.snippets`.
 *
 * `parseContent` groups one as `{ language, code }`; the element before
 * grouping carries `{ text, attrs }`. Accept either spelling, and a bare string
 * for a snippet with no language.
 */
function codeBlock(snippet) {
  const spec = typeof snippet === 'string' ? { code: snippet } : snippet
  if (!spec || typeof spec !== 'object') return null
  const text = spec.code ?? spec.text
  if (typeof text !== 'string' || text === '') return null
  const attrs = {}
  if (spec.language) attrs.language = spec.language
  if (spec.filename) attrs.filename = spec.filename
  return { type: 'codeBlock', attrs, content: [textNode(text)] }
}

/**
 * A tagged data block — what lands in `content.data[tag]`.
 *
 * ⛔ IT IS A `dataBlock`, NOT A TAGGED `codeBlock`, and the difference is not
 * cosmetic. content-reader emits `dataBlock` when a tagged fence PARSED, with
 * the parsed value on `attrs.data`; it falls back to a tagged `codeBlock`
 * carrying raw TEXT only when parsing failed. A builder handed a real object
 * has parsed data by definition, so emitting the failure shape would hand a
 * component a string where it expects a record.
 *
 * ⭐ `language` IS LOAD-BEARING, not decoration. content-writer reads it back to
 * choose the fence, and the parsed value alone cannot say whether the author
 * wrote YAML or JSON — without it an author's YAML silently becomes JSON on the
 * next editor sync. A builder has no author to echo, so it states one.
 */
function dataBlock(tag, value, language) {
  // A null value is the same absence as no key at all — a component reading
  // `content.data[tag]` gets null either way — so emit no fence rather than one
  // whose whole payload is `null`.
  if (!tag || value === undefined || value === null) return null
  return { type: 'dataBlock', attrs: { tag, language, data: value } }
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
 * Build the nodes of a content group (main or item).
 *
 * @param {Object} group - Content structure: { pretitle, title, subtitle, paragraphs, images, ... }
 * @param {number} titleLevel - Heading level for title (1 for main, 2 for items)
 * @returns {Array} the group's nodes, in the vocabulary
 */
function buildGroupNodes(group, titleLevel = 1, options = {}) {
  const nodes = []

  // 1. Headings: pretitle → title → subtitle.
  // A pretitle is a LABEL LINE (`#> Text`), at the level of the title it labels.
  if (group.pretitle) {
    const pre = labelLine(titleLevel, group.pretitle)
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
      nodes.push(imageNode(img))
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
      const node = iconNode(icon)
      if (node) nodes.push(node)
    }
  }

  if (group.videos) {
    for (const video of group.videos) {
      nodes.push(videoNode(video))
    }
  }

  if (group.documents) {
    for (const doc of group.documents) {
      nodes.push(documentNode(doc))
    }
  }

  if (group.lists) {
    for (const list of group.lists) {
      const node = bulletList(list)
      if (node) nodes.push(node)
    }
  }

  if (group.snippets) {
    for (const snippet of group.snippets) {
      const node = codeBlock(snippet)
      if (node) nodes.push(node)
    }
  }

  // `data` is a MAP of tag → value, not a list: one tagged fence per key, in
  // declaration order.
  //
  // ⚠️ A `concept_block` (```md:faq) also lands in `content.data`, as
  // `{ items, sequence }` — a tagged PROSE fence, not data. This does not
  // reconstruct one: it emits the data fence, whose payload round-trips to the
  // same value. Prose that was parsed into a document does not come back as
  // prose here, and a caller rebuilding a concept block wants the markdown.
  if (group.data && typeof group.data === 'object' && !Array.isArray(group.data)) {
    const language = options.dataLanguage || 'yaml'
    for (const [tag, value] of Object.entries(group.data)) {
      const node = dataBlock(tag, value, language)
      if (node) nodes.push(node)
    }
  }

  return nodes
}

// --- Main export ---

/**
 * Build a document in the vocabulary from a content structure.
 *
 * This is the reverse of parseContent(): given a flat content object
 * (title, paragraphs, items, etc.), produce a ProseMirror document that
 * roundtrips through parseContent() to yield the same structure.
 *
 * @param {Object} content - Content structure (same shape as parseContent output / starter)
 * @param {Object} [options]
 * @param {string} [options.dataLanguage='yaml'] - the fence a tagged data block
 *   is written as. It is recorded on the node because content-writer reads it
 *   back to choose the fence, and a parsed value cannot say which one it was.
 * @returns {Object|null} a document { type: 'doc', content: [...] }, or null if empty
 */
function buildDoc(content, options = {}) {
  if (!content) return null

  const nodes = []

  // Main group content (title level 1)
  nodes.push(...buildGroupNodes(content, 1, options))

  // Items: separated by a divider (mirrors divider-based grouping in groups.js)
  if (content.items && content.items.length > 0) {
    for (const item of content.items) {
      nodes.push(dividerNode())
      // Item headings use level 2 (one below main H1)
      nodes.push(...buildGroupNodes(item, 2, options))
    }
  }

  if (nodes.length === 0) return null

  return { type: 'doc', content: nodes }
}

export { buildDoc }

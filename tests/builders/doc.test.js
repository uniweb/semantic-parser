import { parseContent, buildDoc } from '../../src/index.js'

// --- Helper: strip raw/sequence from parseContent output for comparison ---
function contentOnly(parsed) {
  const { raw, sequence, ...rest } = parsed
  return rest
}

// --- Helper: normalize empty fields for comparison ---
// parseContent always returns all fields; starter may omit empty ones.
// This fills in defaults so we can compare.
function withDefaults(obj) {
  return {
    title: '',
    pretitle: '',
    subtitle: '',
    paragraphs: [],
    links: [],
    images: [],
    icons: [],
    videos: [],
    lists: [],
    insets: [],
    snippets: [],
    data: {},
    quotes: [],
    headings: [],
    items: [],
    ...obj,
  }
}

function withItemDefaults(item) {
  return {
    title: '',
    pretitle: '',
    subtitle: '',
    paragraphs: [],
    links: [],
    images: [],
    icons: [],
    videos: [],
    lists: [],
    insets: [],
    snippets: [],
    data: {},
    quotes: [],
    headings: [],
    ...item,
  }
}

describe('buildDoc', () => {
  test('returns null for null/undefined input', () => {
    expect(buildDoc(null)).toBeNull()
    expect(buildDoc(undefined)).toBeNull()
  })

  test('returns null for empty object', () => {
    expect(buildDoc({})).toBeNull()
  })

  describe('simple content (no items)', () => {
    test('title only', () => {
      const starter = { title: 'Hello' }
      const doc = buildDoc(starter)
      const parsed = contentOnly(parseContent(doc))

      expect(parsed.title).toBe('Hello')
      expect(parsed.paragraphs).toEqual([])
      expect(parsed.items).toEqual([])
    })

    test('title + paragraphs', () => {
      const starter = {
        title: 'My Section',
        paragraphs: ['First paragraph.', 'Second paragraph.'],
      }
      const doc = buildDoc(starter)
      const parsed = contentOnly(parseContent(doc))

      expect(parsed.title).toBe('My Section')
      expect(parsed.paragraphs).toEqual(['First paragraph.', 'Second paragraph.'])
    })

    test('title + subtitle', () => {
      const starter = {
        title: 'Main Title',
        subtitle: 'A Subtitle',
      }
      const doc = buildDoc(starter)
      const parsed = contentOnly(parseContent(doc))

      expect(parsed.title).toBe('Main Title')
      expect(parsed.subtitle).toBe('A Subtitle')
    })

    test('pretitle + title', () => {
      const starter = {
        pretitle: 'WELCOME',
        title: 'Main Title',
      }
      const doc = buildDoc(starter)
      const parsed = contentOnly(parseContent(doc))

      expect(parsed.pretitle).toBe('WELCOME')
      expect(parsed.title).toBe('Main Title')
    })

    test('pretitle + title + subtitle', () => {
      const starter = {
        pretitle: 'EYEBROW',
        title: 'Main Title',
        subtitle: 'Subtitle Here',
      }
      const doc = buildDoc(starter)
      const parsed = contentOnly(parseContent(doc))

      expect(parsed.pretitle).toBe('EYEBROW')
      expect(parsed.title).toBe('Main Title')
      expect(parsed.subtitle).toBe('Subtitle Here')
    })

    test('multi-line title (string array)', () => {
      const starter = {
        title: ['Line One', 'Line Two'],
      }
      const doc = buildDoc(starter)
      const parsed = contentOnly(parseContent(doc))

      expect(parsed.title).toEqual(['Line One', 'Line Two'])
    })

    test('images', () => {
      const starter = {
        title: 'Gallery',
        images: [
          { src: 'https://placehold.co/800x600', alt: 'Placeholder' },
        ],
      }
      const doc = buildDoc(starter)
      const parsed = contentOnly(parseContent(doc))

      expect(parsed.title).toBe('Gallery')
      expect(parsed.images).toHaveLength(1)
      expect(parsed.images[0].url).toBe('https://placehold.co/800x600')
      expect(parsed.images[0].alt).toBe('Placeholder')
    })

    test('images with dimensions produce aspect_ratio', () => {
      const starter = {
        images: [
          { src: 'https://placehold.co/800x600', alt: 'Photo', width: 800, height: 600 },
        ],
      }
      const doc = buildDoc(starter)
      const imgNode = doc.content.find(n => n.type === 'ImageBlock')

      expect(imgNode.attrs.aspect_ratio).toEqual({ width: 800, height: 600, ratio: 75 })
    })

    test('links', () => {
      const starter = {
        title: 'CTA Section',
        links: [{ text: 'Learn More', href: '/about' }],
      }
      const doc = buildDoc(starter)
      const parsed = contentOnly(parseContent(doc))

      expect(parsed.title).toBe('CTA Section')
      expect(parsed.links).toHaveLength(1)
      expect(parsed.links[0].href).toBe('/about')
      expect(parsed.links[0].label).toBe('Learn More')
    })
  })

  describe('content with items', () => {
    test('title + items with titles and paragraphs', () => {
      const starter = {
        title: 'Features',
        items: [
          { title: 'Feature 1', paragraphs: ['Description 1.'] },
          { title: 'Feature 2', paragraphs: ['Description 2.'] },
          { title: 'Feature 3', paragraphs: ['Description 3.'] },
        ],
      }
      const doc = buildDoc(starter)
      const parsed = contentOnly(parseContent(doc))

      expect(parsed.title).toBe('Features')
      expect(parsed.items).toHaveLength(3)
      expect(parsed.items[0].title).toBe('Feature 1')
      expect(parsed.items[0].paragraphs).toEqual(['Description 1.'])
      expect(parsed.items[1].title).toBe('Feature 2')
      expect(parsed.items[2].title).toBe('Feature 3')
    })

    test('main content + items', () => {
      const starter = {
        title: 'Our Services',
        paragraphs: ['We offer the best services.'],
        items: [
          { title: 'Service A' },
          { title: 'Service B', paragraphs: ['Details about B.'] },
        ],
      }
      const doc = buildDoc(starter)
      const parsed = contentOnly(parseContent(doc))

      expect(parsed.title).toBe('Our Services')
      expect(parsed.paragraphs).toEqual(['We offer the best services.'])
      expect(parsed.items).toHaveLength(2)
      expect(parsed.items[0].title).toBe('Service A')
      expect(parsed.items[1].title).toBe('Service B')
      expect(parsed.items[1].paragraphs).toEqual(['Details about B.'])
    })

    test('items with images', () => {
      const starter = {
        title: 'Portfolio',
        items: [
          {
            title: 'Project 1',
            images: [{ src: 'https://placehold.co/400x300', alt: 'Project 1' }],
          },
        ],
      }
      const doc = buildDoc(starter)
      const parsed = contentOnly(parseContent(doc))

      expect(parsed.items).toHaveLength(1)
      expect(parsed.items[0].title).toBe('Project 1')
      expect(parsed.items[0].images).toHaveLength(1)
      expect(parsed.items[0].images[0].url).toBe('https://placehold.co/400x300')
    })
  })

  describe('SplitContent starter (real-world)', () => {
    test('matches expected structure', () => {
      const starter = {
        title: 'Your Heading',
        paragraphs: ['Write your description here.'],
        images: [{ src: 'https://placehold.co/800x600', alt: 'Placeholder image' }],
      }
      const doc = buildDoc(starter)
      const parsed = contentOnly(parseContent(doc))

      expect(parsed.title).toBe('Your Heading')
      expect(parsed.paragraphs).toEqual(['Write your description here.'])
      expect(parsed.images).toHaveLength(1)
      expect(parsed.images[0].url).toBe('https://placehold.co/800x600')
    })
  })

  describe('Features starter (real-world)', () => {
    test('matches expected structure', () => {
      const starter = {
        title: 'Features',
        items: [
          { title: 'Feature 1', paragraphs: ['Description of feature 1.'] },
          { title: 'Feature 2', paragraphs: ['Description of feature 2.'] },
          { title: 'Feature 3', paragraphs: ['Description of feature 3.'] },
        ],
      }
      const doc = buildDoc(starter)
      const parsed = contentOnly(parseContent(doc))

      expect(parsed.title).toBe('Features')
      expect(parsed.items).toHaveLength(3)
      parsed.items.forEach((item, i) => {
        expect(item.title).toBe(`Feature ${i + 1}`)
        expect(item.paragraphs).toEqual([`Description of feature ${i + 1}.`])
      })
    })
  })

  describe('edge cases', () => {
    test('paragraphs only (no title)', () => {
      const starter = { paragraphs: ['Just a paragraph.'] }
      const doc = buildDoc(starter)
      const parsed = contentOnly(parseContent(doc))

      expect(parsed.title).toBe('')
      expect(parsed.paragraphs).toEqual(['Just a paragraph.'])
    })

    test('empty items array', () => {
      const starter = { title: 'Section', items: [] }
      const doc = buildDoc(starter)
      const parsed = contentOnly(parseContent(doc))

      expect(parsed.title).toBe('Section')
      expect(parsed.items).toEqual([])
    })

    test('items with pretitle', () => {
      const starter = {
        title: 'Main',
        items: [
          { pretitle: 'STEP 1', title: 'First Step', paragraphs: ['Do this.'] },
        ],
      }
      const doc = buildDoc(starter)
      const parsed = contentOnly(parseContent(doc))

      expect(parsed.items).toHaveLength(1)
      expect(parsed.items[0].pretitle).toBe('STEP 1')
      expect(parsed.items[0].title).toBe('First Step')
    })
  })
})

describe('icon identity crosses to the editor intact', () => {
  test('the family rides inside name as family:id, with no library attr', () => {
    // The editor's UniwebIcon declares { name, svg, url, size, color,
    // preserveColors, info } and NO `library`. ProseMirror silently drops
    // undeclared attrs on fromJSON, so emitting a separate `library` lost the
    // family without a trace — on the path that builds starter content for
    // every new section.
    const doc = buildDoc({ icons: [{ library: 'lucide', name: 'star' }] })
    const icon = doc.content.find(n => n.type === 'UniwebIcon')
    expect(icon.attrs.name).toBe('lucide:star')
    expect(icon.attrs).not.toHaveProperty('library')
  })

  test('a name with no family is emitted unchanged', () => {
    const doc = buildDoc({ icons: [{ name: 'star' }] })
    expect(doc.content.find(n => n.type === 'UniwebIcon').attrs.name).toBe('star')
  })

  test('parseContent(buildDoc(x)) still round-trips to the separate form', () => {
    // The documented invariant of this builder, and what <Icon library name />
    // consumes downstream.
    const parsed = parseContent(buildDoc({ icons: [{ library: 'lucide', name: 'star' }] }))
    expect(parsed.icons).toEqual([{ library: 'lucide', name: 'star' }])
  })

  // `svg` is markup, `url` is a URL — on both sides. A file path in the markup
  // slot renders nothing, and did until 2026-07-30.
  test('a file-sourced icon lands in url, never in the svg slot', () => {
    const icon = buildDoc({ icons: [{ src: '/uploads/mine.svg' }] }).content.find(
      n => n.type === 'UniwebIcon'
    )
    expect(icon.attrs.url).toBe('/uploads/mine.svg')
    expect(icon.attrs).not.toHaveProperty('svg')
  })

  test('inline svg markup still lands in the svg slot', () => {
    const icon = buildDoc({ icons: [{ svg: '<svg viewBox="0 0 1 1"/>' }] }).content.find(
      n => n.type === 'UniwebIcon'
    )
    expect(icon.attrs.svg).toBe('<svg viewBox="0 0 1 1"/>')
    expect(icon.attrs).not.toHaveProperty('url')
  })

  test('a file-sourced icon round-trips — the builder accepts what the parser emits', () => {
    // parseUniwebIcon emits `url`; this builder took only `src`, so the
    // round-trip invariant in this file's header would have broken silently.
    expect(parseContent(buildDoc({ icons: [{ url: '/uploads/mine.svg' }] })).icons).toEqual([
      { url: '/uploads/mine.svg' },
    ])
  })
})

// ⭐ The builder has its own spelling for several concepts and `parseContent`
// emits a different one for the same thing. Every mismatch failed SILENTLY —
// a null document, an attr-less node, an empty string, an invalid text node —
// and the parser's spelling is the one a generator reaches for first, because
// it is what a component reads and what the reference docs show. Both must
// work. (Measured 2026-09-16; the icon case above is the same rule, found
// earlier.)
describe('accepts the parser\'s vocabulary as well as its own', () => {
  test('a link may say `label` (parsed) or `text` (builder)', () => {
    for (const link of [{ label: 'Learn more', href: '/a' }, { text: 'Learn more', href: '/a' }]) {
      const parsed = parseContent(buildDoc({ links: [link] }))
      expect(parsed.links).toHaveLength(1)
      expect(parsed.links[0].label).toBe('Learn more')
      expect(parsed.links[0].href).toBe('/a')
    }
  })

  test('a links-only structure builds a document rather than null', () => {
    // `{ label }` returned null outright: no nodes, no error, no section.
    expect(buildDoc({ links: [{ label: 'Go', href: '/go' }] })).not.toBeNull()
  })

  test('an image may say `url` (parsed) or `src` (builder)', () => {
    for (const image of [{ url: '/a.png', alt: 'A' }, { src: '/a.png', alt: 'A' }]) {
      const parsed = parseContent(buildDoc({ images: [image] }))
      expect(parsed.images).toHaveLength(1)
      expect(parsed.images[0].url).toBe('/a.png')
    }
  })

  test("a video's cover may be a string or the node's object shape", () => {
    // `makeAssetUrl` reads .src/.url/.identifier, so a bare string parsed as "".
    for (const coverImg of ['/p.jpg', { src: '/p.jpg' }, { url: '/p.jpg' }]) {
      const parsed = parseContent(buildDoc({ videos: [{ src: '/v.mp4', coverImg }] }))
      expect(parsed.videos[0].coverImg).toBe('/p.jpg')
    }
  })

  test('a list entry may be a plain string or a parsed content group', () => {
    const fromStrings = parseContent(buildDoc({ lists: [['a', 'b']] })).lists
    // Feeding the parsed form back produced a text node holding an OBJECT.
    const rebuilt = parseContent(buildDoc({ lists: fromStrings })).lists
    expect(rebuilt).toHaveLength(1)
    expect(rebuilt[0].map(entry => entry.paragraphs)).toEqual([['a'], ['b']])
  })
})

// ⭐ Code blocks are the builder's newest slots, and the two of them are
// DIFFERENT NODES for a reason content-reader already encodes: a tagged fence
// that PARSED is a `dataBlock` carrying the parsed value; one that failed to
// parse degrades to a tagged `codeBlock` carrying raw text. A builder handed a
// real object has parsed data by definition.
describe('code blocks', () => {
  test('a snippet round-trips with its language', () => {
    const parsed = parseContent(buildDoc({ snippets: [{ language: 'js', code: 'const x = 1' }] }))
    expect(parsed.snippets).toEqual([{ language: 'js', code: 'const x = 1' }])
  })

  test('a snippet may say `code` (parsed) or `text` (the pre-grouping element)', () => {
    expect(parseContent(buildDoc({ snippets: [{ language: 'py', text: 'x = 1' }] })).snippets).toEqual([
      { language: 'py', code: 'x = 1' },
    ])
  })

  test('a bare string is a snippet with no language', () => {
    expect(parseContent(buildDoc({ snippets: ['plain'] })).snippets).toEqual([
      { language: '', code: 'plain' },
    ])
  })

  test('an empty snippet builds no node rather than an empty fence', () => {
    expect(buildDoc({ snippets: [{ language: 'js', code: '' }, '', null] })).toBeNull()
  })

  test('tagged data round-trips as a dataBlock, keyed by its tag', () => {
    const data = { api: { method: 'GET', path: '/v1/things', parameters: [{ name: 'limit' }] } }
    expect(parseContent(buildDoc({ data })).data).toEqual(data)
  })

  test('it is a dataBlock, not a tagged codeBlock', () => {
    // The tagged-codeBlock shape is content-reader's PARSE FAILURE fallback and
    // carries raw text — a component reading a record would get a string.
    const doc = buildDoc({ data: { api: { method: 'GET' } } })
    const node = doc.content[0]
    expect(node.type).toBe('dataBlock')
    expect(node.attrs.data).toEqual({ method: 'GET' })
  })

  test('the language is recorded, because the value cannot state it', () => {
    // content-writer reads it back to pick the fence; without it an author's
    // YAML silently becomes JSON on the next sync.
    expect(buildDoc({ data: { nav: [] } }).content[0].attrs.language).toBe('yaml')
    expect(buildDoc({ data: { scene: {} } }, { dataLanguage: 'json' }).content[0].attrs.language).toBe('json')
  })

  test('several tags become several blocks, in declaration order', () => {
    const doc = buildDoc({ data: { first: { a: 1 }, second: { b: 2 } } })
    expect(doc.content.map(n => n.attrs.tag)).toEqual(['first', 'second'])
  })

  test('an item carries its own snippets and data', () => {
    const parsed = parseContent(
      buildDoc({
        title: 'Lessons',
        items: [{ title: 'One', snippets: [{ language: 'js', code: 'go()' }], data: { quiz: { q: 'why' } } }],
      }),
    )
    expect(parsed.items[0].snippets).toEqual([{ language: 'js', code: 'go()' }])
    expect(parsed.items[0].data).toEqual({ quiz: { q: 'why' } })
  })

  test('a data map that is not a map is ignored rather than mis-built', () => {
    expect(buildDoc({ data: [] })).toBeNull()
    expect(buildDoc({ data: 'nope' })).toBeNull()
  })
})

// ⭐ A PRETITLE IS A LABEL LINE (`#> Text`), not a smaller heading before the
// title. The positional form still parses — this builder emitted it until
// 2026-09-16 — but it is the old spelling, and it carries its meaning only by
// position: the same line moved, or left on its own, stops being a pretitle.
describe('pretitle is written as a label line', () => {
  test('it emits a heading with role pretitle, never a bare smaller heading', () => {
    const doc = buildDoc({ pretitle: 'Now in open beta', title: 'Ship your site' })
    const [first] = doc.content
    expect(first.attrs.role).toBe('pretitle')
    // the old form: a level-3 heading with no role, sitting before the title
    expect(doc.content.some(n => n.type === 'heading' && !n.attrs.role && n.attrs.level === 3)).toBe(false)
  })

  test('the label takes the level of the title it labels', () => {
    // The count means nothing to the parser; it matches what an author types.
    const doc = buildDoc({ title: 'T', pretitle: 'P', items: [{ pretitle: 'IP', title: 'I' }] })
    const labels = doc.content.filter(n => n.attrs?.role === 'pretitle')
    expect(labels.map(n => n.attrs.level)).toEqual([1, 2])
  })

  test('a pretitle with no title is still a pretitle', () => {
    // The positional form cannot express this: with nothing bigger after it,
    // a lone smaller heading is just a heading.
    const parsed = parseContent(buildDoc({ pretitle: 'Just a label' }))
    expect(parsed.pretitle).toBe('Just a label')
    expect(parsed.title).toBe('')
  })

  test('it round-trips', () => {
    expect(parseContent(buildDoc({ pretitle: 'P', title: 'T' }))).toMatchObject({ pretitle: 'P', title: 'T' })
  })
})

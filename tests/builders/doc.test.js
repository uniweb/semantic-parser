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

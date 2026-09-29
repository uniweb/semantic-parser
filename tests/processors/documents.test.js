/**
 * A document is a kind of content of its own — `content.documents`.
 *
 * Stored as the image row with `role: 'pdf'`, as a video is stored with
 * `role: 'video'`, and delivered apart from images, as a video is. Until
 * 2026-09-29 a document landed in `content.images`, where a component drew it
 * as an image of the file, while the runtime had guaranteed an empty
 * `content.documents` on every block since January; and the editor's older
 * `document-group` container sent the same concept to `content.links`.
 */
import { describe, test, expect } from 'vitest'
import { parseContent, buildDoc, mimeFor, MIME_TYPES } from '../../src/index.js'

const doc = (...content) => ({ type: 'doc', content })
const pdf = (attrs = {}) => ({
  type: 'image',
  attrs: { src: '/files/report.pdf', alt: 'Annual report', role: 'pdf', ...attrs },
})

describe('a document is delivered in content.documents', () => {
  test('a block-level role=pdf lands in documents, and not in images', () => {
    const c = parseContent(doc(pdf({ preview: '/files/cover.jpg' })))
    expect(c.documents).toHaveLength(1)
    expect(c.documents[0]).toMatchObject({
      url: '/files/report.pdf',
      alt: 'Annual report',
      role: 'pdf',
      preview: '/files/cover.jpg',
    })
    expect(c.images).toEqual([])
  })

  test('CONTROL — an image stays an image, and documents stays empty', () => {
    const c = parseContent(doc({ type: 'image', attrs: { src: '/i.jpg', alt: 'A photo' } }))
    expect(c.images).toHaveLength(1)
    expect(c.documents).toEqual([])
  })

  test('the sequence carries it as a document element, in place', () => {
    const c = parseContent(
      doc(
        { type: 'paragraph', content: [{ type: 'text', text: 'Before.' }] },
        pdf(),
        { type: 'paragraph', content: [{ type: 'text', text: 'After.' }] }
      )
    )
    expect(c.sequence.map((e) => e.type)).toEqual(['paragraph', 'document', 'paragraph'])
  })

  test('a document inline with prose lands in documents too', () => {
    const c = parseContent(
      doc({
        type: 'paragraph',
        content: [{ type: 'text', text: 'See the ' }, pdf(), { type: 'text', text: ' for details.' }],
      })
    )
    expect(c.documents).toHaveLength(1)
    expect(c.images).toEqual([])
  })

  test('each entry has its own documents', () => {
    const c = parseContent(
      doc(
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Reports' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '2025' }] },
        pdf({ src: '/r/2025.pdf' }),
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '2026' }] },
        pdf({ src: '/r/2026.pdf' })
      )
    )
    expect(c.items.map((item) => item.documents.map((d) => d.url))).toEqual([['/r/2025.pdf'], ['/r/2026.pdf']])
  })
})

describe("the editor's older document-group", () => {
  test('its documents are documents — the same shape — not links', () => {
    const c = parseContent(
      doc({
        type: 'document-group',
        content: [
          { type: 'document', attrs: { src: '/files/a.pdf', title: 'Handbook', coverImg: null } },
          { type: 'document', attrs: { src: '/files/b.pdf', title: 'Forms', author: 'HR' } },
        ],
      })
    )
    expect(c.documents).toEqual([
      { url: '/files/a.pdf', name: 'a.pdf', mime: 'application/pdf', alt: 'Handbook', caption: 'Handbook', role: 'pdf' },
      { url: '/files/b.pdf', name: 'b.pdf', mime: 'application/pdf', alt: 'Forms', caption: 'Forms', role: 'pdf', author: 'HR' },
    ])
    expect(c.links).toEqual([])
    expect(c.sequence.map((e) => e.type)).toEqual(['document', 'document'])
  })
})

describe('buildDoc writes a document back as the stored node', () => {
  test('parseContent(buildDoc(x)) keeps it', () => {
    const built = buildDoc({
      title: 'Reports',
      documents: [{ url: '/files/report.pdf', alt: 'Annual report', preview: '/files/cover.jpg', author: 'Ada' }],
    })
    const node = built.content.find((n) => n.type === 'image')
    expect(node.attrs).toMatchObject({ src: '/files/report.pdf', role: 'pdf', preview: '/files/cover.jpg' })
    const back = parseContent(built)
    expect(back.documents).toHaveLength(1)
    expect(back.documents[0]).toMatchObject({
      url: '/files/report.pdf',
      alt: 'Annual report',
      preview: '/files/cover.jpg',
      author: 'Ada',
    })
  })
})

describe("a document's file — the field names a file record's value has", () => {
  // `{ url, name, mime, size }`, so one component renders a downloads list from a file
  // record or a document alike [Diego, 2026-09-29].
  test('name and mime from its address; size only where a producer knows it', () => {
    const [d] = parseContent(doc(pdf({ src: '/files/Annual%20report.pdf?v=2' }))).documents
    expect(d).toMatchObject({ url: '/files/Annual%20report.pdf?v=2', name: 'Annual report.pdf', mime: 'application/pdf' })
    expect(d).not.toHaveProperty('size')
  })

  test('a stamped name, mime and size win — the build copies a file under a hashed name', () => {
    const [d] = parseContent(
      doc(pdf({ src: '/assets/report-1a2b3c4d.pdf', name: 'report.pdf', mime: 'application/pdf', size: 48213 })),
    ).documents
    expect(d).toMatchObject({ name: 'report.pdf', mime: 'application/pdf', size: 48213 })
  })

  test('another kind of file has its own type', () => {
    const [d] = parseContent(doc(pdf({ src: '/files/budget.xlsx' }))).documents
    expect(d.mime).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  })

  test('an address that names no file gives neither', () => {
    const [d] = parseContent(doc(pdf({ src: 'https://example.com/' }))).documents
    expect(d).not.toHaveProperty('name')
    expect(d).not.toHaveProperty('mime')
  })

  test('one extension → type table, exported for the build to read', () => {
    expect(MIME_TYPES.pdf).toBe('application/pdf')
    expect(mimeFor('brochure.PDF')).toBe('application/pdf')
    expect(mimeFor('.env')).toBe('application/octet-stream')
    expect(mimeFor('notes')).toBe('application/octet-stream')
  })
})

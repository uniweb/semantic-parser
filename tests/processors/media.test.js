/**
 * `content.media` — a group's visual media, in the order written.
 *
 * `images`, `videos` and `insets` are separate arrays, so they keep an author's order
 * within one kind and lose it across kinds: a gallery mixing a photo, a video and an
 * embedded component could not say which came first — only `content.sequence` could.
 * `media` holds each block-level image, video and inset in the order written, tagged
 * with its `kind`, beside the three arrays, which keep what they hold.
 */
import { describe, test, expect } from 'vitest'
import { parseContent } from '../../src/index.js'

const doc = (...content) => ({ type: 'doc', content })
const heading = (level, text) => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] })
const para = (text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const image = (src, attrs = {}) => ({ type: 'image', attrs: { src, alt: '', ...attrs } })
const video = (src) => ({ type: 'image', attrs: { src, alt: '', role: 'video' } })
const inset = (refId) => ({ type: 'inset_placeholder', attrs: { refId } })

describe('content.media', () => {
  test('holds the images, videos and insets in the order written, each with its kind', () => {
    const c = parseContent(doc(heading(1, 'Gallery'), video('/a.mp4'), image('/b.jpg'), inset('inset_0'), image('/c.jpg')))
    expect(c.media.map((m) => m.kind)).toEqual(['video', 'image', 'inset', 'image'])
    expect(c.media[0]).toMatchObject({ kind: 'video', src: '/a.mp4' })
    expect(c.media[1]).toMatchObject({ kind: 'image', url: '/b.jpg' })
    expect(c.media[2]).toEqual({ kind: 'inset', refId: 'inset_0' })
  })

  test('additive: images, videos and insets keep what they hold', () => {
    const c = parseContent(doc(video('/a.mp4'), image('/b.jpg'), inset('inset_0')))
    expect(c.images.map((i) => i.url)).toEqual(['/b.jpg'])
    expect(c.videos.map((v) => v.src)).toEqual(['/a.mp4'])
    expect(c.insets).toEqual([{ refId: 'inset_0' }])
  })

  test('an image inside a sentence belongs to the text — in images, not in media', () => {
    const c = parseContent(
      doc({ type: 'paragraph', content: [{ type: 'text', text: 'See ' }, image('/inline.jpg'), { type: 'text', text: ' here.' }] }),
    )
    expect(c.images).toHaveLength(1)
    expect(c.media).toEqual([])
  })

  test('an icon and a document are not visual media', () => {
    const c = parseContent(
      doc(image('lu-star', { role: 'icon', library: 'lu', name: 'star' }), image('/r.pdf', { role: 'pdf', alt: 'Report' })),
    )
    expect(c.icons).toHaveLength(1)
    expect(c.documents).toHaveLength(1)
    expect(c.media).toEqual([])
  })

  test('each entry has its own, as it has its own images', () => {
    const c = parseContent(
      doc(heading(1, 'Cards'), heading(3, 'One'), para('A photo.'), image('/1.jpg'), heading(3, 'Two'), para('A clip.'), video('/2.mp4')),
    )
    expect(c.media).toEqual([])
    expect(c.items.map((item) => item.media.map((m) => m.kind))).toEqual([['image'], ['video']])
  })

  test('always there — empty when a group has none', () => {
    expect(parseContent(doc()).media).toEqual([])
    expect(parseContent(doc(para('Just text.'))).media).toEqual([])
  })
})

/**
 * Store-held asset resolution — `assetId` + `assetExt` through the host's
 * `config.assets.url` template.
 *
 * The rule under test, settled framework ↔ backend ↔ frontend 2026-08-17:
 * **a store-held asset wins WHEN IT RESOLVES, not merely when it is present.**
 * That is what lets a producer write `assetId` alongside `src` before any
 * deployment declares a template — until one does, the node renders through
 * `src` exactly as before.
 *
 * The unresolvable cases are the point of the suite, not the happy path: each
 * must fall through, and none may emit a half-built URL.
 */

import { parseContent, resolveAssetUrl } from '../../src/index.js'

const TEMPLATE = 'https://cdn.example/x/{id}/base.{ext}'
const ID = 'a'.repeat(64)

const docWith = (attrs) => ({
  type: 'doc',
  content: [{ type: 'image', attrs }],
})

const imageOf = (doc, options) =>
  parseContent(doc, options).sequence.find((e) => e.type === 'image')

describe('resolveAssetUrl', () => {
  it('substitutes {id} and {ext}', () => {
    expect(resolveAssetUrl(ID, 'png', TEMPLATE)).toBe(
      `https://cdn.example/x/${ID}/base.png`
    )
  })

  it('is unresolved without a template — absent means absent, never a guess', () => {
    expect(resolveAssetUrl(ID, 'png', undefined)).toBe('')
    expect(resolveAssetUrl(ID, 'png', '')).toBe('')
  })

  it('is unresolved without an id', () => {
    expect(resolveAssetUrl('', 'png', TEMPLATE)).toBe('')
    expect(resolveAssetUrl(null, 'png', TEMPLATE)).toBe('')
  })

  it('⛔ refuses an unknown placeholder rather than emitting a half-built URL', () => {
    // Half-substitution is worse than nothing: it produces a URL-shaped string
    // that 404s, so the failure reads as a missing file rather than a contract
    // mismatch between the host's template and this resolver.
    expect(resolveAssetUrl(ID, 'png', 'https://cdn/{id}/{size}.{ext}')).toBe('')
  })

  it('⛔ refuses {ext} with no assetExt — `base.` reads as a typo', () => {
    expect(resolveAssetUrl(ID, '', TEMPLATE)).toBe('')
    expect(resolveAssetUrl(ID, undefined, TEMPLATE)).toBe('')
  })

  it('carries a template that names no host verbatim (the host owns the whole string)', () => {
    // The wire requires an absolute template, but enforcement is not this
    // function's job — it substitutes and returns. Anything else would be the
    // resolver deciding what a serve location may look like.
    expect(resolveAssetUrl(ID, 'png', '/rel/{id}/base.{ext}')).toBe(
      `/rel/${ID}/base.png`
    )
  })
})

describe('image precedence', () => {
  it('resolves assetId through the template, over a present src', () => {
    const el = imageOf(docWith({ assetId: ID, assetExt: 'png', src: '/old.png' }), {
      assets: { url: TEMPLATE },
    })
    expect(el.attrs.url).toBe(`https://cdn.example/x/${ID}/base.png`)
  })

  it('⭐ falls through to src when the template is absent — the interim case', () => {
    // This is what makes it safe for the editor to write assetId today, before
    // any deployment emits config.assets.url. It must render exactly as before.
    const el = imageOf(docWith({ assetId: ID, assetExt: 'png', src: '/old.png' }))
    expect(el.attrs.url).toBe('/old.png')
  })

  it('falls through to src when the template is unresolvable', () => {
    const el = imageOf(docWith({ assetId: ID, assetExt: 'png', src: '/old.png' }), {
      assets: { url: 'https://cdn/{id}/{size}.{ext}' },
    })
    expect(el.attrs.url).toBe('/old.png')
  })

  it('leaves a plain src untouched when there is no assetId', () => {
    const el = imageOf(docWith({ src: '/plain.png' }), { assets: { url: TEMPLATE } })
    expect(el.attrs.url).toBe('/plain.png')
  })

  it('resolves inside a blockquote — nested content gets the same options', () => {
    // `blockquote` and `inset_block` dropped `options` until 2026-08-17. That was
    // inert while nothing read them; an asset nested in a quote would otherwise
    // lose its template and silently fall back.
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [{ type: 'image', attrs: { assetId: ID, assetExt: 'png' } }],
        },
      ],
    }
    const quote = parseContent(doc, { assets: { url: TEMPLATE } }).sequence.find(
      (e) => e.type === 'blockquote'
    )
    const img = quote.children.find((c) => c.type === 'image')
    expect(img.attrs.url).toBe(`https://cdn.example/x/${ID}/base.png`)
  })
})

describe('video precedence — aligned with image', () => {
  const videoOf = (attrs, options) =>
    parseContent(
      { type: 'doc', content: [{ type: 'image', attrs: { role: 'video', ...attrs } }] },
      options
    ).sequence.find((e) => e.type === 'video')

  it('resolves assetId over a present src', () => {
    const el = videoOf({ assetId: ID, assetExt: 'mp4', src: '/old.mp4' }, {
      assets: { url: TEMPLATE },
    })
    expect(el.attrs.src).toBe(`https://cdn.example/x/${ID}/base.mp4`)
  })

  it('falls through to src with no template', () => {
    const el = videoOf({ assetId: ID, assetExt: 'mp4', src: '/old.mp4' })
    expect(el.attrs.src).toBe('/old.mp4')
  })

  it('⚠️ a legacy identifier now beats a stale src, matching the image path', () => {
    // The comment on this parser claimed parity with parseImgBlock for years
    // while the code did the opposite — it passed `src` into makeAssetUrl, which
    // returns a src before it looks at `identifier`. Aligned to the documented
    // intent 2026-08-17; this pins the direction so it cannot drift back.
    const el = videoOf({ src: '/stale.mp4', info: { identifier: 'v1/clip.mp4' } })
    expect(el.attrs.src).toBe('https://assets.uniweb.app/dist/v1/base.mp4')
  })
})

describe('every node shape the editor can emit resolves', () => {
  // ⛔ The app lane does NOT emit framework-dialect `image`. An upload sets an
  // editor-only attr (aspect_ratio), which promotes the node, so it stays
  // `ImageBlock` — and videos stay `Video` for the same reason. A literal reading
  // of "assetId on the image node" would leave every app-uploaded asset
  // unresolvable. These pin the other shapes so a later cleanup cannot remove
  // them as dead legacy tolerance. (Found from the consuming side by the app
  // lane, reading the shipped resolver — not by this package's own tests.)

  it('resolves on an editor ImageBlock node', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'ImageBlock', attrs: { assetId: ID, assetExt: 'png' } }],
    }
    const el = parseContent(doc, { assets: { url: TEMPLATE } }).sequence.find(
      (e) => e.type === 'image'
    )
    expect(el.attrs.url).toBe(`https://cdn.example/x/${ID}/base.png`)
  })

  it('resolves on an editor Video node', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'Video', attrs: { assetId: ID, assetExt: 'mp4' } }],
    }
    const el = parseContent(doc, { assets: { url: TEMPLATE } }).sequence.find(
      (e) => e.type === 'video'
    )
    expect(el.attrs.src).toBe(`https://cdn.example/x/${ID}/base.mp4`)
  })

  it('⭐ resolves an INLINE image — the path that shipped without options', () => {
    // `processInlineElements` took no options at all, so an image sitting beside
    // text in a paragraph reached `parseImgBlock` with none. It resolved for a
    // hoisted image and silently fell back for an inline one — the same node,
    // two answers, decided by whether it shared a paragraph with prose.
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'see ' },
            { type: 'ImageBlock', attrs: { assetId: ID, assetExt: 'png' } },
          ],
        },
      ],
    }
    const para = parseContent(doc, { assets: { url: TEMPLATE } }).sequence.find(
      (e) => e.type === 'paragraph'
    )
    const img = para.children.find((c) => c.type === 'image')
    expect(img.attrs.url).toBe(`https://cdn.example/x/${ID}/base.png`)
  })

  it('resolves an image inside a link', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'x' },
            { type: 'image', attrs: { assetId: ID, assetExt: 'png' } },
          ],
        },
      ],
    }
    const para = parseContent(doc, { assets: { url: TEMPLATE } }).sequence.find(
      (e) => e.type === 'paragraph'
    )
    expect(para.children.find((c) => c.type === 'image').attrs.url).toBe(
      `https://cdn.example/x/${ID}/base.png`
    )
  })
})

describe('a URL in the identifier slot is passed through, never composed', () => {
  // ⛔ A live producer writes a serve URL into `info.identifier` and no `src`
  // beside it (the app's per-locale image swap). Composing that against the
  // legacy base yields `https://assets.uniweb.app/dist//base.gateway` — not a
  // 404 and not a validation failure, a URL-shaped string that renders a broken
  // image and reads like a missing file. The value is already an address;
  // declining to compose over it is not constructing one.
  const urlOf = (identifier) =>
    parseContent({
      type: 'doc',
      content: [{ type: 'image', attrs: { info: { identifier } } }],
    }).sequence.find((e) => e.type === 'image').attrs.url

  it('passes a rooted serve path through', () => {
    expect(urlOf('/gateway/asset/dist/9f2c/base.png')).toBe(
      '/gateway/asset/dist/9f2c/base.png'
    )
  })

  it('passes an absolute URL through', () => {
    expect(urlOf('https://cdn.example/dist/9f2c/base.png')).toBe(
      'https://cdn.example/dist/9f2c/base.png'
    )
  })

  it('passes a protocol-relative URL through', () => {
    expect(urlOf('//cdn.example/x.png')).toBe('//cdn.example/x.png')
  })

  it('CONTROL: a genuine legacy identifier still composes against the legacy base', () => {
    // Without this, the guard could be swallowing the whole legacy path and the
    // three assertions above would still pass.
    expect(urlOf('a1b2c3d4-e5f6/photo.jpg')).toBe(
      'https://assets.uniweb.app/dist/a1b2c3d4-e5f6/base.jpg'
    )
  })
})

describe('a poster is an asset like any other', () => {
  // A node carries more than one reference: `src`, a video's `poster`, a
  // document's `preview`. Identity names WHICH — otherwise a producer cannot
  // record a poster's id without inventing vocabulary, which is where this
  // started.
  const videoOf = (attrs, options) =>
    parseContent(
      { type: 'doc', content: [{ type: 'image', attrs: { role: 'video', ...attrs } }] },
      options
    ).sequence.find((e) => e.type === 'video')

  it('⭐ resolves the poster through its OWN identity slot', () => {
    const el = videoOf(
      {
        src: '/v.mp4',
        poster: '/old-poster.png',
        posterAssetId: ID,
        posterAssetExt: 'png'
      },
      { assets: { url: TEMPLATE } }
    )
    expect(el.attrs.poster).toBe(`https://cdn.example/x/${ID}/base.png`)
  })

  it('resolves src and poster INDEPENDENTLY — two assets, two slots', () => {
    const OTHER = 'b'.repeat(64)
    const el = videoOf(
      {
        assetId: ID,
        assetExt: 'mp4',
        posterAssetId: OTHER,
        posterAssetExt: 'png'
      },
      { assets: { url: TEMPLATE } }
    )
    expect(el.attrs.src).toBe(`https://cdn.example/x/${ID}/base.mp4`)
    expect(el.attrs.poster).toBe(`https://cdn.example/x/${OTHER}/base.png`)
  })

  it('falls through to the stored poster URL with no template', () => {
    const el = videoOf({
      src: '/v.mp4',
      poster: '/old-poster.png',
      posterAssetId: ID,
      posterAssetExt: 'png'
    })
    expect(el.attrs.poster).toBe('/old-poster.png')
  })

  it('CONTROL: a poster with no identity is untouched', () => {
    const el = videoOf({ src: '/v.mp4', poster: '/p.png' }, { assets: { url: TEMPLATE } })
    expect(el.attrs.poster).toBe('/p.png')
  })

  it('a document preview resolves through its own slot too', () => {
    const el = parseContent(
      {
        type: 'doc',
        content: [
          {
            type: 'image',
            attrs: {
              role: 'pdf',
              src: '/doc.pdf',
              preview: '/old.png',
              previewAssetId: ID,
              previewAssetExt: 'png'
            }
          }
        ]
      },
      { assets: { url: TEMPLATE } }
    ).sequence.find((e) => e.type === 'image')
    expect(el.attrs.preview).toBe(`https://cdn.example/x/${ID}/base.png`)
  })
})

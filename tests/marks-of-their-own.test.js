import { describe, it, expect } from 'vitest'
import { parseContent } from '../src/index.js'
import { isStyleName } from '../src/sanitize.js'

/**
 * ⭐ Underline, superscript and subscript reach a page as <u>, <sup> and <sub> (2026-11-17) — which a
 * browser draws, and Press's documents read as underline, superscript and subscript. Their bracket
 * names, `underline`, `sup` and `sub`, are no style names, so no theme takes one.
 */
const paragraph = (...content) => parseContent({ type: 'doc', content: [{ type: 'paragraph', content }] }).paragraphs[0]

describe('marks of their own, on a page', () => {
  it('⭐ draws each as its element', () => {
    expect(
      paragraph(
        { type: 'text', text: 'CO' },
        { type: 'text', text: '2', marks: [{ type: 'subscript' }] },
        { type: 'text', text: ' m' },
        { type: 'text', text: '2', marks: [{ type: 'superscript' }] },
        { type: 'text', text: ' ' },
        { type: 'text', text: 'this', marks: [{ type: 'underline' }] },
      ),
    ).toBe('CO<sub>2</sub> m<sup>2</sup> <u>this</u>')
  })

  it('with a style and another mark, nested in the parser\'s fixed order', () => {
    expect(paragraph({ type: 'text', text: 'x', marks: [{ type: 'underline' }, { type: 'span', attrs: { accent: true } }, { type: 'bold' }] })).toBe(
      '<u><strong><span accent="true">x</span></strong></u>',
    )
  })

  it('⭐ their names are no style names, so a span attribute by one never reaches the page', () => {
    for (const name of ['underline', 'sup', 'sub', 'SUB']) expect(isStyleName(name)).toBe(false)
    expect(paragraph({ type: 'text', text: 'x', marks: [{ type: 'span', attrs: { sub: true, accent: true } }] })).toBe('<span accent="true">x</span>')
  })

  it('CONTROL — another name is a style name, as before', () => {
    expect(isStyleName('accent')).toBe(true)
  })
})

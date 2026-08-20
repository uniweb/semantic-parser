/**
 * The measurement lens for the intent corpus: reduce a parse to the fields the
 * grouping rules are responsible for. Links, images, icons, data and the
 * ordered `sequence` are deliberately outside the lens — other suites cover
 * them — so corpus diffs implicate grouping and nothing else.
 *
 * Empty fields are omitted; `title`/`subtitle`/`pretitle` keep whatever shape
 * the parser emitted (string, or array for multi-line merges).
 */
export function brief(content) {
    const out = {};
    const present = (v) => (Array.isArray(v) ? v.length > 0 : Boolean(v));
    if (present(content.pretitle)) out.pretitle = content.pretitle;
    if (present(content.title)) out.title = content.title;
    if (present(content.subtitle)) out.subtitle = content.subtitle;
    if (content.paragraphs?.length) out.paragraphs = content.paragraphs;
    if (content.headings?.length) out.headings = content.headings;
    if (content.items?.length) out.items = content.items.map(brief);
    return out;
}

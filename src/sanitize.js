/**
 * Markup that content may carry, rebuilt from an allowlist.
 *
 * Content never carries HTML: a text node holds text, and the parser escapes it
 * when it builds a string. Two kinds of markup still ride in content, because
 * they are formats rather than formatting — a math node's MathML, compiled from
 * the author's LaTeX, and an SVG icon. Neither can be escaped, since the markup
 * is the point, so each is rebuilt instead: the input is read as tokens, and
 * only allowed elements and attributes are written back out, with every text
 * run and attribute value escaped.
 *
 * Nothing from the input reaches the output unparsed. A construct this reader
 * understands differently from a browser can lose content; it cannot carry a
 * tag through, because every tag in the output was written here.
 *
 * @module @uniweb/semantic-parser/sanitize
 */

// ─── Escaping ────────────────────────────────────────────────────────────────

/**
 * Escape a string for an HTML text position.
 *
 * @param {string} s
 * @returns {string}
 */
export function escapeText(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/**
 * Escape a string for a double-quoted HTML attribute value.
 *
 * @param {string} s
 * @returns {string}
 */
export function escapeAttribute(s) {
    return escapeText(s).replace(/"/g, "&quot;");
}

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/**
 * Decode the character references a serializer emits: numeric references and
 * the five XML entities (plus `&nbsp;`). Anything else is left as written, and
 * is then escaped on the way out — it shows as text, never as markup.
 *
 * @param {string} s
 * @returns {string}
 */
function decodeReferences(s) {
    if (!s.includes("&")) return s;
    return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, ref) => {
        if (ref[0] !== "#") return NAMED[ref] ?? match;
        const code = ref[1] === "x" || ref[1] === "X"
            ? parseInt(ref.slice(2), 16)
            : parseInt(ref.slice(1), 10);
        const valid = code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff);
        return valid ? String.fromCodePoint(code) : "�";
    });
}

// ─── Reading tokens ──────────────────────────────────────────────────────────

const TAG = /<(\/?)([A-Za-z][A-Za-z0-9:_.-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/y;
const ATTRIBUTE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function readAttributes(source) {
    const attributes = [];
    for (const m of source.matchAll(ATTRIBUTE)) {
        attributes.push([m[1], m[2] ?? m[3] ?? m[4] ?? ""]);
    }
    return attributes;
}

/**
 * Split markup into text runs, start tags and end tags. Comments, CDATA,
 * doctypes and processing instructions are skipped; a `<` that opens none of
 * these is text.
 */
function* readTokens(input) {
    let i = 0;
    while (i < input.length) {
        const lt = input.indexOf("<", i);
        if (lt === -1) {
            yield { type: "text", value: input.slice(i) };
            return;
        }
        if (lt > i) yield { type: "text", value: input.slice(i, lt) };

        if (input.startsWith("<!--", lt)) {
            const end = input.indexOf("-->", lt + 4);
            i = end === -1 ? input.length : end + 3;
            continue;
        }
        // CDATA is character data: its content is text, escaped like any other.
        if (input.startsWith("<![CDATA[", lt)) {
            const end = input.indexOf("]]>", lt + 9);
            yield { type: "text", value: input.slice(lt + 9, end === -1 ? input.length : end), cdata: true };
            i = end === -1 ? input.length : end + 3;
            continue;
        }
        if (input[lt + 1] === "!" || input[lt + 1] === "?") {
            const end = input.indexOf(">", lt);
            i = end === -1 ? input.length : end + 1;
            continue;
        }

        TAG.lastIndex = lt;
        const m = TAG.exec(input);
        if (!m) {
            yield { type: "text", value: "<" };
            i = lt + 1;
            continue;
        }
        yield {
            type: m[1] ? "end" : "start",
            name: m[2],
            attributes: m[1] ? [] : readAttributes(m[3]),
            selfClosing: Boolean(m[4]),
        };
        i = TAG.lastIndex;
    }
}

// ─── Values ──────────────────────────────────────────────────────────────────

const UNSAFE_VALUE = /javascript:|vbscript:|data:text|expression\s*\(|@import|behavior\s*:|-moz-binding/i;

/** `url(…)` is allowed only as a reference within the same document. */
function onlyLocalUrls(value) {
    const urls = value.match(/url\s*\(/gi);
    if (!urls) return true;
    const local = value.match(/url\s*\(\s*['"]?#[A-Za-z][\w.:-]*['"]?\s*\)/gi) || [];
    return local.length === urls.length;
}

/**
 * A `style` attribute, declaration by declaration: a property name and a value
 * with no URL other than a local reference, and nothing that can open another
 * construct.
 */
function cleanStyle(value) {
    const kept = [];
    for (const declaration of value.split(";")) {
        const colon = declaration.indexOf(":");
        if (colon === -1) continue;
        const property = declaration.slice(0, colon).trim().toLowerCase();
        const v = declaration.slice(colon + 1).trim();
        if (!/^-?[a-z][a-z-]*$/.test(property) || !v) continue;
        if (/[\\<>{}]|\/\*/.test(v) || UNSAFE_VALUE.test(v) || !onlyLocalUrls(v)) continue;
        kept.push(`${property}:${v}`);
    }
    return kept.length ? kept.join(";") + ";" : null;
}

/**
 * The schemes a link may use: the web, mail and phone, and the framework's own
 * references to a page (`page:`, and the older `topic:`), which kit resolves to
 * a route at render.
 */
const LINK_SCHEMES = new Set(["http", "https", "mailto", "tel", "page", "topic"]);

/** A link a document may follow: relative, or one of LINK_SCHEMES. */
function isSafeUrl(value) {
    const v = value.replace(/[\u0000- \u007f]/g, "");
    const scheme = v.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
    if (!scheme) return true;
    return LINK_SCHEMES.has(scheme[1].toLowerCase());
}

const RASTER_DATA = /^data:image\/(?:png|jpeg|gif|webp|avif);base64,[A-Za-z0-9+/=\s]+$/i;

// ─── Policies ────────────────────────────────────────────────────────────────

/** Elements whose content is dropped along with them. */
const DROP_WITH_CONTENT = new Set([
    "script", "style", "foreignobject", "iframe", "object", "embed", "noscript",
    "template", "textarea", "xmp", "noembed", "noframes", "annotation-xml",
    "animate", "set", "animatemotion", "animatetransform", "mglyph", "maction",
]);

/** Attributes either policy accepts on any allowed element. */
function isCommonAttribute(name) {
    return name === "class" || name === "id" || name === "role" || name === "dir" ||
        /^aria-[a-z]+$/.test(name) || /^data-[a-z0-9-]+$/.test(name);
}

function byLowercase(names) {
    return new Map(names.map((n) => [n.toLowerCase(), n]));
}

const MATHML_ELEMENTS = byLowercase([
    "math", "semantics", "annotation", "mrow", "mi", "mn", "mo", "ms", "mtext",
    "mspace", "mfrac", "msqrt", "mroot", "mstyle", "merror", "mpadded", "mphantom",
    "menclose", "msub", "msup", "msubsup", "munder", "mover", "munderover",
    "mmultiscripts", "mprescripts", "none", "mtable", "mtr", "mtd", "mlabeledtr",
    // temml wraps LaTeX it cannot compile in a span carrying the source.
    "span",
]);

const MATHML_ATTRIBUTES = byLowercase([
    "xmlns", "display", "displaystyle", "scriptlevel", "mathvariant", "mathcolor",
    "mathbackground", "mathsize", "stretchy", "fence", "separator", "form",
    "lspace", "rspace", "largeop", "movablelimits", "accent", "accentunder",
    "symmetric", "minsize", "maxsize", "width", "height", "depth", "voffset",
    "linethickness", "numalign", "denomalign", "bevelled", "notation",
    "columnalign", "rowalign", "columnspacing", "rowspacing", "columnlines",
    "rowlines", "columnwidth", "frame", "framespacing", "equalrows",
    "equalcolumns", "rowspan", "columnspan", "side", "encoding", "intent", "arg",
    "style",
]);

const SVG_ELEMENTS = byLowercase([
    "svg", "g", "path", "circle", "ellipse", "line", "polyline", "polygon", "rect",
    "defs", "linearGradient", "radialGradient", "stop", "clipPath", "mask",
    "pattern", "symbol", "use", "title", "desc", "text", "tspan", "image",
    "marker", "filter", "feGaussianBlur", "feOffset", "feBlend", "feColorMatrix",
    "feComposite", "feFlood", "feMerge", "feMergeNode", "feDropShadow",
    "feMorphology",
]);

const SVG_ATTRIBUTES = byLowercase([
    "xmlns", "xmlns:xlink", "xml:space", "version", "viewBox",
    "preserveAspectRatio", "width", "height", "x", "y", "x1", "y1", "x2", "y2",
    "cx", "cy", "r", "rx", "ry", "fx", "fy", "d", "points", "pathLength",
    "transform", "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width",
    "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray",
    "stroke-dashoffset", "stroke-opacity", "opacity", "clip-path", "clip-rule",
    "mask", "color", "display", "visibility", "overflow", "vector-effect",
    "shape-rendering", "text-rendering", "font-family", "font-size",
    "font-weight", "font-style", "text-anchor", "dominant-baseline",
    "alignment-baseline", "letter-spacing", "word-spacing", "dx", "dy", "rotate",
    "textLength", "lengthAdjust", "offset", "stop-color", "stop-opacity",
    "gradientUnits", "gradientTransform", "spreadMethod", "patternUnits",
    "patternContentUnits", "patternTransform", "clipPathUnits", "maskUnits",
    "maskContentUnits", "markerWidth", "markerHeight", "markerUnits", "refX",
    "refY", "orient", "marker-start", "marker-mid", "marker-end", "filter",
    "filterUnits", "primitiveUnits", "in", "in2", "result", "stdDeviation",
    "mode", "operator", "k1", "k2", "k3", "k4", "values", "type", "flood-color",
    "flood-opacity", "radius", "color-interpolation-filters", "focusable",
    "style", "href", "xlink:href",
]);

/** Where an SVG element may point: a fragment, or for an image a safe URL. */
function svgReference(element, value) {
    const v = value.trim();
    if (v.startsWith("#")) return /^#[A-Za-z][\w.:-]*$/.test(v) ? v : null;
    if (element === "image") return RASTER_DATA.test(v) || (isSafeUrl(v) && !/^data:/i.test(v)) ? v : null;
    return null;
}

function makePolicy(elements, attributes, reference) {
    return {
        element(name) {
            return elements.get(name.toLowerCase()) ?? null;
        },
        attribute(element, name, value) {
            const lower = name.toLowerCase();
            if (lower.startsWith("on")) return null;
            if (lower === "href" || lower === "xlink:href" || lower === "src") {
                if (!attributes.has(lower)) return null;
                const target = reference ? reference(element, value) : null;
                return target === null ? null : [attributes.get(lower), target];
            }
            if (lower === "style") {
                const style = cleanStyle(value);
                return style === null ? null : ["style", style];
            }
            const canonical = attributes.get(lower) ?? (isCommonAttribute(lower) ? lower : null);
            if (!canonical) return null;
            if (UNSAFE_VALUE.test(value) || !onlyLocalUrls(value)) return null;
            return [canonical, value];
        },
    };
}

const MATHML = makePolicy(MATHML_ELEMENTS, MATHML_ATTRIBUTES, null);
const SVG = makePolicy(SVG_ELEMENTS, SVG_ATTRIBUTES, svgReference);

// ─── Rebuilding ──────────────────────────────────────────────────────────────

function rebuild(input, policy) {
    if (typeof input !== "string" || !input) return "";
    let out = "";
    let dropping = null;
    let depth = 0;

    for (const token of readTokens(input)) {
        if (dropping) {
            const name = token.name?.toLowerCase();
            if (token.type === "start" && name === dropping && !token.selfClosing) depth++;
            if (token.type === "end" && name === dropping && --depth === 0) dropping = null;
            continue;
        }
        if (token.type === "text") {
            out += escapeText(token.cdata ? token.value : decodeReferences(token.value));
            continue;
        }

        const lower = token.name.toLowerCase();
        if (DROP_WITH_CONTENT.has(lower)) {
            if (token.type === "start" && !token.selfClosing) {
                dropping = lower;
                depth = 1;
            }
            continue;
        }

        const element = policy.element(token.name);
        if (!element) continue; // the tag goes; what it held stays

        if (token.type === "end") {
            out += `</${element}>`;
            continue;
        }

        let attributes = "";
        const seen = new Set();
        for (const [name, raw] of token.attributes) {
            const kept = policy.attribute(element, name, decodeReferences(raw));
            if (!kept || seen.has(kept[0])) continue;
            seen.add(kept[0]);
            attributes += ` ${kept[0]}="${escapeAttribute(kept[1])}"`;
        }
        out += token.selfClosing ? `<${element}${attributes}/>` : `<${element}${attributes}>`;
    }
    return out;
}

/**
 * Rebuild MathML from its allowlist — MathML Core, the presentation elements a
 * LaTeX compiler emits, and temml's error span. No element can link, load or
 * run anything.
 *
 * @param {string} mathml
 * @returns {string} the rebuilt markup; empty when nothing survives
 */
export function sanitizeMathML(mathml) {
    return rebuild(mathml, MATHML);
}

/**
 * Rebuild SVG from its allowlist — shapes, gradients, masks, text and simple
 * filters. A reference may only point inside the document, and an `image` only
 * at a raster image. Scripts, event handlers, `foreignObject` and animations,
 * which can rewrite an attribute after the fact, are dropped.
 *
 * Accepts a whole `<svg>` or a fragment of its content.
 *
 * @param {string} svg
 * @returns {string} the rebuilt markup; empty when nothing survives
 */
export function sanitizeSVG(svg) {
    return rebuild(svg, SVG);
}

/**
 * Whether a link may be followed: a relative URL, or `http:`, `https:`,
 * `mailto:`, `tel:`, or the framework's `page:` / `topic:` references. Control
 * characters and spaces are ignored when reading the scheme, as a browser
 * ignores them, so `java\tscript:` is read as `javascript:`.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isSafeLink(url) {
    return typeof url === "string" && isSafeUrl(url);
}

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
 * Split markup into text runs, start tags and end tags. Comments, doctypes and
 * processing instructions come out as `skipped` tokens, which a rebuild leaves
 * out; CDATA is text; a `<` that opens none of these is text.
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
            yield { type: "skipped", value: input.slice(lt, i) };
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
            yield { type: "skipped", value: input.slice(lt, i) };
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
 * construct. Blank declarations (`a:b;;`, a trailing `;`) are neither.
 */
function readStyle(value) {
    const kept = [];
    const dropped = [];
    for (const declaration of value.split(";")) {
        if (!declaration.trim()) continue;
        const colon = declaration.indexOf(":");
        const property = colon === -1 ? "" : declaration.slice(0, colon).trim().toLowerCase();
        const v = colon === -1 ? "" : declaration.slice(colon + 1).trim();
        if (
            !/^-?[a-z][a-z-]*$/.test(property) || !v ||
            /[\\<>{}]|\/\*/.test(v) || UNSAFE_VALUE.test(v) || !onlyLocalUrls(v)
        ) {
            dropped.push(declaration.trim());
            continue;
        }
        kept.push(`${property}:${v}`);
    }
    return { kept, dropped };
}

function cleanStyle(value) {
    const { kept } = readStyle(value);
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
        if (token.type === "skipped") continue;
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
 * What a rebuild would leave out of `input`, item by item — the same walk as
 * `rebuild`, reporting instead of writing. Empty when the markup is within the
 * policy, which is when a rebuild changes nothing but spelling (quotes,
 * escapes, a style's spacing).
 */
function inspect(input, policy) {
    const outside = [];
    let dropping = null;
    let depth = 0;

    for (const token of readTokens(input)) {
        if (dropping) {
            const name = token.name?.toLowerCase();
            if (token.type === "start" && name === dropping && !token.selfClosing) depth++;
            if (token.type === "end" && name === dropping && --depth === 0) dropping = null;
            continue;
        }
        if (token.type === "text") continue;
        if (token.type === "skipped") {
            outside.push({ reason: "markup", value: token.value.slice(0, 40) });
            continue;
        }
        if (token.type === "end") continue; // a start tag already answered for it

        const lower = token.name.toLowerCase();
        const element = DROP_WITH_CONTENT.has(lower) ? null : policy.element(token.name);
        if (!element) {
            outside.push({ reason: "element", element: token.name });
            if (DROP_WITH_CONTENT.has(lower) && !token.selfClosing) {
                dropping = lower;
                depth = 1;
            }
            continue;
        }
        for (const [name, raw] of token.attributes) {
            const value = decodeReferences(raw);
            if (name.toLowerCase() === "style") {
                const { dropped } = readStyle(value);
                if (dropped.length) {
                    outside.push({ reason: "style", element, attribute: name, value: dropped.join("; ") });
                }
                continue;
            }
            if (!policy.attribute(element, name, value)) {
                outside.push({ reason: "attribute", element, attribute: name });
            }
        }
    }
    return outside;
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
 * What in a MathML string falls outside the allowlist `sanitizeMathML` rebuilds
 * from: each element and attribute a rebuild drops, each style declaration it
 * drops, and any comment, doctype or processing instruction. Empty when the
 * markup is within it.
 *
 * This is how content is checked rather than cleaned — a writer refused with
 * what it sent can fix it, where a cleaned value changes without a word.
 *
 * @param {string} mathml
 * @returns {Array<{reason: 'element'|'attribute'|'style'|'markup', element?: string, attribute?: string, value?: string}>}
 */
export function inspectMathML(mathml) {
    if (typeof mathml !== "string" || !mathml) return [];
    return inspect(mathml, MATHML);
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
 * What in an SVG string falls outside the allowlist `sanitizeSVG` rebuilds
 * from, reported as `inspectMathML` reports MathML. Empty when the markup is
 * within it.
 *
 * @param {string} svg
 * @returns {Array<{reason: 'element'|'attribute'|'style'|'markup', element?: string, attribute?: string, value?: string}>}
 */
export function inspectSVG(svg) {
    if (typeof svg !== "string" || !svg) return [];
    return inspect(svg, SVG);
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

/**
 * Whether an address may be loaded as an image: a link a page may follow
 * (`isSafeLink`), or the image itself, as data (`isImageData`).
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isImageSource(url) {
    return isSafeLink(url) || isImageData(url);
}

/**
 * Whether a `data:` URL holds an image a page may show: a PNG, JPEG, GIF, WebP
 * or AVIF in base64, or SVG — percent-encoded or base64 — whose markup is within
 * the allowlist `sanitizeSVG` rebuilds from. ⭐ Admitted [Diego, 2026-10-16]: a
 * picture an `<img>` loads runs no script, and a built-in starter image is one.
 * The URL is read as a browser reads it: tab and newline removed, leading and
 * trailing spaces and controls trimmed.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isImageData(url) {
    if (typeof url !== "string") return false;
    const address = url.replace(/[\t\n\r]/g, "").replace(/^[\u0000- ]+|[\u0000- ]+$/g, "");
    if (RASTER_DATA.test(address)) return true;
    const svg = svgOfData(address);
    return svg !== null && inspect(svg, SVG).length === 0;
}

const SVG_DATA = /^data:image\/svg\+xml((?:;[^,;]*)*?)(;base64)?,([\s\S]*)$/i;

/** The markup an SVG `data:` URL holds, decoded as a browser decodes it; null for any other URL. */
function svgOfData(address) {
    const data = SVG_DATA.exec(address);
    if (!data) return null;
    const body = percentDecode(data[3]);
    if (!data[2]) return body;
    try {
        const binary = atob(body.replace(/[\t\n\f\r ]+/g, ""));
        return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
    } catch {
        return null;
    }
}

/** Percent-decode as a URL is: `%` and two hex digits is a byte, anything else stays, and the bytes are read as UTF-8. */
function percentDecode(text) {
    if (!text.includes("%")) return text;
    const bytes = [];
    const utf8 = new TextEncoder();
    let run = "";
    const flush = () => {
        for (const byte of utf8.encode(run)) bytes.push(byte);
        run = "";
    };
    for (let i = 0; i < text.length; i++) {
        if (text[i] === "%" && /^[0-9a-f]{2}$/i.test(text.slice(i + 1, i + 3))) {
            flush();
            bytes.push(parseInt(text.slice(i + 1, i + 3), 16));
            i += 2;
        } else {
            run += text[i];
        }
    }
    flush();
    return new TextDecoder().decode(new Uint8Array(bytes));
}

// ─── Values content may hold ─────────────────────────────────────────────────
//
// The rules below decide what a text's marks may put into the markup the parser
// builds. The parser applies them at render, and a writer of content can check
// against the same functions (`@uniweb/content-reader/vocabulary`), so the two
// never disagree about what a value may be.

const LINK_TARGETS = ["_self", "_blank", "_parent", "_top"];
const LINK_TARGET_SET = new Set(LINK_TARGETS);

/**
 * Whether a link may open in this target: the four keywords a browser defines.
 * A frame name is not one — content does not know the page's frames.
 *
 * @param {string} target
 * @returns {boolean}
 */
export function isLinkTarget(target) {
    return LINK_TARGET_SET.has(target);
}

const STYLE_NAME = /^[A-Za-z][A-Za-z0-9_-]*$/;

/** Attribute names a browser reads as a URL, a style or an element's identity. */
const NOT_A_STYLE_NAME = [
    "href", "src", "srcset", "srcdoc", "action", "formaction", "style",
    "background", "poster", "xmlns", "is", "slot",
];
const NOT_A_STYLE_NAME_SET = new Set(NOT_A_STYLE_NAME);

/**
 * Whether a name may be a style name — the attribute NAME a bracketed span
 * carries (`[text]{accent}` is `<span accent="true">`), which a theme binds by
 * name (`span[accent]`, from theme.yml's `inline:`). A letter, then letters,
 * digits, `_` and `-`. Never a name a browser would read as an event handler —
 * anything starting with `on`, in any case, since HTML lowercases attribute
 * names — nor one it reads as a URL, a style or an element's identity.
 *
 * @param {string} name
 * @returns {boolean}
 */
export function isStyleName(name) {
    if (typeof name !== "string" || !STYLE_NAME.test(name)) return false;
    const lower = name.toLowerCase();
    return !lower.startsWith("on") && !NOT_A_STYLE_NAME_SET.has(lower);
}

const CSS_COLOR = /^[#a-zA-Z0-9(),.%\s+-]+$/;
const NOT_A_COLOR = /url\s*\(|expression\s*\(/i;

/**
 * Whether a value is a CSS colour — a name, a hex, a colour function, or
 * `var(--token)` — what a span's `color` and `bg` may set. No `;`, quote or
 * URL, so it cannot end the declaration it sits in or load anything.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isCssColor(value) {
    return typeof value === "string" && CSS_COLOR.test(value) && !NOT_A_COLOR.test(value);
}

/**
 * The same rules, as data — for a reader that implements them in another
 * language, such as a backend checking content when it is written. Every list
 * here is the one the functions above use.
 *
 * @returns {Object}
 */
export function allowlists() {
    return {
        link: {
            schemes: [...LINK_SCHEMES],
            relative: "a URL with no scheme",
            readingTheScheme: "ASCII control characters, space and DEL are ignored, as a browser ignores them",
            targets: [...LINK_TARGETS],
        },
        styleName: {
            pattern: STYLE_NAME.source,
            notStartingWith: "on, in any case",
            not: [...NOT_A_STYLE_NAME],
        },
        color: {
            pattern: CSS_COLOR.source,
            notMatching: NOT_A_COLOR.source,
            flags: "i",
        },
        mathml: {
            elements: [...MATHML_ELEMENTS.values()],
            attributes: [...MATHML_ATTRIBUTES.values()],
            commonAttributes: "class, id, role, dir, aria-<letters>, data-<letters, digits and ->",
            droppedWithContent: [...DROP_WITH_CONTENT],
            neverAttributes: "on…, in any case; href, xlink:href and src",
            unsafeValue: UNSAFE_VALUE.source,
            urlInAValue: "only url(#id), a reference within the document",
            style: "declaration by declaration: a property of letters and -, a value with none of \\ < > { } /* and no unsafe value",
            markup: "no comment, doctype or processing instruction; CDATA is text",
        },
        imageData: {
            raster: RASTER_DATA.source,
            rasterFlags: "i",
            svg: {
                mediaType: "image/svg+xml, with any parameters, and `;base64` when the body is base64",
                decoding: "the body percent-decoded as a URL is (`%` and two hex digits is a byte, anything else stays), then base64-decoded when marked, read as UTF-8",
                elements: [...SVG_ELEMENTS.values()],
                attributes: [...SVG_ATTRIBUTES.values()],
                commonAttributes: "class, id, role, dir, aria-<letters>, data-<letters, digits and ->",
                droppedWithContent: [...DROP_WITH_CONTENT],
                neverAttributes: "on…, in any case; src",
                references: "href and xlink:href only: a fragment, `#` then a letter then letters, digits, _ . : or -; on `image`, also a raster image matching `raster`, or a URL with no scheme or one of the link schemes",
                unsafeValue: UNSAFE_VALUE.source,
                urlInAValue: "only url(#id), a reference within the document",
                style: "declaration by declaration: a property of letters and -, a value with none of \\ < > { } /* and no unsafe value",
                markup: "no comment, doctype or processing instruction; CDATA is text",
            },
        },
    };
}

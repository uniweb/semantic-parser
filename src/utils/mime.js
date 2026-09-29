/**
 * What a file is, by its extension — the one extension → media-type table.
 *
 * ⭐ ONE TABLE, HERE, because two producers need it and this is the package both can
 * reach: the parser gives a document its `mime` from its address, and the build gives
 * a file record — and a document file it copies — theirs (`@uniweb/build`'s
 * `site/file-records.js` imports `mimeFor` from here, as it imports `ASSET_SLOTS`).
 * The parser has no dependencies, so the table cannot live in the build and be
 * reached from here. ⛔ Do not write a second.
 *
 * Anything not here is `application/octet-stream`.
 */
export const MIME_TYPES = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    odt: "application/vnd.oasis.opendocument.text",
    ods: "application/vnd.oasis.opendocument.spreadsheet",
    odp: "application/vnd.oasis.opendocument.presentation",
    rtf: "application/rtf",
    epub: "application/epub+zip",
    zip: "application/zip",
    gz: "application/gzip",
    tar: "application/x-tar",
    csv: "text/csv",
    tsv: "text/tab-separated-values",
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
    xml: "application/xml",
    yml: "application/yaml",
    yaml: "application/yaml",
    html: "text/html",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
    avif: "image/avif",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
};

/**
 * The extension of a file name or path, lower-cased, without its dot — `''` for none,
 * and for a dotfile (`.env`), as Node's `extname` reads them.
 */
function extensionOf(name) {
    const base = String(name || "").split(/[\\/]/).pop();
    const dot = base.lastIndexOf(".");
    return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

/**
 * The media type of a file, by its extension.
 *
 * @param {string} name - a file name or path
 * @returns {string}
 */
export function mimeFor(name) {
    return MIME_TYPES[extensionOf(name)] || "application/octet-stream";
}

/**
 * The file name an address ends in — `/files/Annual%20report.pdf?v=2` →
 * `Annual report.pdf` — or `''` when it names none.
 *
 * @param {string} url
 * @returns {string}
 */
export function fileNameOf(url) {
    const text = String(url || "");
    if (/^data:/i.test(text)) return "";
    const segment = text.split(/[?#]/)[0].split("/").pop() || "";
    try {
        return decodeURIComponent(segment);
    } catch {
        return segment;
    }
}

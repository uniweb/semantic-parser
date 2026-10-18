/**
 * Where a block sits in a flow — `placement`, one of left, right, wide and full
 * — and what an image element holds: the vocabulary's words, whichever node it
 * came from.
 */
import { processSequence } from "../../src/processors/sequence.js";
import { parseContent } from "../../src/index.js";

const first = (node) => processSequence({ type: "doc", content: [node] })[0];

describe("an image element", () => {
  test("carries its placement", () => {
    const el = first({ type: "image", attrs: { src: "/h.jpg", placement: "wide" } });
    expect(el.type).toBe("image");
    expect(el.attrs.placement).toBe("wide");
  });

  test("has none when the node has none — the text column is not a value", () => {
    expect(first({ type: "image", attrs: { src: "/h.jpg" } }).attrs).not.toHaveProperty("placement");
  });

  test("holds no layout of the parser's own, whatever the node holds", () => {
    // A node holding the editor's words for layout and look.
    const el = first({
      type: "image",
      attrs: { src: "/h.jpg", direction: "wide", filter: { grayscale: 100 }, theme: "dark", credit: "Jane Doe" },
    });
    for (const key of ["direction", "imgPos", "size", "filter", "theme", "credit"]) {
      expect(el.attrs).not.toHaveProperty(key);
    }
  });

  test("the attribution is `author` — the editor's `credit` is not read", () => {
    expect(first({ type: "image", attrs: { src: "/h.jpg", author: "Ada", credit: "Jane" } }).attrs.author).toBe("Ada");
    expect(first({ type: "image", attrs: { src: "/h.jpg", credit: "Jane" } }).attrs).not.toHaveProperty("author");
  });
});

describe("a video element", () => {
  test("from markdown, carries its placement", () => {
    const el = first({ type: "image", attrs: { src: "/t.mp4", role: "video", placement: "full" } });
    expect(el.type).toBe("video");
    expect(el.attrs.placement).toBe("full");
  });

  test("holding the editor's `direction`, carries its placement and no direction", () => {
    const el = first({ type: "image", attrs: { src: "/t.mp4", role: "video", direction: "fill", placement: "left" } });
    expect(el.attrs.placement).toBe("left");
    expect(el.attrs).not.toHaveProperty("direction");
  });
});

describe("a table element", () => {
  test("carries its caption, id and placement in its attrs", () => {
    const el = first({
      type: "table",
      attrs: { caption: "Plans and prices", id: "tbl-plans", placement: "wide" },
      content: [
        { type: "tableRow", content: [{ type: "tableCell", attrs: { header: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Plan" }] }] }] },
      ],
    });
    expect(el.type).toBe("table");
    expect(el.attrs).toEqual({ caption: "Plans and prices", id: "tbl-plans", placement: "wide" });
  });
});

describe("a document element", () => {
  test("takes no placement — where a picture sits is not a file's", () => {
    const el = first({ type: "image", attrs: { src: "/r.pdf", role: "pdf", placement: "wide" } });
    expect(el.type).toBe("document");
    expect(el.attrs).not.toHaveProperty("placement");
  });
});

describe("parseContent's arrays", () => {
  test("content.images and content.videos carry it too", () => {
    const parsed = parseContent({
      type: "doc",
      content: [
        { type: "image", attrs: { src: "/h.jpg", placement: "right" } },
        { type: "image", attrs: { src: "/t.mp4", role: "video", placement: "wide" } },
      ],
    });
    expect(parsed.images[0].placement).toBe("right");
    expect(parsed.videos[0].placement).toBe("wide");
  });
});

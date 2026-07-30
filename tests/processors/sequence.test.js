import { processSequence } from "../../src/processors/sequence.js";

describe("processSequence", () => {
  test("processes basic document structure", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Title" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Content" }],
        },
      ],
    };

    const result = processSequence(doc);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      type: "heading",
      level: 1,
      text: "Title",
      children: [],
      attrs: { level: 1 }
    });
    expect(result[1]).toEqual({
      type: "paragraph",
      text: "Content",
      children: [],
      attrs: undefined,
    });
  });

  test("handles text marks", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Normal " },
            {
              type: "text",
              marks: [{ type: "bold" }],
              text: "bold",
            },
          ],
        },
      ],
    };

    const result = processSequence(doc);
    expect(result[0].text).toBe("Normal <strong>bold</strong>");
  });

  test("processes nested lists", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Item 1" }],
                },
                {
                  type: "bulletList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Nested" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = processSequence(doc);
    expect(result[0].type).toBe("list");
    expect(result[0].style).toBe("bullet");
  });

  test("preserves image attributes", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "test.jpg",
            alt: "Test",
            role: "background",
          },
        },
      ],
    };

    const result = processSequence(doc);
    // Standard ProseMirror image nodes are routed through parseImgBlock
    // so editor-deployed and CLI-deployed content share one normalized
    // shape. `src` is mapped to `url` (the field consumed by kit's
    // <Image>); the meaningful inputs (alt, role) are passed through.
    expect(result[0].type).toBe("image");
    expect(result[0].attrs).toMatchObject({
      url: "test.jpg",
      alt: "Test",
      role: "background",
    });
  });

  describe("link detection", () => {
    test("detects single link paragraph", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Click here",
                marks: [{ type: "link", attrs: { href: "/about" } }],
              },
            ],
          },
        ],
      };

      const result = processSequence(doc);
      expect(result[0].type).toBe("link");
      expect(result[0].attrs.href).toBe("/about");
      expect(result[0].attrs.label).toBe("Click here");
      expect(result[0].attrs.iconBefore).toBeNull();
      expect(result[0].attrs.iconAfter).toBeNull();
    });

    test("single link with icon before", () => {
      // Common pattern: [Icon] Link Text
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "UniwebIcon",
                attrs: { svg: "<svg>home</svg>", size: 16 },
              },
              {
                type: "text",
                text: "Home",
                marks: [{ type: "link", attrs: { href: "/" } }],
              },
            ],
          },
        ],
      };

      const result = processSequence(doc);
      expect(result[0].type).toBe("link");
      expect(result[0].attrs.href).toBe("/");
      expect(result[0].attrs.label).toBe("Home");
      expect(result[0].attrs.iconBefore).toMatchObject({ svg: "<svg>home</svg>", size: 16 });
      expect(result[0].attrs.iconAfter).toBeNull();
      // Children also available for advanced rendering
      expect(result[0].attrs.children.some(c => c.type === "icon")).toBe(true);
    });

    test("single link with icon after", () => {
      // Pattern: Link Text [External Icon]
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "External Link",
                marks: [{ type: "link", attrs: { href: "https://example.com" } }],
              },
              {
                type: "UniwebIcon",
                attrs: { svg: "<svg>external</svg>" },
              },
            ],
          },
        ],
      };

      const result = processSequence(doc);
      expect(result[0].type).toBe("link");
      expect(result[0].attrs.iconBefore).toBeNull();
      expect(result[0].attrs.iconAfter).toMatchObject({ svg: "<svg>external</svg>" });
    });

    test("single link with icons before and after", () => {
      // Pattern: [Icon] Link Text [Icon]
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "UniwebIcon",
                attrs: { svg: "<svg>star</svg>" },
              },
              {
                type: "text",
                text: "Featured",
                marks: [{ type: "link", attrs: { href: "/featured" } }],
              },
              {
                type: "UniwebIcon",
                attrs: { svg: "<svg>arrow</svg>" },
              },
            ],
          },
        ],
      };

      const result = processSequence(doc);
      expect(result[0].type).toBe("link");
      expect(result[0].attrs.iconBefore).toMatchObject({ svg: "<svg>star</svg>" });
      expect(result[0].attrs.iconAfter).toMatchObject({ svg: "<svg>arrow</svg>" });
    });

    test("single link with markdown icon before (image with role=icon)", () => {
      // Markdown pipeline produces type:"image" with role:"icon" instead of UniwebIcon
      // e.g., ![](lu-arrowRight) [Get Started](/signup)
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "image",
                attrs: { role: "icon", library: "lu", name: "arrowRight", src: null },
              },
              {
                type: "text",
                text: " ",
              },
              {
                type: "text",
                text: "Get Started",
                marks: [{ type: "link", attrs: { href: "/signup" } }],
              },
            ],
          },
        ],
      };

      const result = processSequence(doc);
      expect(result[0].type).toBe("link");
      expect(result[0].attrs.href).toBe("/signup");
      expect(result[0].attrs.label).toBe("Get Started");
      expect(result[0].attrs.iconBefore).toMatchObject({ library: "lu", name: "arrowRight" });
      expect(result[0].attrs.iconAfter).toBeNull();
    });

    test("single link with markdown icon after (image with role=icon)", () => {
      // e.g., [Learn More](/about) ![](lu-externalLink)
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Learn More",
                marks: [{ type: "link", attrs: { href: "/about" } }],
              },
              {
                type: "image",
                attrs: { role: "icon", library: "lu", name: "externalLink", src: null },
              },
            ],
          },
        ],
      };

      const result = processSequence(doc);
      expect(result[0].type).toBe("link");
      expect(result[0].attrs.iconBefore).toBeNull();
      expect(result[0].attrs.iconAfter).toMatchObject({ library: "lu", name: "externalLink" });
    });

    test("detects multiple links paragraph and splits them", () => {
      // Common pattern: links on consecutive lines (no blank line)
      // become one paragraph in markdown, but should split into separate links
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Home",
                marks: [{ type: "link", attrs: { href: "/" } }],
              },
              {
                type: "text",
                text: "About",
                marks: [{ type: "link", attrs: { href: "/about" } }],
              },
            ],
          },
        ],
      };

      const result = processSequence(doc);
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe("link");
      expect(result[0].attrs.label).toBe("Home");
      expect(result[0].attrs.href).toBe("/");
      expect(result[1].type).toBe("link");
      expect(result[1].attrs.label).toBe("About");
      expect(result[1].attrs.href).toBe("/about");
    });

    test("multiple links with icons - icons not associated with links", () => {
      // Icons in multi-link paragraphs are not associated with specific links
      // They go to body.icons separately when processed through groups
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "UniwebIcon",
                attrs: { svg: "<svg>home</svg>" },
              },
              {
                type: "text",
                text: "Home",
                marks: [{ type: "link", attrs: { href: "/" } }],
              },
              {
                type: "UniwebIcon",
                attrs: { svg: "<svg>about</svg>" },
              },
              {
                type: "text",
                text: "About",
                marks: [{ type: "link", attrs: { href: "/about" } }],
              },
            ],
          },
        ],
      };

      const result = processSequence(doc);
      expect(result).toHaveLength(2);
      // Links extracted without icon association
      expect(result[0].attrs.label).toBe("Home");
      expect(result[0].attrs.href).toBe("/");
      expect(result[1].attrs.label).toBe("About");
      expect(result[1].attrs.href).toBe("/about");
    });
  });

  describe("clickable icons", () => {
    test("icon with href becomes clickable icon", () => {
      // Icons can have href/target for icon-only links (e.g., social media buttons)
      const doc = {
        type: "doc",
        content: [
          {
            type: "UniwebIcon",
            attrs: {
              svg: "<svg>twitter</svg>",
              href: "https://twitter.com/example",
              target: "_blank",
            },
          },
        ],
      };

      const result = processSequence(doc);
      expect(result[0].type).toBe("icon");
      expect(result[0].attrs.svg).toBe("<svg>twitter</svg>");
      expect(result[0].attrs.href).toBe("https://twitter.com/example");
      expect(result[0].attrs.target).toBe("_blank");
    });

    test("icon without href has no link attributes", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "UniwebIcon",
            attrs: { svg: "<svg>decorative</svg>", size: 24 },
          },
        ],
      };

      const result = processSequence(doc);
      expect(result[0].type).toBe("icon");
      expect(result[0].attrs.svg).toBe("<svg>decorative</svg>");
      expect(result[0].attrs.href).toBeUndefined();
      expect(result[0].attrs.target).toBeUndefined();
    });
  });

  describe("span marks (bracketed spans)", () => {
    test("span with class attribute", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "This is " },
              {
                type: "text",
                text: "highlighted",
                marks: [{ type: "span", attrs: { class: "highlight" } }],
              },
              { type: "text", text: " text." },
            ],
          },
        ],
      };

      const result = processSequence(doc);
      expect(result[0].text).toBe('This is <span class="highlight">highlighted</span> text.');
    });

    test("span with id attribute", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "target text",
                marks: [{ type: "span", attrs: { id: "anchor" } }],
              },
            ],
          },
        ],
      };

      const result = processSequence(doc);
      expect(result[0].text).toBe('<span id="anchor">target text</span>');
    });

    test("span with both class and id", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "important note",
                marks: [{ type: "span", attrs: { class: "callout", id: "note1" } }],
              },
            ],
          },
        ],
      };

      const result = processSequence(doc);
      expect(result[0].text).toBe('<span class="callout" id="note1">important note</span>');
    });

    test("span with custom attributes", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "data text",
                marks: [{ type: "span", attrs: { "data-tooltip": "info", lang: "en" } }],
              },
            ],
          },
        ],
      };

      const result = processSequence(doc);
      expect(result[0].text).toBe('<span data-tooltip="info" lang="en">data text</span>');
    });

    test("span combined with bold", () => {
      // Span is applied before bold in the processing order
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "bold highlight",
                marks: [
                  { type: "span", attrs: { class: "highlight" } },
                  { type: "bold" },
                ],
              },
            ],
          },
        ],
      };

      const result = processSequence(doc);
      expect(result[0].text).toBe('<strong><span class="highlight">bold highlight</span></strong>');
    });

    test("span combined with italic and bold", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "styled text",
                marks: [
                  { type: "span", attrs: { class: "muted" } },
                  { type: "bold" },
                  { type: "italic" },
                ],
              },
            ],
          },
        ],
      };

      const result = processSequence(doc);
      expect(result[0].text).toBe('<em><strong><span class="muted">styled text</span></strong></em>');
    });

    test("multiple spans in paragraph", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "first",
                marks: [{ type: "span", attrs: { class: "highlight" } }],
              },
              { type: "text", text: " and " },
              {
                type: "text",
                text: "second",
                marks: [{ type: "span", attrs: { class: "muted" } }],
              },
            ],
          },
        ],
      };

      const result = processSequence(doc);
      expect(result[0].text).toBe('<span class="highlight">first</span> and <span class="muted">second</span>');
    });

    test("span with empty attrs", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "plain span",
                marks: [{ type: "span", attrs: {} }],
              },
            ],
          },
        ],
      };

      const result = processSequence(doc);
      expect(result[0].text).toBe('<span>plain span</span>');
    });
  });

  describe("FormBlock", () => {
    test("parses object data and carries schemaId", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "FormBlock",
            attrs: {
              activeSchemaId: "stats",
              data: [{ number: "42", text: "Users" }],
            },
          },
        ],
      };

      const result = processSequence(doc);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("form");
      expect(result[0].schemaId).toBe("stats");
      expect(result[0].data).toEqual([{ number: "42", text: "Users" }]);
    });

    test("parses stringified JSON data", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "FormBlock",
            attrs: {
              activeSchemaId: "side-content",
              data: '{"for":"scholar","department":"CS"}',
            },
          },
        ],
      };

      const result = processSequence(doc);
      expect(result[0].schemaId).toBe("side-content");
      expect(result[0].data).toEqual({ for: "scholar", department: "CS" });
    });

    test("emits schemaId=null when activeSchemaId missing", () => {
      const doc = {
        type: "doc",
        content: [{ type: "FormBlock", attrs: { data: {} } }],
      };
      const result = processSequence(doc);
      expect(result[0].schemaId).toBeNull();
    });
  });

});

describe('inset_block — a component reference with block content', () => {
  test('children are processed, not flattened to a string', () => {
    // The default branch produced { type: 'inset_block', content: '' } — the
    // body lost entirely, so a container rendered as nothing on the page.
    const doc = {
      type: 'doc',
      content: [{
        type: 'inset_block',
        attrs: { component: 'Alert', type: 'warning' },
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Be careful.' }] },
          { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }] }] },
        ],
      }],
    }

    const el = processSequence({ content: doc.content })[0]
    expect(el.type).toBe('inset_block')
    expect(el.component).toBe('Alert')
    expect(el.params).toEqual({ type: 'warning' })
    expect(el.children.map(c => c.type)).toEqual(['paragraph', 'list'])
  })

  test('marks inside the body survive', () => {
    const node = {
      type: 'inset_block',
      attrs: { component: 'Details' },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'bold', marks: [{ type: 'bold' }] }] }],
    }
    expect(processSequence({ content: [node] })[0].children[0].text).toContain('<strong>')
  })
})

describe("icon nodes carry an attrs OBJECT", () => {
  // Regression: parseIconBlock used to return the bare `svg` string. kit renders
  // a sequence icon with `<Icon {...element.attrs} />` (styled/Prose), and
  // spreading a string yields indexed character props — {0:'<', 1:'s', …} — so
  // the icon rendered as nothing, with no error, because `attrs.svg` on a string
  // is undefined rather than a throw.
  const iconEntry = (attrs) =>
    processSequence({ type: "doc", content: [{ type: "Icon", attrs }] }).find(
      (e) => e.type === "icon"
    );

  test("an Icon node yields an object, never a string", () => {
    const entry = iconEntry({ svg: "<svg id='x'/>", theme: "dark" });
    expect(typeof entry.attrs).toBe("object");
    expect(entry.attrs).toEqual({ svg: "<svg id='x'/>", theme: "dark" });
  });

  test("spreading the attrs gives named props, not characters", () => {
    // This is the shape kit actually consumes.
    const spread = { ...iconEntry({ svg: "<svg/>" }).attrs };
    expect(spread).toEqual({ svg: "<svg/>" });
    expect(spread[0]).toBeUndefined();
  });

  test("an Icon node with no svg yields an empty object, not undefined", () => {
    expect(iconEntry({})).toEqual({ type: "icon", attrs: {} });
  });

  test("a UniwebIcon still resolves family:id into library + name", () => {
    const entry = processSequence({
      type: "doc",
      content: [{ type: "UniwebIcon", attrs: { name: "lu:house" } }],
    }).find((e) => e.type === "icon");
    expect(entry.attrs).toEqual({ library: "lu", name: "house" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Media roles. The delivery partition published in
// docs/reference/content-structure.md: icon → icons, video → videos, everything
// else → images. Until 2026-07-30 only the icon half of it existed.
//
// These use hand-built ProseMirror nodes, which is this suite's convention but
// also its limit — the shapes below are ones this repo writes. The check that a
// real author's markdown produces them lives in the monorepo's
// `_e2e/documented-authoring-surface.test.js`, which reads its corpus from the
// published docs.
// ─────────────────────────────────────────────────────────────────────────────
describe("media roles decide the delivery array", () => {
  const seq = (attrs) =>
    processSequence({ type: "doc", content: [{ type: "image", attrs }] })[0];

  test("role=video becomes a video element, not an image", () => {
    expect(seq({ src: "/t.mp4", role: "video" }).type).toBe("video");
  });

  test("a video carries every documented playback attribute", () => {
    const { attrs } = seq({
      src: "/t.mp4",
      role: "video",
      alt: "A talk",
      poster: "/p.png",
      autoplay: true,
      muted: true,
      loop: true,
      controls: true,
    });
    expect(attrs).toMatchObject({
      src: "/t.mp4",
      alt: "A talk",
      poster: "/p.png",
      autoplay: true,
      muted: true,
      loop: true,
      controls: true,
    });
  });

  test("playback attributes are omitted, not defaulted", () => {
    // A component must be able to tell "the author said nothing" from
    // "the author said false".
    const { attrs } = seq({ src: "/t.mp4", role: "video" });
    expect(attrs).not.toHaveProperty("autoplay");
    expect(attrs).not.toHaveProperty("poster");
  });

  test("a video keeps href/target — clickable media", () => {
    expect(
      seq({ src: "/d.mp4", role: "video", href: "/demo", target: "_blank" }).attrs
    ).toMatchObject({ href: "/demo", target: "_blank" });
  });

  test("role=video does NOT go through parseVideoBlock's editor dialect", () => {
    // parseVideoBlock reads `coverImg`/`info` — the editor's Video node. Routing
    // markdown through it would drop poster and every playback flag.
    expect(seq({ src: "/t.mp4", role: "video", poster: "/p.png" }).attrs.coverImg)
      .toBeUndefined();
  });

  test("a non-video role still becomes an image", () => {
    expect(seq({ src: "/h.jpg", role: "banner" }).type).toBe("image");
  });

  test("an image carries the documented Image Attributes", () => {
    // parseImgBlock was written for the editor's ImageBlock and reused here, so
    // these were declared upstream and then dropped before delivery.
    expect(
      seq({
        src: "/i.jpg",
        width: 800,
        height: 600,
        loading: "lazy",
        fit: "cover",
        position: "center",
      }).attrs
    ).toMatchObject({
      width: 800,
      height: 600,
      loading: "lazy",
      fit: "cover",
      position: "center",
    });
  });

  test("role=pdf carries preview/author/description", () => {
    expect(
      seq({
        src: "/r.pdf",
        role: "pdf",
        preview: "/c.jpg",
        author: "Ada",
        description: "Annual",
      }).attrs
    ).toMatchObject({ preview: "/c.jpg", author: "Ada", description: "Annual" });
  });

  test("an image with no extra attrs gains no empty keys", () => {
    const { attrs } = seq({ src: "/i.jpg" });
    for (const k of ["width", "height", "loading", "fit", "position", "preview"]) {
      expect(attrs).not.toHaveProperty(k);
    }
  });
});

describe("a file-sourced icon carries its source", () => {
  const icon = (attrs) =>
    processSequence({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "image", attrs }] }],
    })[0].children.find((c) => c.type === "icon");

  test("src lands in url — the key kit's <Icon> fetches", () => {
    // `![Logo](icon:./logo.svg)` and `![Logo](./logo.svg){role=icon}` are both
    // documented, and both delivered `{}` until 2026-07-30.
    expect(icon({ src: "/uploads/mine.svg", role: "icon" }).attrs).toEqual({
      url: "/uploads/mine.svg",
    });
  });

  test("a library reference is still preferred over any source", () => {
    expect(icon({ role: "icon", library: "lu", name: "zap" }).attrs).toEqual({
      library: "lu",
      name: "zap",
    });
  });
});

describe("media inline with prose is not dropped", () => {
  // content-reader hoists a standalone image to the document root, but one
  // sitting beside text stays in its paragraph. Nothing collected it there: it
  // was absent from the paragraph text, from children, and from images[].
  const inline = (attrs) =>
    processSequence({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "before " },
            { type: "image", attrs },
            { type: "text", text: " after" },
          ],
        },
      ],
    })[0].children;

  test("an inline image reaches the paragraph's children", () => {
    const items = inline({ src: "/i.png", role: "image" });
    expect(items.filter((i) => i.type === "image")).toHaveLength(1);
    expect(items.find((i) => i.type === "image").attrs).toMatchObject({
      url: "/i.png",
    });
  });

  test("an inline video is a video there too", () => {
    const items = inline({ src: "/t.mp4", role: "video" });
    expect(items.find((i) => i.type === "video").attrs).toMatchObject({
      src: "/t.mp4",
    });
  });
});

describe("tables carry structure, not a flattened string", () => {
    // Until 2026-07-30 a table fell to the `default:` branch and became
    // `{ type: 'table', content: '' }` — not merely unrendered but destroyed.
    // `getTextContent` walks for text nodes, and a table's children are rows,
    // so even the cell text came back empty. Every consumer of the sequence
    // lost tables, which read as "no renderer has a table case" and was really
    // the vocabulary not carrying one.
    const table = {
        type: "doc",
        content: [{
            type: "table",
            content: [
                {
                    type: "tableRow",
                    content: [
                        {
                            type: "tableCell",
                            attrs: { header: true, align: "left", colspan: 1, rowspan: 1 },
                            content: [{ type: "paragraph", content: [{ type: "text", text: "Name" }] }],
                        },
                        {
                            type: "tableCell",
                            attrs: { header: true, align: "right", colspan: 1, rowspan: 1 },
                            content: [{ type: "paragraph", content: [{ type: "text", text: "Qty" }] }],
                        },
                    ],
                },
                {
                    type: "tableRow",
                    content: [
                        {
                            type: "tableCell",
                            attrs: { header: false, align: "left", colspan: 1, rowspan: 1 },
                            content: [{
                                type: "paragraph",
                                content: [{ type: "text", text: "Bolt", marks: [{ type: "bold" }] }],
                            }],
                        },
                        {
                            type: "tableCell",
                            attrs: { header: false, align: "right", colspan: 2, rowspan: 1 },
                            content: [{ type: "paragraph", content: [{ type: "text", text: "12" }] }],
                        },
                    ],
                },
            ],
        }],
    };

    test("emits rows and cells", () => {
        const [el] = processSequence(table);
        expect(el.type).toBe("table");
        expect(el.rows).toHaveLength(2);
        expect(el.rows[0].cells).toHaveLength(2);
    });

    test("a cell is a nested SEQUENCE — it may hold any block", () => {
        const [el] = processSequence(table);
        expect(el.rows[0].cells[0].children).toEqual([
            { type: "paragraph", text: "Name", children: [] },
        ]);
    });

    test("inline marks survive inside a cell", () => {
        const [el] = processSequence(table);
        expect(el.rows[1].cells[0].children[0].text).toBe("<strong>Bolt</strong>");
    });

    test("carries the attributes a renderer needs", () => {
        const [el] = processSequence(table);
        expect(el.rows[0].cells[0]).toMatchObject({ header: true, align: "left" });
        expect(el.rows[1].cells[0]).toMatchObject({ header: false, align: "left" });
        expect(el.rows[1].cells[1]).toMatchObject({ colspan: 2, rowspan: 1 });
    });

    test("an empty table does not throw", () => {
        expect(processSequence({ type: "doc", content: [{ type: "table" }] })).toEqual([
            { type: "table", rows: [], attrs: undefined },
        ]);
    });
});

describe("divider — all three spellings are one element", () => {
    // `divider` is content-reader's name; horizontalRule and DividerBlock are
    // the editor's. The reader's own name was missing until 2026-07-30, so
    // markdown dividers reached consumers only by falling through `default:`,
    // which happens to produce `{ type: 'divider', content: '' }` and happens
    // to match what downstream keys on. It worked by coincidence.
    test.each(["divider", "horizontalRule", "DividerBlock"])("%s", (type) => {
        const [el] = processSequence({ type: "doc", content: [{ type }] });
        expect(el.type).toBe("divider");
    });
});

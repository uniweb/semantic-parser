export const nestedLists = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Features" }],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Enterprise" }],
            },
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Role-based access" }],
                    },
                  ],
                },
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Audit logs" }],
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

export const mixedContent = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 3 },
      content: [{ type: "text", text: "WELCOME" }],
    },
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Platform" }],
    },
    {
      type: "image",
      attrs: {
        src: "hero.jpg",
        alt: "Hero",
        role: "background",
      },
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Visit our " },
        {
          type: "text",
          marks: [
            {
              type: "link",
              attrs: {
                href: "/docs",
                role: "button-primary",
              },
            },
          ],
          text: "documentation",
        },
      ],
    },
  ],
};

export const complexGroups = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Section" }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "Main content." }],
    },
    {
      type: "horizontalRule",
    },
    {
      type: "heading",
      attrs: { level: 3 },
      content: [{ type: "text", text: "FEATURE" }],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Feature Title" }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "Feature content." }],
    },
  ],
};

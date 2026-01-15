import { parseContent } from "../../src/index.js";
import * as extractors from "../../src/mappers/extractors.js";

describe("Mapper Extractors", () => {
  describe("hero", () => {
    const heroDoc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "NEW" }]
        },
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Welcome" }]
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Get started today" }]
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "First paragraph" }]
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Second paragraph" }]
        }
      ]
    };

    test("extracts hero data", () => {
      const parsed = parseContent(heroDoc);
      const hero = extractors.hero(parsed);

      expect(hero.title).toBe("Welcome");
      expect(hero.subtitle).toBe("Get started today");
      expect(hero.kicker).toBe("NEW");
      expect(hero.description).toEqual(["First paragraph", "Second paragraph"]);
    });
  });

  describe("card", () => {
    const cardDoc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Card Title" }]
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Card description" }]
        }
      ]
    };

    test("extracts single card from main", () => {
      const parsed = parseContent(cardDoc);
      const card = extractors.card(parsed);

      expect(card.title).toBe("Card Title");
      expect(card.description).toEqual(["Card description"]);
    });

    test("extracts multiple cards from items", () => {
      const multiCardDoc = {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Main" }]
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Main content" }]
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Card 1" }]
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Description 1" }]
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Card 2" }]
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Description 2" }]
          }
        ]
      };

      const parsed = parseContent(multiCardDoc);
      const cards = extractors.card(parsed, { useItems: true });

      expect(cards).toHaveLength(2);
      expect(cards[0].title).toBe("Card 1");
      expect(cards[1].title).toBe("Card 2");
    });
  });

  describe("stats", () => {
    const statsDoc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Main" }]
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Main content" }]
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "12" }]
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Partner Labs" }]
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "$25M" }]
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Grant Funding" }]
        }
      ]
    };

    test("extracts stats from items", () => {
      const parsed = parseContent(statsDoc);
      const stats = extractors.stats(parsed);

      expect(stats).toHaveLength(2);
      expect(stats[0].value).toBe("12");
      expect(stats[0].label).toBe("Partner Labs");
      expect(stats[1].value).toBe("$25M");
      expect(stats[1].label).toBe("Grant Funding");
    });
  });

  describe("features", () => {
    const featuresDoc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Features" }]
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Our features" }]
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Fast" }]
        },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Lightning quick" }]
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Optimized for speed" }]
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Secure" }]
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Bank-grade security" }]
        }
      ]
    };

    test("extracts features list", () => {
      const parsed = parseContent(featuresDoc);
      const features = extractors.features(parsed);

      expect(features).toHaveLength(2);
      expect(features[0].title).toBe("Fast");
      expect(features[0].subtitle).toBe("Lightning quick");
      expect(features[0].description).toEqual(["Optimized for speed"]);
      expect(features[1].title).toBe("Secure");
    });
  });

  describe("faq", () => {
    const faqDoc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "FAQ" }]
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Frequently asked questions" }]
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "How does it work?" }]
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "It works by processing content." }]
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Is it free?" }]
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Yes, it's open source." }]
        }
      ]
    };

    test("extracts FAQ items", () => {
      const parsed = parseContent(faqDoc);
      const faq = extractors.faq(parsed);

      expect(faq).toHaveLength(2);
      expect(faq[0].question).toBe("How does it work?");
      expect(faq[0].answer).toEqual(["It works by processing content."]);
      expect(faq[1].question).toBe("Is it free?");
      expect(faq[1].answer).toEqual(["Yes, it's open source."]);
    });
  });

  describe("article", () => {
    const articleDoc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "FEATURED" }]
        },
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Article Title" }]
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Subtitle" }]
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Article content." }]
        }
      ]
    };

    test("extracts article data", () => {
      const parsed = parseContent(articleDoc);
      const article = extractors.article(parsed);

      expect(article.title).toBe("Article Title");
      expect(article.subtitle).toBe("Subtitle");
      expect(article.kicker).toBe("FEATURED");
      expect(article.content).toEqual(["Article content."]);
    });
  });
});

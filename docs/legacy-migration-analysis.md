# Legacy Migration Analysis

## Executive Summary

The legacy `Article` class and the new `semantic-parser` library have **significant differences** that will cause breaking changes if replaced directly. However, migration is feasible with a **legacy compatibility layer**.

**Key Findings:**
- ❌ **13 Breaking Changes** in output structure
- ❌ **8 Missing Features** in new library
- ✅ **Migration Path Available** via compatibility mapper
- ⚠️ **Template System** (major feature) not in new library

---

## Output Structure Comparison

### Legacy Output Structure
```javascript
{
  main: {
    header: {
      title: string,           // H1
      subtitle: string,        // H2 after H1
      subtitle2: string,       // H3 after H2
      pretitle: string,        // H2 BEFORE H1 ⚠️
      description: string,     // Auto-filled from subtitle2 or first paragraph
      alignment: string        // Heading text alignment
    },
    banner: {                  // First ImageBlock
      url, alt, caption, direction, filter, theme, role, credit, ...
    },
    body: {
      paragraphs: string[],
      headings: string[],      // All headings found in body
      imgs: object[],
      videos: object[],
      lists: array[],
      links: object[],         // Paragraph with only link → extracted
      icons: object[],
      buttons: object[],       // button elements
      cards: object[],         // card-group elements
      documents: object[],     // document-group elements
      forms: object[],         // FormBlock elements
      form: object,            // Last form
      quotes: object[],        // blockquote elements
      properties: object,      // Last code block parsed as JSON
      propertyBlocks: object[] // All code blocks parsed as JSON
    }
  },
  items: [...]                 // Same structure as main
}
```

### New Library Output Structure
```javascript
{
  groups: {
    main: {
      header: {
        title: string,         // H1
        subtitle: string,      // H2 after H1
        pretitle: string       // H3 BEFORE H1 ⚠️ Different!
      },
      body: {
        paragraphs: string[],
        imgs: object[],
        videos: object[],
        lists: array[],
        links: object[],
        icons: object[]
        // Missing: headings, buttons, cards, documents, forms, quotes, properties
      },
      banner: {                // First image
        url, alt, caption
      },
      metadata: { level: number }
    },
    items: [...]               // Same structure as main
  }
}
```

---

## Breaking Changes

### 1. ⚠️ **CRITICAL: Pretitle Logic Changed**

**Legacy:** H2 followed by H1 → H2 becomes pretitle
```
H2: "New Product"    →  pretitle
H1: "iPhone 16"      →  title
H2: "Pro Model"      →  subtitle
```

**New Library:** H3 followed by H1 → H3 becomes pretitle
```
H3: "New Product"    →  pretitle
H1: "iPhone 16"      →  title
H2: "Pro Model"      →  subtitle
```

**Impact:** All existing content using H2→H1 pattern will break
**Solution:** Add `pretitleLevel` option to new library

### 2. **Header.subtitle2 - REMOVED**

**Legacy:** Tracks third heading level
```javascript
header.subtitle2 = "Third heading"
```

**New Library:** No subtitle2 field

**Impact:** Components expecting subtitle2 will break
**Solution:** Add to legacy mapper or extend new parser

### 3. **Header.description - AUTO-FILL REMOVED**

**Legacy:** Automatically fills from subtitle2 or first paragraph
```javascript
header.description = header.subtitle2 || body.paragraphs[0] || '';
```

**New Library:** No auto-fill

**Impact:** Components expecting pre-filled description will get undefined
**Solution:** Add to legacy mapper

### 4. **Header.alignment - LOST**

**Legacy:** Preserves heading text alignment
```javascript
header.alignment = "center" | "left" | "right"
```

**New Library:** Not tracked

**Impact:** Alignment information lost
**Solution:** Add alignment tracking to new parser (simple attrs extraction)

### 5. **Body.headings - NOT EXTRACTED**

**Legacy:** All headings in body section extracted to array
```javascript
body.headings = ["Heading 1", "Heading 2"]
```

**New Library:** Headings not extracted from body

**Impact:** Components using body headings will break
**Solution:** Add heading extraction to new parser

### 6. **Body.buttons - MISSING**

**Legacy:** Extracts button elements
```javascript
body.buttons = [{ attrs: {...}, content: "Click me" }]
```

**New Library:** No button support

**Impact:** Button elements ignored
**Solution:** Add button element type to new parser

### 7. **Body.cards - MISSING**

**Legacy:** Extracts card-group elements
```javascript
body.cards = [{...cardData}]
```

**New Library:** No card-group support

**Impact:** Card blocks ignored
**Solution:** Add card-group support or map to generic structure

### 8. **Body.documents - MISSING**

**Legacy:** Extracts document-group elements
```javascript
body.documents = [{...documentData}]
```

**New Library:** No document-group support

**Impact:** Document blocks ignored
**Solution:** Add document-group support

### 9. **Body.forms/form - MISSING**

**Legacy:** Extracts FormBlock elements
```javascript
body.forms = [{...formData}]
body.form = {...lastForm}
```

**New Library:** No FormBlock support

**Impact:** Forms ignored
**Solution:** Add FormBlock support

### 10. **Body.quotes - MISSING**

**Legacy:** Extracts blockquote elements
```javascript
body.quotes = [{...quoteData}]
```

**New Library:** No blockquote support

**Impact:** Quotes ignored
**Solution:** Add blockquote element type

### 11. **Body.properties/propertyBlocks - MISSING**

**Legacy:** Parses code blocks as JSON
```javascript
body.properties = {...lastCodeBlock}
body.propertyBlocks = [{...}, {...}]
```

**New Library:** Has codeblocks but doesn't parse as JSON

**Impact:** Structured data in code blocks ignored
**Solution:** Add JSON parsing option for code blocks

### 12. **Sophisticated Link Detection - MISSING**

**Legacy:** Paragraph with only a link → extracted to body.links
```javascript
// Paragraph: [link]Only Link Text[/link]
body.links.push({ href: "...", label: "..." })
```

**New Library:** Link stays in paragraph

**Impact:** Link extraction pattern broken
**Solution:** Add link-only paragraph detection

### 13. **Styled Link Handling - MISSING**

**Legacy:** Multi-part links with different styling handled specially
```javascript
// [link]**Bold** and *italic*[/link]
// Extracts as single link with styled content
```

**New Library:** Not handled

**Impact:** Complex links may render incorrectly
**Solution:** Add styled link detection

---

## Major Missing Features

### 1. ❌ **Template/Variable Substitution System**

**Legacy has entire templating system:**
- `{{variable}}` syntax for secondary profile
- `${variable}` syntax for main profile
- `@variable` for labels
- `$variable` for root scope
- `/section/variable` for cross-section references
- Template engine integration
- Variable rendering in text nodes

**This is a MAJOR feature** used throughout the engine.

**New Library:** No templating support

**Impact:** All variable substitution breaks
**Solution:** Keep template system separate (engine layer, not parser)

### 2. ❌ **Auto-Items Feature**

**Legacy:** Splits document into primary/secondary sections, uses secondary as template for items

```javascript
// Document structure:
// [Primary content]
// --- divider ---
// [Secondary content with {{variables}}]

// Result: Secondary becomes template, populated with profiles/section items
```

**New Library:** No auto-items

**Impact:** Template-based content generation breaks
**Solution:** Implement at engine level, not parser level

---

## Non-Breaking Differences

### ✅ Features Both Have:
- Divider-based splitting
- Banner detection (first image)
- Heading hierarchy
- Images, videos, lists, icons
- Inline formatting (bold, italic, links)
- Nested list parsing

### ⚠️ Subtle Differences:
1. **Color marks format:** Legacy uses inline styles, new library uses class/data attributes
2. **Highlight mark:** Legacy has highlight, new library might not
3. **Link download attribute:** Legacy auto-adds download for file extensions

---

## Migration Strategy

### Recommended Approach: **Legacy Compatibility Layer**

Keep the Article class shell, replace internals with:
1. New parser for core parsing
2. Legacy mapper for output transformation
3. Template system (keep as-is, runs before parsing)

### Architecture:

```
Input Document
    ↓
Template System (legacy - variable substitution)
    ↓
New Semantic Parser (core parsing)
    ↓
Legacy Compatibility Mapper (output transformation)
    ↓
Legacy Output Format
    ↓
Existing Components (no changes needed)
```

### Implementation:

```javascript
export default class Article {
    constructor(data, options) {
        // ... existing template logic ...

        // Use new parser instead of legacy parse()
        const { parseContent } = require('@uniweb/semantic-parser');
        const parsed = parseContent(this.content);

        // Transform to legacy format
        this.parsed = legacyMapper(parsed, {
            pretitleLevel: 2,  // Use H2 for pretitle (legacy behavior)
            autoDescription: true,
            extractBodyHeadings: true
        });
    }
}
```

---

## Required Changes to New Library

### High Priority (Breaking Changes):

1. **Add `pretitleLevel` option**
   ```javascript
   parseContent(doc, { pretitleLevel: 2 }) // H2 before H1 = pretitle
   ```

2. **Add missing element types:**
   - buttons
   - blockquote (quotes)
   - Add to sequence processor

3. **Add alignment tracking:**
   - Extract `textAlign` attr from headings

### Medium Priority (Feature Parity):

4. **Add body heading extraction:**
   - Extract all headings found in body section

5. **Add link-only paragraph detection:**
   - Check if paragraph has only a link → extract to body.links

6. **Add subtitle2 support:**
   - Track third heading level

7. **Add code block JSON parsing (opt-in):**
   ```javascript
   parseContent(doc, { parseCodeBlocks: true })
   ```

### Low Priority (Nice to Have):

8. **Add styled link detection**
9. **Add highlight mark support**
10. **Add download attribute for file links**

### Not Needed (Keep Separate):

- ❌ Template/variable system → Engine responsibility
- ❌ Auto-items → Engine responsibility
- ❌ Form parsing → Too specific
- ❌ Card/document groups → Can map to generic structure

---

## Legacy Compatibility Mapper

### Pseudo-code:

```javascript
function legacyMapper(parsed, options = {}) {
    const { groups } = parsed;
    const { main, items } = groups;

    return {
        main: {
            header: {
                title: main.header.title,
                subtitle: main.header.subtitle,
                subtitle2: main.header.subtitle2 || null, // If added to parser
                pretitle: main.header.pretitle,
                description: options.autoDescription
                    ? (main.header.subtitle2 || main.body.paragraphs[0] || '')
                    : null,
                alignment: main.header.alignment || null // If added to parser
            },
            banner: main.banner ? {
                url: main.banner.url,
                alt: main.banner.alt,
                caption: main.banner.caption,
                // ... map other banner fields
            } : null,
            body: {
                paragraphs: main.body.paragraphs || [],
                headings: main.body.headings || [], // If added to parser
                imgs: main.body.imgs || [],
                videos: main.body.videos || [],
                lists: main.body.lists || [],
                links: main.body.links || [],
                icons: main.body.icons || [],
                buttons: main.body.buttons || [], // If added to parser
                cards: main.body.cards || [],
                documents: main.body.documents || [],
                forms: main.body.forms || [],
                form: main.body.forms?.[main.body.forms.length - 1] || null,
                quotes: main.body.quotes || [], // If added to parser
                properties: main.body.properties || {},
                propertyBlocks: main.body.propertyBlocks || []
            }
        },
        items: items.map(item => transformItem(item)) // Same transformation
    };
}
```

---

## Recommendations

### Phase 1: Extend New Parser (1-2 days)
1. ✅ Add `pretitleLevel` option
2. ✅ Add buttons element type
3. ✅ Add blockquote element type
4. ✅ Add alignment tracking to headings
5. ✅ Add subtitle2 to header
6. ✅ Add heading extraction to body

### Phase 2: Create Legacy Mapper (1 day)
1. ✅ Implement `legacyMapper()` function
2. ✅ Add comprehensive tests
3. ✅ Document mapping logic

### Phase 3: Update Article Class (1 day)
1. ✅ Replace `parse()` with new parser + mapper
2. ✅ Keep template system as-is
3. ✅ Test with existing components

### Phase 4: Gradual Migration (Ongoing)
1. ✅ Run both parsers in parallel (legacy + new)
2. ✅ Compare outputs, identify edge cases
3. ✅ Fix discrepancies
4. ✅ Switch to new parser when confident
5. ✅ Remove legacy parser code

---

## Risk Assessment

### High Risk:
- ❌ Pretitle logic (H2 vs H3) - **Will break all content using this pattern**
- ❌ Template system integration - **Critical feature, must preserve**

### Medium Risk:
- ⚠️ Missing element types - Will silently ignore content
- ⚠️ Link detection - May affect component behavior

### Low Risk:
- ✅ Output structure transformation - Easily mapped
- ✅ Most semantic parsing - Already compatible

---

## Testing Strategy

1. **Create test corpus:**
   - Collect 50-100 real production documents
   - Cover all content patterns

2. **Run comparison:**
   ```javascript
   const legacyOutput = new Article(doc, options).parsed;
   const newOutput = legacyMapper(parseContent(doc), options);

   assert.deepEqual(newOutput, legacyOutput);
   ```

3. **Identify gaps:**
   - Document differences
   - Prioritize fixes

4. **Component testing:**
   - Test each component with both outputs
   - Verify visual parity

5. **Performance testing:**
   - Compare parse times
   - Measure memory usage

---

## Next Steps

1. **Decide on approach:** Legacy mapper vs gradual component migration
2. **Extend new parser:** Add missing features (pretitleLevel, buttons, quotes, etc.)
3. **Implement mapper:** Create comprehensive legacy compatibility layer
4. **Test thoroughly:** Run comparison on production content
5. **Migrate carefully:** Phase rollout with fallback to legacy

---

## Questions for Discussion

1. **Pretitle:** Should we support both H2 and H3 as pretitle? Or force migration to H3?
2. **Template system:** Keep in Article class or move to engine?
3. **Auto-items:** Still needed or deprecated?
4. **Custom blocks** (cards, documents, forms): Add to parser or handle in engine?
5. **Migration timeline:** Big bang or gradual?
6. **Fallback strategy:** Keep legacy parser as backup?

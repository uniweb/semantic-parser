# Legacy Feature Evaluation

A critical analysis of legacy Article.js features to determine what should be added to the new semantic-parser.

## Evaluation Criteria

For each feature, we evaluate:
1. **Value**: Is it genuinely useful?
2. **Scope**: Parser-level or engine-level concern?
3. **Quality**: Is the legacy implementation good or technical debt?
4. **Recommendation**: Add, skip, or refactor?

---

## 1. Pretitle (H2 before H1)

**Legacy Implementation** (article.js:1004-1021):
```javascript
if (level === 2) {
    let nextIndex = Article.getNextNoneEmptyIndex(data, i);
    let next = data[nextIndex];
    if (nextType === 'heading' && nextAttrs?.level === 1) {
        header.pretitle = this.parseHeading(content);
        tgtIndex = nextIndex;
    }
}
```

**Value**: ✅ **HIGH** - Real use case for pretitle before main heading
**Scope**: ✅ **Parser-level** - Structural semantic parsing
**Quality**: ✅ **GOOD** - Clean detection logic
**Complexity**: Low - Just check H2→H1 pattern

**Recommendation**: **ADD with option**
- Make `pretitleLevel` configurable (default: 3, legacy: 2)
- Support both H2 and H3 patterns
- Implementation: Simple option in `processHeader()`

**Code Location**: `src/processors/groups.js` - `processHeader()` function

---

## 2. Header Alignment

**Legacy Implementation** (article.js:717-724):
```javascript
let alignment = itemAttrs?.textAlign;
result['alignment'] = alignment;
```

**Value**: ✅ **MEDIUM** - Preserves visual styling intent
**Scope**: ✅ **Parser-level** - Extracting document structure
**Quality**: ✅ **EXCELLENT** - Trivial, just read attribute
**Complexity**: Very low - One line

**Recommendation**: **ADD**
- Extract `textAlign` from heading attrs
- No special logic needed
- Implementation: Add to header object in `processHeader()`

**Code Location**: `src/processors/groups.js` - `processHeader()` function

---

## 3. Header.subtitle2

**Legacy Implementation** (article.js:720-738):
```javascript
let key = level === 1 ? 'title' : level === 2 ? 'subtitle' : 'subtitle2';
result[key] = headerContent;

while (nextType === 'heading' && nextLevel > level && nextIndex <= data.length) {
    let key = nextLevel === 1 ? 'title' : nextLevel === 2 ? 'subtitle' : 'subtitle2';
    // ...
}
```

**Value**: ⚠️ **MEDIUM-LOW** - Useful for complex heading hierarchies
**Scope**: ✅ **Parser-level** - Structural information
**Quality**: ✅ **GOOD** - Clean implementation
**Complexity**: Low - Just track third heading level

**Recommendation**: **ADD**
- Support H3 after H2 as subtitle2
- Useful for complex content structures
- Implementation: Extend `processHeader()` to track third level

**Code Location**: `src/processors/groups.js` - `processHeader()` function

---

## 4. Header.description Auto-fill

**Legacy Implementation** (article.js:1039):
```javascript
if (header) header.description = header?.subtitle2 || body?.paragraphs?.[0] || '';
```

**Value**: ❌ **LOW** - Business logic, not structural
**Scope**: ❌ **ENGINE-LEVEL** - Data transformation/defaults
**Quality**: ⚠️ **QUESTIONABLE** - Mixing concerns, makes assumptions
**Complexity**: Trivial

**Recommendation**: **SKIP - Engine responsibility**
- This is business logic, not parsing
- Different apps have different default strategies
- Engine can easily do: `hero.description = hero.subtitle2 || hero.body.paragraphs[0] || ''`

**Alternative**: Document pattern in mapping guide

---

## 5. Body.headings Extraction

**Legacy Implementation** (article.js:853, 883-887):
```javascript
body.headings = [];
// ...
case 'heading':
    let parsedContent = this.parseHeading(content, body);
    if (parsedContent) body[`${itemType}s`].push(parsedContent);
```

**Value**: ✅ **HIGH** - Useful for TOC, navigation, structure analysis
**Scope**: ✅ **Parser-level** - Extracting document elements
**Quality**: ✅ **GOOD** - Simple extraction
**Complexity**: Very low - Just collect headings in body

**Recommendation**: **ADD**
- Extract all headings found in body section
- Useful for table of contents, navigation
- Implementation: Add to `processGroupContent()` body processing

**Code Location**: `src/processors/groups.js` - `processGroupContent()` function

---

## 6. Button Elements

**Legacy Implementation** (article.js:860, 944-948):
```javascript
body.buttons = [];
// ...
case 'button':
    body.buttons.push({
        attrs: itemAttrs,
        content: this.parseHeading(content),
    });
```

**Value**: ✅ **HIGH** - Real UI element type
**Scope**: ✅ **Parser-level** - Document structure
**Quality**: ✅ **GOOD** - Clean extraction
**Complexity**: Low - Add to element type list

**Recommendation**: **ADD**
- Standard UI element type
- Should be supported like images, videos
- Implementation: Add `button` to element types in sequence processor

**Code Location**: `src/processors/sequence.js` - Add to element detection

---

## 7. Blockquote (Quotes)

**Legacy Implementation** (article.js:863, 950-953):
```javascript
body.quotes = [];
// ...
case 'blockquote':
    let parsedContent = this.parseGenericData(content, body);
    if (parsedContent) body.quotes.push(parsedContent);
```

**Value**: ✅ **HIGH** - Standard HTML semantic element
**Scope**: ✅ **Parser-level** - Semantic structure
**Quality**: ✅ **GOOD** - Recursive parsing (quotes can contain paragraphs, lists, etc.)
**Complexity**: Medium - Needs recursive content processing

**Recommendation**: **ADD**
- Standard semantic HTML element
- Should be treated like lists (can contain rich content)
- Implementation: Add to sequence processor, process content recursively

**Code Location**: `src/processors/sequence.js` - Add blockquote handling similar to lists

---

## 8. Code Blocks as JSON (Properties)

**Legacy Implementation** (article.js:856-857, 906-910):
```javascript
body.properties = [];
body.propertyBlocks = [];
// ...
case 'codeBlock':
    let property = Article.parseCodeBlock(content);
    body.properties = property;  // Last one
    body.propertyBlocks.push(property);  // All of them
```

**Value**: ⚠️ **MEDIUM** - Specific use case (metadata in code blocks)
**Scope**: ⚠️ **BORDERLINE** - Could be parser or engine
**Quality**: ✅ **GOOD** - Useful for structured metadata
**Complexity**: Low - Just parse code block text as JSON

**Recommendation**: **ADD as opt-in feature**
- Useful pattern for embedding structured data
- Make it optional: `parseContent(doc, { parseCodeAsJson: true })`
- Implementation: Add option to parse code block content as JSON

**Code Location**: `src/processors/sequence.js` - Enhance code block processing with option

---

## 9. Link Detection (Single-link paragraphs)

**Legacy Implementation** (article.js:756-796):
```javascript
static hasOnlyLink(item, body) {
    let content = item?.content || [];

    // Filter out icons
    content = content.filter((c) => {
        if (c.type === 'UniwebIcon') {
            icons.push(c);
            return false;
        }
        return (c.text || '').trim() !== '';
    });

    if (content.length === 1) {
        let marks = contentItem?.marks || [];
        for (let mark of marks) {
            if (mark.type === 'link') {
                return {
                    href: mark.attrs.href,
                    label: contentItem.text
                };
            }
        }
    }
}
```

**Value**: ⚠️ **MEDIUM** - Useful pattern but opinionated
**Scope**: ⚠️ **BORDERLINE** - Could be parser or engine
**Quality**: ✅ **GOOD** - Smart detection logic
**Complexity**: Medium - Need to analyze paragraph content

**Recommendation**: **ADD as opt-in feature**
- Useful for call-to-action links
- Make it optional: `parseContent(doc, { extractLinkParagraphs: true })`
- Implementation: Add detection in sequence processor

**Code Location**: `src/processors/sequence.js` - Add paragraph analysis option

---

## 10. Styled Links (Multi-part links)

**Legacy Implementation** (article.js:798-845):
```javascript
static hasOnlyStyledLink(item, body) {
    // Check if all content items have the same link mark
    let firstLinkMark = content[0]?.marks?.find(mark => mark.type === 'link');

    if (!content.every(c =>
        c?.marks?.some(mark =>
            mark.type === 'link' &&
            isEqual(mark.attrs, firstLinkMark?.attrs)
        )
    )) return false;

    // Remove link marks, return content with styling preserved
    return {
        href,
        target,
        content: cleanedContent
    };
}
```

**Value**: ⚠️ **LOW-MEDIUM** - Edge case handling
**Scope**: ⚠️ **BORDERLINE** - Complex markup normalization
**Quality**: ⚠️ **COMPLEX** - Fairly intricate logic for edge case
**Complexity**: High - Deep content analysis

**Recommendation**: **SKIP for now**
- Complex logic for edge case
- Modern rich text editors handle this better
- Can add later if genuinely needed
- Most links are simple single-part

**Alternative**: Document as known limitation, add if users request it

---

## 11. Custom Blocks (Cards, Documents, Forms)

**Legacy Implementation** (article.js:858-862, 922-943):
```javascript
body.cards = [];
body.documents = [];
body.forms = [];
// ...
case 'card-group':
    const cards = content.filter(c => c.type === 'card' && !c.attrs.hidden);
    body.cards.push(...cards.map(card => Article.parseCardBlock(card.attrs)));
    break;

case 'document-group':
    const documents = content.filter(c => c.type === 'document');
    body.documents.push(...documents.map(doc => Article.parseDocumentBlock(doc.attrs)));
    break;

case 'FormBlock':
    let form = Article.parseFormBlock(itemAttrs);
    body.forms.push(form);
    body.form = form;
    break;
```

**Value**: ❌ **SYSTEM-SPECIFIC** - Custom TipTap extensions
**Scope**: ❌ **NOT GENERAL PURPOSE** - Specific to their system
**Quality**: N/A - Depends on whether these extensions exist
**Complexity**: Medium - Would need extension system

**Recommendation**: **SKIP - Add extensibility instead**
- These are custom TipTap node types
- Not general purpose for all users
- Better approach: Add **custom element handler** option

**Alternative Implementation**:
```javascript
parseContent(doc, {
    customElements: {
        'card-group': (node) => { /* custom handler */ },
        'FormBlock': (node) => { /* custom handler */ }
    }
})
```

This allows users to handle their own custom elements without bloating the core parser.

---

## 12. Template/Variable System

**Legacy Implementation** (article.js:101-598):
- 500+ lines of template engine integration
- Variable substitution: `{{variable}}`, `${variable}`
- Profile management and data binding
- Cross-section references: `/section/variable`

**Value**: ✅ **HIGH for their system** - Core feature
**Scope**: ❌ **ENGINE-LEVEL** - Not parser responsibility
**Quality**: ⚠️ **MIXED** - Complex, tightly coupled
**Complexity**: Very high - Entire subsystem

**Recommendation**: **SKIP - Keep in Article class/engine**
- This is content transformation, not parsing
- Parser should work with final rendered content
- Keep template system at engine level (before parsing)

**Architecture**:
```
Template Engine (Article class) → Parser → Components
```

---

## Summary Table

| Feature | Value | Scope | Add? | Priority | Complexity |
|---------|-------|-------|------|----------|------------|
| Pretitle (H2→H1) | High | Parser | ✅ Yes (option) | **High** | Low |
| Header alignment | Medium | Parser | ✅ Yes | Medium | Very Low |
| Header.subtitle2 | Medium | Parser | ✅ Yes | Medium | Low |
| Header.description auto-fill | Low | Engine | ❌ No | - | - |
| Body.headings | High | Parser | ✅ Yes | **High** | Very Low |
| Buttons | High | Parser | ✅ Yes | **High** | Low |
| Blockquote | High | Parser | ✅ Yes | **High** | Medium |
| Code as JSON | Medium | Parser | ✅ Yes (option) | Low | Low |
| Link detection | Medium | Parser | ✅ Yes (option) | Low | Medium |
| Styled links | Low | Parser | ❌ No | - | High |
| Custom blocks | N/A | System | ❌ No (add extensibility) | Medium | Medium |
| Template system | High | Engine | ❌ No (keep separate) | - | - |

---

## Implementation Roadmap

### Phase 1: Core Missing Features (High Priority)
**Effort**: 1-2 days | **Impact**: Resolves most breaking changes

1. **Add pretitle option** (`pretitleLevel: 2 | 3`)
   - File: `src/processors/groups.js` - `processHeader()`
   - Simple option to support H2 before H1

2. **Add button element type**
   - File: `src/processors/sequence.js` - element detection
   - Treat like image/video elements

3. **Add blockquote element type**
   - File: `src/processors/sequence.js` - element detection
   - Process content recursively like lists

4. **Add alignment extraction**
   - File: `src/processors/groups.js` - `processHeader()`
   - Read `attrs.textAlign` from headings

5. **Add subtitle2 support**
   - File: `src/processors/groups.js` - `processHeader()`
   - Track third heading level

6. **Add body.headings extraction**
   - File: `src/processors/groups.js` - `processGroupContent()`
   - Collect all headings in body section

### Phase 2: Optional Features
**Effort**: 1 day | **Impact**: Feature parity for specific use cases

7. **Add code block JSON parsing** (opt-in)
   - File: `src/processors/sequence.js` - code block processing
   - Option: `parseCodeAsJson: true`

8. **Add link paragraph detection** (opt-in)
   - File: `src/processors/sequence.js` - paragraph analysis
   - Option: `extractLinkParagraphs: true`

### Phase 3: Extensibility
**Effort**: 1-2 days | **Impact**: Support custom elements

9. **Add custom element handlers**
   - File: `src/index.js` - parser options
   - Allow users to register custom element processors

---

## Migration Strategy

### For Legacy Compatibility

**Option A: Parser Enhancement + Legacy Mapper** (Recommended)
```javascript
export default class Article {
    constructor(data, options) {
        // Keep template system
        const rendered = this.instantiateData(data);

        // Use new parser with legacy options
        const { parseContent } = require('@uniwebcms/semantic-parser');
        const parsed = parseContent(rendered, {
            pretitleLevel: 2,  // Legacy behavior
            parseCodeAsJson: true,
            extractLinkParagraphs: true
        });

        // Transform to legacy format
        this.parsed = legacyMapper(parsed);
    }
}
```

**Option B: Gradual Migration**
- Phase 1: Add missing features to parser
- Phase 2: Run both parsers in parallel, compare outputs
- Phase 3: Switch to new parser with compatibility mapper
- Phase 4: Update components to use new format
- Phase 5: Remove legacy code

---

## Recommendations

### MUST ADD (High Value, Low Complexity)
1. ✅ Pretitle with H2 option
2. ✅ Alignment extraction
3. ✅ Subtitle2 support
4. ✅ Body headings extraction
5. ✅ Button elements
6. ✅ Blockquote elements

### SHOULD ADD (Medium Value, Opt-in)
7. ✅ Code block JSON parsing (option)
8. ✅ Link paragraph detection (option)

### SKIP (Engine/System-specific)
9. ❌ Auto-fill description (engine level)
10. ❌ Styled links (edge case, complex)
11. ❌ Custom blocks (add extensibility instead)
12. ❌ Template system (keep in Article class)

### NICE TO HAVE (Future)
- Custom element handler system
- Plugin architecture for extensions
- TypeScript definitions

---

## Next Steps

1. **Get approval** on which features to add
2. **Implement Phase 1** (6 core features)
3. **Create legacy mapper** for output transformation
4. **Test with real content** from production
5. **Document migration guide** for existing components

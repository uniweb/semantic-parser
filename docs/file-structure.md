# File Structure

```
semantic-parser/
├── package.json
├── README.md
├── CLAUDE.md            # Guidance for Claude Code
├── src/
│   ├── index.js         # Main entry point and API
│   ├── processors/
│   │   ├── sequence.js  # Flattens ProseMirror doc to sequence
│   │   ├── groups.js    # Creates semantic content groups
│   │   └── byType.js    # Organizes elements by type
│   ├── processors_old/  # Legacy implementations (deprecated)
│   │   ├── sequence.js
│   │   ├── groups.js
│   │   └── byType.js
│   └── utils/
│       └── role.js      # Role detection utilities
├── tests/
│   ├── parser.test.js   # Integration tests
│   ├── processors/
│   │   ├── sequence.test.js
│   │   ├── groups.test.js
│   │   └── byType.test.js
│   ├── utils/
│   │   └── role.test.js
│   └── fixtures/
│       ├── basic.js     # Simple test cases
│       ├── groups.js    # Group formation test cases
│       └── complex.js   # Complex scenarios
└── docs/
    ├── guide.md         # Content writing guide
    ├── api.md           # API reference documentation
    └── file-structure.md # This file
```

## Key Directories

### `src/processors/`
Contains the three-stage processing pipeline that transforms ProseMirror documents into semantic structures.

### `src/processors_old/`
Legacy implementations kept for reference. Do not modify these files.

### `tests/`
Comprehensive test suite organized by processor with shared fixtures.

### `docs/`
End-user documentation including content writing guide and API reference.

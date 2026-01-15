/**
 * Organize content elements by their type while preserving context
 * @param {Array} sequence Flat sequence of elements
 * @returns {Object} Content organized by type
 */
function processByType(sequence) {
  const collections = {
    headings: [],
    paragraphs: [],
    images: {
      background: [],
      content: [],
      gallery: [],
      icon: [],
    },
    lists: [],
    dividers: [],
    metadata: {
      totalElements: sequence.length,
      dominantType: null,
      hasMedia: false,
    },
  };

  // Track type frequencies for metadata
  const typeFrequency = new Map();

  sequence.forEach((element, index) => {
    // Track element type frequency
    typeFrequency.set(element.type, (typeFrequency.get(element.type) || 0) + 1);

    // Add context information
    const context = getElementContext(sequence, index);
    const enrichedElement = { ...element, context };

    // Process element based on type
    switch (element.type) {
      case "heading":
        collections.headings.push(enrichedElement);
        break;

      case "paragraph":
        collections.paragraphs.push(enrichedElement);
        break;

      case "image": {
        const role = element.role || "content";
        if (!collections.images[role]) {
          collections.images[role] = [];
        }
        collections.images[role].push(enrichedElement);
        collections.metadata.hasMedia = true;
        break;
      }

      case "list":
        collections.lists.push(enrichedElement);
        break;

      case "divider":
        collections.dividers.push(enrichedElement);
        break;
    }
  });

  // Calculate dominant type
  let maxFrequency = 0;
  typeFrequency.forEach((frequency, type) => {
    if (frequency > maxFrequency) {
      maxFrequency = frequency;
      collections.metadata.dominantType = type;
    }
  });

  // Add helper methods
  addCollectionHelpers(collections);

  return collections;
}

/**
 * Get context information for an element
 */
function getElementContext(sequence, position) {
  const context = {
    position,
    previousElement: position > 0 ? sequence[position - 1] : null,
    nextElement: position < sequence.length - 1 ? sequence[position + 1] : null,
    nearestHeading: null,
  };

  // Find nearest preceding heading
  for (let i = position - 1; i >= 0; i--) {
    if (sequence[i].type === "heading") {
      context.nearestHeading = sequence[i];
      break;
    }
  }

  return context;
}

/**
 * Add helper methods to collections
 */
function addCollectionHelpers(collections) {
  // Get headings of specific level
  collections.getHeadingsByLevel = function (level) {
    return this.headings.filter((h) => h.level === level);
  };

  // Get elements by heading context
  collections.getElementsByHeadingContext = function (headingFilter) {
    const allElements = [
      ...this.paragraphs,
      ...Object.values(this.images).flat(),
      ...this.lists,
    ];

    return allElements.filter(
      (el) =>
        el.context?.nearestHeading && headingFilter(el.context.nearestHeading)
    );
  };
}

export {
  processByType
};

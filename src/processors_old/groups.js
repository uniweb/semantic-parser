/**
 * Transform a sequence into content groups with semantic structure
 * @param {Array} sequence Flat sequence of elements
 * @returns {Object} Content organized into groups with identified main content
 */
function processGroups(sequence) {
  const result = {
    main: null,
    items: [],
    metadata: {
      dividerMode: false,
      groups: 0,
    },
  };

  if (!sequence.length) return result;

  // Check if using divider mode
  result.metadata.dividerMode = sequence.some((el) => el.type === "divider");

  // Split sequence into raw groups
  const groups = result.metadata.dividerMode
    ? splitByDividers(sequence)
    : splitByHeadings(sequence);

  // Process each group's structure
  const processedGroups = groups.map(processGroupContent);

  // Special handling for first group in divider mode
  if (result.metadata.dividerMode && groups.startsWithDivider) {
    result.items = processedGroups;
  } else {
    // Organize into main content and items
    const shouldBeMain = identifyMainContent(processedGroups);
    if (shouldBeMain) {
      result.main = processedGroups[0];
      result.items = processedGroups.slice(1);
    } else {
      result.items = processedGroups;
    }
  }

  // result.metadata.groups = processedGroups.length;
  return result;
}

/**
 * Split sequence into groups using dividers
 */
function splitByDividers(sequence) {
  const groups = [];
  let currentGroup = [];
  let startsWithDivider = false;

  // Check if content effectively starts with divider (ignoring whitespace etc)
  for (let i = 0; i < sequence.length; i++) {
    const element = sequence[i];

    if (element.type === "divider") {
      if (currentGroup.length === 0 && groups.length === 0) {
        startsWithDivider = true;
      } else if (currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      }
    } else {
      currentGroup.push(element);
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  groups.startsWithDivider = startsWithDivider;
  return groups;
}

/**
 * Split sequence into groups using heading patterns
 */
function splitByHeadings(sequence) {
  const groups = [];
  let currentGroup = [];
  let isPreOpened = false;

  // Consider if current group is pre opened (only has banner or pretitle)
  // before starting a new group.
  const startGroup = (preOpen) => {
    if (currentGroup.length && !isPreOpened) {
      groups.push(currentGroup);
      currentGroup = [];
    }
    isPreOpened = preOpen;
  };

  for (let i = 0; i < sequence.length; i++) {
    // Only allow a banner for the first group
    if (!groups.length && isBannerImage(sequence, i)) {
      startGroup(true); // pre open a new group
      currentGroup.push(sequence[i]);
      i++; // move to known next element (it will be a heading)
    }

    // Handle special pretitle case before consuming all consecutive
    // headings with increasing levels
    if (isPreTitle(sequence, i)) {
      startGroup(true); // pre open a new group
      currentGroup.push(sequence[i]);
      i++; // move to known next element (it will be a heading)
    }

    const element = sequence[i];

    if (element.type === "heading") {
      const headings = readHeadingGroup(sequence, i);
      startGroup(false);

      // Add headings to the current group
      currentGroup.push(...headings);
      i += headings.length - 1; // skip all the added headings
    } else {
      currentGroup.push(element);
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Check if this is a pretitle (eg, H3 followed by H1/H2)
 */
function isPreTitle(sequence, i) {
  return (
    i + 1 < sequence.length &&
    sequence[i].type === "heading" &&
    sequence[i + 1].type === "heading" &&
    sequence[i].level > sequence[i + 1].level
  );

  // return (
  //   i + 1 < sequence.length &&
  //   sequence[i].type === "heading" &&
  //   sequence[i].level === 3 &&
  //   sequence[i + 1].type === "heading" &&
  //   sequence[i + 1].level <= 2
  // );
}

function isBannerImage(sequence, i) {
  return (
    i + 1 < sequence.length &&
    sequence[i].type === "image" &&
    sequence[i + 1].type === "heading"
  );
}

/**
 * Eagerly consume all consecutive headings with increasing levels
 * and return them as an array.
 */
function readHeadingGroup(sequence, i) {
  const elements = [sequence[i]];
  for (i++; i < sequence.length; i++) {
    const element = sequence[i];

    if (element.type === "heading" && element.level > sequence[i - 1].level) {
      elements.push(element);
    }
  }
  return elements;
}

/**
 * Process a group's content to identify its structure
 */
function processGroupContent(elements) {
  const content = [];
  const headings = {
    pretitle: null,
    title: null,
    subtitle: null,
    subsubtitle: null,
  };
  const metadata = {
    level: null,
    contentTypes: new Set(),
  };

  for (let i = 0; i < elements.length; i++) {
    if (isPreTitle(elements, i)) {
      headings.pretitle = elements[i];
      i++; // move to known next heading (H1 or h2)
    }

    const element = elements[i];

    if (element.type === "heading") {
      metadata.level ??= element.level;

      if (!headings.title) {
        headings.title = element;
      } else if (!headings.subtitle) {
        headings.subtitle = element;
      } else if (!headings.subsubtitle) {
        headings.subsubtitle = element;
      }
      // What do we do if more headings?
    } else {
      content.push(element);
      metadata.contentTypes.add(element.type);
    }
  }

  return { headings, content, metadata };
}

/**
 * Determine if the first group should be treated as main content
 */
function identifyMainContent(groups) {
  if (groups.length === 0) return false;

  // Single group is main content
  if (groups.length === 1) return true;

  // First group should be more important (lower level) than second to be main
  const first = groups[0].metadata.level;
  const second = groups[1].metadata.level;

  return first ? !second || first < second : false;
}

module.exports = {
  processGroups,
};

/**
 * Process a ProseMirror/TipTap document into a flat sequence
 * @param {Object} doc ProseMirror document
 * @returns {Array} Sequence of content elements
 */
function processSequence(doc) {
  const sequence = [];
  processNode(doc, sequence);
  return sequence;
}

function processNode(node, sequence) {
  // Special handling for root doc node
  if (node.type === "doc") {
    node.content?.forEach((child) => processNode(child, sequence));
    return;
  }

  // Create element based on node type
  const element = createSequenceElement(node);

  if (element) {
    // Process marks from node or content
    if (node.marks?.length || hasMarkedContent(node)) {
      element.marks = collectMarks(node);
    }

    sequence.push(element);
  }

  // Process children if they exist and not already processed
  if (node.content && !element?.items) {
    node.content.forEach((child) => processNode(child, sequence));
  }
}

function createSequenceElement(node) {
  switch (node.type) {
    case "heading":
      return {
        type: "heading",
        level: node.attrs.level,
        content: getTextContent(node),
      };

    case "paragraph":
      return {
        type: "paragraph",
        content: getTextContent(node),
      };

    case "image":
      return {
        type: "image",
        src: node.attrs.src,
        alt: node.attrs.alt,
        role: node.attrs.role || "content",
      };

    case "bulletList":
    case "orderedList":
      return {
        type: "list",
        style: node.type === "bulletList" ? "bullet" : "ordered",
        items: processListItems(node),
      };

    case "listItem":
      return {
        type: "listItem",
        content: getTextContent(node),
      };

    case "horizontalRule":
      return {
        type: "divider",
      };

    case "text":
      return null;

    default:
      return {
        type: node.type,
        content: getTextContent(node),
      };
  }
}

function getTextContent(node) {
  if (!node.content) return "";
  return node.content.reduce((text, child) => {
    if (child.type === "text") {
      return text + child.text;
    }
    return text + getTextContent(child);
  }, "");
}

function hasMarkedContent(node) {
  if (!node.content) return false;
  return node.content.some(
    (child) => child.marks?.length || hasMarkedContent(child)
  );
}

function collectMarks(node) {
  const marks = new Set();

  if (node.marks) {
    node.marks.forEach((mark) => marks.add(mark.type));
  }

  if (node.content) {
    node.content.forEach((child) => {
      collectMarks(child).forEach((mark) => marks.add(mark));
    });
  }

  return Array.from(marks);
}

function processListItems(node) {
  const items = [];
  node.content?.forEach((item) => {
    if (item.type === "listItem") {
      items.push({
        content: getTextContent(item),
        items: item.content
          ?.filter((child) => child.type.endsWith("List"))
          .flatMap((list) => processListItems(list)),
      });
    }
  });
  return items;
}

module.exports = {
  processSequence,
};

/**
 * Extract role information from a node
 * @param {Object} node Node with potential role information
 * @returns {string|null} Role value or null
 */
function getRoleFromNode(node) {
  // Check different possible locations of role information
  return (
    // Direct role attribute
    node.attrs?.role ||
    // Role in marks
    node.marks?.find((mark) => mark.type === "role")?.attrs?.value ||
    // Default role based on type
    getDefaultRole(node)
  );
}

/**
 * Get default role based on node type and position
 */
function getDefaultRole(node) {
  switch (node.type) {
    case "image":
      return "content";
    case "link":
      return "link";
    default:
      return null;
  }
}

/**
 * Validate if a role is known for a given type
 */
function isValidRole(type, role) {
  const validRoles = {
    image: ["background", "content", "gallery", "icon"],
    link: [
      "button",
      "button-primary",
      "button-outline",
      "nav-link",
      "footer-link",
    ],
  };

  return validRoles[type]?.includes(role) || false;
}

export {
  getRoleFromNode,
  isValidRole,
};

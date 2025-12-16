/**
 * Clean markdown formatting from AI responses for better display
 */
export function cleanMarkdown(text: string): string {
  if (!text) return "";

  return text
    // Remove markdown headers (# ## ###)
    .replace(/^#{1,6}\s+/gm, "")
    // Remove bold/italic markers (**text** -> text, *text* -> text)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    // Remove inline code markers (`code` -> code)
    .replace(/`([^`]+)`/g, "$1")
    // Remove strikethrough (~~text~~ -> text)
    .replace(/~~([^~]+)~~/g, "$1")
    // Clean up multiple spaces
    .replace(/\s{2,}/g, " ")
    // Clean up multiple newlines (keep max 2)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Format text for display, preserving line breaks but cleaning markdown
 */
export function formatTextForDisplay(text: string): string {
  return cleanMarkdown(text);
}


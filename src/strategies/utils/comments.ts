//TODO: JSDoc for each function

export function escapeContentForLanguage(language: string, content: string) {
  switch (language) {
    case 'python':
      return content.replace(/'''/g, "'''\\");
    default:
      return content.replace(/\*\//g, '*\\/');
  }
}

export function getCommentForLanguage(language: string, content: string) {
  const escapedContent = escapeContentForLanguage(language, content);
  switch (language) {
    case 'python':
      return `'''\n${escapedContent}\n'''\n`;
    default:
      return `/*\n${escapedContent}\n*/\n`;
  }
}

/**
 * Check whether comments are allowed in a given programming language or not
 * @param {string} language - The programming language in question
 * @return {boolean} - true if comments are allowed; false otherwise
 */
export function canAddComment(language: string): boolean {
  // Add new language cases here if necessary
  const unsupportedLanguages = ['json'];
  return !unsupportedLanguages.includes(language);
}

export function escapeContentForLanguage(language: string, content: string) {
  switch (language) {
    case "python":
      return content.replace(/'''/g, "'''\\");
    default:
      return content.replace(/\*\//g, "*\\/");
  }
}


export function getCommentForLanguage(language: string, content: string) {
  const escapedContent = escapeContentForLanguage(language, content);
  switch (language) {
    case "python":
      return `'''\n${escapedContent}\n'''\n`;
    default:
      return `/*\n${escapedContent}\n*/\n`;
  }
}

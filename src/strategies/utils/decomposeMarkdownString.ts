import { getCommentForLanguage } from './comments';

export function splitCommentIntoLines(
  comment: string,
  maxChars = 80,
): string[] {
  const finalLines: string[] = [];

  const lines = comment.split('\n');

  lines.forEach((line) => {
    const words = line.split(/\s+/);

    // The next two variables will hold the current line length and the word to be checked
    let currentLine = '';

    // Iterate over each word in the line and break lines if they exceed maxChars
    words.forEach((word) => {
      // Handle the case when a single word is longer than maxChars
      if (word.length > maxChars) {
        const subStrings =
          word.match(new RegExp(`.{1,${maxChars}}`, 'g')) || [];
        subStrings.forEach((subString) => finalLines.push(subString));
      }
      // Handle the case when adding the word doesn't exceed maxChars
      else if (
        currentLine.length + word.length + (currentLine.length > 0 ? 1 : 0) <=
        maxChars
      ) {
        currentLine += currentLine.length > 0 ? ' ' : '';
        currentLine += word;
      }
      // Handle the case when adding the word exceeds maxChars
      else {
        finalLines.push(currentLine);
        currentLine = word;
      }
    });

    finalLines.push(currentLine);
  });

  return finalLines;
}

/**
 * Decompose a markdown string into an array of string parts, with
 * comments and code blocks properly formatted based on the document language.
 *
 * @param {string} markdownString The markdown string to decompose.
 * @param {string} languageId The language ID of the document.
 * @returns {string[]} An array of string parts, formatted as comments and code blocks.
 */
export function decomposeMarkdownString(
  markdownString: string,
  languageId: string,
): string[] {
  const lines = markdownString.split('\n');
  let inCodeBlock = false;
  let codeLanguage = '';

  const decomposedStringParts: string[] = [];
  const commentBuffer: string[] = [];

  lines.forEach((line) => {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;

      if (inCodeBlock) {
        codeLanguage = line.slice(3).trim();
      } else {
        decomposedStringParts.push(''); // Extra newline after code block
      }
    } else if (inCodeBlock) {
      //TODO: ... && codeLanguage === languageId
      dumpCommentBuffer(languageId, commentBuffer, decomposedStringParts);

      decomposedStringParts.push(line);
    } else {
      commentBuffer.push(line);
    }
  });

  dumpCommentBuffer(languageId, commentBuffer, decomposedStringParts);

  return decomposedStringParts;
}

/**
 * Removes empty lines from the beginning and end of the input array.
 *
 * @param {string[]} lines The input array of lines.
 * @returns {string[]} The output array with empty lines removed from the beginning and end.
 */
function trimEmptyLines(lines: string[]): string[] {
  let start = 0;
  let end = lines.length - 1;

  // Find the first non-empty line from the beginning
  while (start < lines.length && lines[start].trim() === '') {
    start++;
  }

  // Find the first non-empty line from the end
  while (end >= 0 && lines[end].trim() === '') {
    end--;
  }

  // Return the array slice between start and end (inclusive)
  return lines.slice(start, end + 1);
}

/**
 * Processes the comment buffer, formats it according to the document language, and
 * appends it to the decomposedStringParts array.
 *
 * @param {string} languageId The language ID of the document.
 * @param {string[]} commentBuffer The buffer holding the comment lines.
 * @param {string[]} decomposedStringParts Array holding the decomposed markdown string parts.
 * @returns {void}
 */
function dumpCommentBuffer(
  languageId: string,
  commentBuffer: string[],
  decomposedStringParts: string[],
): void {
  if (commentBuffer.length > 0) {
    const trimmedCommentLines = commentBuffer; //check if that was needed: trimEmptyLines(
    const splitComment = splitCommentIntoLines(trimmedCommentLines.join('\n'))
      .join('\n')
      .trim();

    if (splitComment.length > 0) {
      const languageSpecificComment = getCommentForLanguage(
        languageId,
        splitComment,
      );
      decomposedStringParts.push(languageSpecificComment);
    }

    // Clear the comment buffer for the next block
    commentBuffer.length = 0;
  }
}

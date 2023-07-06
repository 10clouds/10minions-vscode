/**
 * Function to strip off all types of comments from source code
 * @param code Source code as array of string lines
 * @returns Cleaned source code as array of string lines without comments
 */
export function stripAllComments(code: string[]): string[] {
  let inBlockComment = false;
  const cleanedCode: string[] = [];

  for (const line of code) {
    // using for of loop for readability
    let outputLine = '';
    let foundComment = false;

    for (let li = 0; li < line.length; li++) {
      const startsJavascriptLineComment =
        !inBlockComment && line[li] === '/' && line[li + 1] === '/';
      const startsPythonLineComment = !inBlockComment && line[li] === '#';

      if (startsJavascriptLineComment || startsPythonLineComment) {
        foundComment = true;
        break; // This is a single line comment
      }

      const startsJavascriptBlockComment =
        !inBlockComment && line[li] === '/' && line[li + 1] === '*';
      const startsPythonBlockComment =
        !inBlockComment &&
        (line.substring(li, li + 3) === "'''" ||
          line.substring(li, li + 3) === '"""');
      const endsJavascriptBlockComment =
        inBlockComment && line[li] === '*' && line[li + 1] === '/';
      const endsPythonBlockComment =
        inBlockComment &&
        (line.substring(li, li + 3) === "'''" ||
          line.substring(li, li + 3) === '"""');

      if (startsJavascriptBlockComment) {
        foundComment = true;
        inBlockComment = true;
        li += 2 - 1; // Skip extra characters
      } else if (startsPythonBlockComment) {
        foundComment = true;
        inBlockComment = true;
        li += 3 - 1; // Skip extra characters
      } else if (endsJavascriptBlockComment) {
        foundComment = true;
        inBlockComment = false;
        li += 2 - 1; // Skip extra characters
      } else if (endsPythonBlockComment) {
        foundComment = true;
        inBlockComment = false;
        li += 3 - 1; // Skip extra characters
      } else if (!inBlockComment) {
        outputLine += line[li]; // Add character to output unless in the middle of a block comment
      } else {
        //Skip comment coments
        foundComment = true;
      }
    }

    if (!(outputLine.trim() === '' && foundComment)) {
      cleanedCode.push(outputLine);
    }
  }

  return cleanedCode;
}

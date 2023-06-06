function getIndentation(currentLine: string, replaceTextLine: string): string {
  return currentLine.slice(0, currentLine.length - replaceTextLine.length);
}

function findMedianIndentation(currentSlice: string[], replaceTextLines: string[]) {
  let indentations: string[] = [];

  for (let j = 0; j < replaceTextLines.length; j++) {
    if (!currentSlice[j].endsWith(replaceTextLines[j])) {
      return undefined;
    }

    const lineIndentation = getIndentation(currentSlice[j], replaceTextLines[j]);
    indentations.push(lineIndentation);
  }

  indentations.sort((a, b) => a.length - b.length);
  const medianIndex = Math.floor(indentations.length / 2);
  return indentations[medianIndex];
}

function adjustLinesIndentation(lines: string[], indentation: string): string[] {
  return lines.map((line) => (line.length > 0 ? `${indentation}${line}` : ""));
}

function replaceWithSlidingIndentInternal(currentCode: string, replaceText: string, withText: string, strictMode: boolean) {
  const currentCodeLines = currentCode.split("\n");
  const replaceTextLines = replaceText.split("\n");
  const withTextLines = withText.split("\n");

  for (let i = 0; i < currentCodeLines.length - replaceTextLines.length + 1; i++) {
    const currentSlice = currentCodeLines.slice(i, i + replaceTextLines.length);

    const currentLineIndentation = findMedianIndentation(currentSlice, replaceTextLines);

    if (currentLineIndentation !== undefined) {

      let adjustedReplaceTextLines = adjustLinesIndentation(replaceTextLines, currentLineIndentation);
      let adjustedWithTextLines = adjustLinesIndentation(withTextLines, currentLineIndentation);

      let adjustedReplaceText = adjustedReplaceTextLines.join("\n");
      let adjustedWithText = adjustedWithTextLines.join("\n");


      if (strictMode) {
        // Check for exact match when strictMode is true
        if (!currentCode.includes(adjustedReplaceText)) {
          throw new Error(`adjustedReplaceText not found in currentCode. adjustedReplaceText: ${adjustedReplaceText}`);
        }

        currentCode = currentCode.replace(adjustedReplaceText, adjustedWithText);
      } else {

        // Create a regex for matching any amount of whitespace at the beginning of each line in replaceText
        const regex = new RegExp(
          "^" + adjustedReplaceText.split("\n").map((line) => "\\s*" + line.slice(currentLineIndentation.length)).join("\\n"),
          "m"
        );
  
        // Check for the existence of replaceText in currentCode using the regex
        if (!regex.test(currentCode)) {
          throw new Error(`adjustedReplaceText not found in currentCode. adjustedReplaceText: ${adjustedReplaceText}`);
        }

        currentCode = currentCode.replace(regex, adjustedWithText);
      }
  
      return currentCode;
    }
  }

  return;
}

function trimEmptyLinesAtTheBeginingAndEnd(text: string): string {
  return text.replace(/^(\s*\n)*/, "").replace(/(\s*\n)*$/, "");
}

export function replaceWithSlidingIndent(currentCode: string, replaceText: string, withText: string) {
  let result: string | undefined;

  for (let strictMode of [true, false]) {
    if (result === undefined) {
      result = replaceWithSlidingIndentInternal(currentCode, replaceText, withText, strictMode);
    }

    if (result === undefined) {
      result = replaceWithSlidingIndentInternal(
        currentCode,
        trimEmptyLinesAtTheBeginingAndEnd(replaceText),
        trimEmptyLinesAtTheBeginingAndEnd(withText),
        strictMode
      );
    }
  }

  return result;
}

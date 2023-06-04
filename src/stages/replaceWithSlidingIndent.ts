function getIndentation(currentLine: string, replaceTextLine: string): string {
  return currentLine.slice(0, currentLine.length - replaceTextLine.length);
}

function findCommonIndentation(
  currentSlice: string[],
  replaceTextLines: string[]
) {
  let commonIndentation: string | undefined = undefined;
  for (let j = 0; j < replaceTextLines.length; j++) {
    if (!currentSlice[j].endsWith(replaceTextLines[j])) {
      return undefined;
    }

    const lineIndentation = getIndentation(
      currentSlice[j],
      replaceTextLines[j]
    );

    if (commonIndentation === undefined) {
      commonIndentation = lineIndentation;
    } else {
      if (lineIndentation !== commonIndentation) {
        return undefined;
      }
    }
  }

  return commonIndentation;
}

function adjustLinesIndentation(
  lines: string[],
  indentation: string
): string[] {
  return lines.map((line) => (line.length > 0 ? `${indentation}${line}` : ""));
}

export function replaceWithSlidingIndent(
  currentCode: string,
  replaceText: string,
  withText: string
) {
  const currentCodeLines = currentCode.split("\n");
  const replaceTextLines = replaceText.split("\n");
  const withTextLines = withText.split("\n");

  for (
    let i = 0;
    i < currentCodeLines.length - replaceTextLines.length + 1;
    i++
  ) {
    const currentSlice = currentCodeLines.slice(i, i + replaceTextLines.length);

    const currentLineIndentation = findCommonIndentation(
      currentSlice,
      replaceTextLines
    );

    if (currentLineIndentation) {
      let adjustedReplaceTextLines = adjustLinesIndentation(
        replaceTextLines,
        currentLineIndentation
      );
      let adjustedWithTextLines = adjustLinesIndentation(
        withTextLines,
        currentLineIndentation
      );

      let adjustedReplaceText = adjustedReplaceTextLines.join("\n");
      let adjustedWithText = adjustedWithTextLines.join("\n");

      if (!currentCode.includes(adjustedReplaceText)) {
        throw new Error(
          `Assertion error! adjustedReplaceText not found in currentCode. adjustedReplaceText: ${adjustedReplaceText} currentCode: ${currentCode}`
        );
      }

      currentCode = currentCode.replace(adjustedReplaceText, adjustedWithText);

      return currentCode;
    }
  }

  return;
}

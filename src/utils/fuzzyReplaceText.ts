import {
  applyIndent,
  codeStringSimilarity,
  equalsStringSimilarity,
  levenshteinDistanceSimilarity,
  removeEmptyLines,
  removeIndent,
  trimEmptyLinesAtTheBeginingAndEnd,
} from "./stringUtils";

export type SingleLineSimilarityFunction = (original: string, replacement: string) => number;
export type MultiLineSimilarityFunction = (original: string[], replacement: string[]) => number;

interface ReplaceWindowParams {
  currentCode: string;
  replaceText: string;
  withText: string;
  similarityFunction?: MultiLineSimilarityFunction;
  similarityThreshold?: number;
  lineNumTolerance?: number;
}

type Indent = {
  type: "negative" | "positive";
  str: string;
};

/*function fuzzyIndexOf(currentCodeLine: string, replaceTextLine: string, similarityFunction: (a: string, b: string) => number, maxCharLengthTolerance = 10): { startIndex: number, endIndex: number, confidence: number } | undefined {
  let maxSimilarity = -1;
  let maxSimilarityStartIndex = -1;
  let maxSimilarityEndIndex = -1;

  let minCodeSliceLength = Math.max(0, replaceTextLine.length - maxCharLengthTolerance);
  let maxCodeSliceLength = replaceTextLine.length + maxCharLengthTolerance;

  for (let start = 0; start < currentCodeLine.length - minCodeSliceLength; start++) {
    for (let end = start + minCodeSliceLength; end < Math.min(currentCodeLine.length + 1, start + maxCodeSliceLength); end++) {
      const currntChars = currentCodeLine.slice(start, end);
      const similarity = similarityFunction(currntChars, replaceTextLine);

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        maxSimilarityStartIndex = start;
        maxSimilarityEndIndex = end;
      }
    } 
  }
  
  return {
    startIndex: maxSimilarityStartIndex,
    endIndex: maxSimilarityEndIndex,
    confidence: maxSimilarity
  };
}*/

function fuzzyGetIndentationDifference(currentLine: string, replaceTextLine: string, similarityFunction: (a: string, b: string) => number) {
  //extract leading whitespace
  const currentIndent = currentLine.match(/(^\s*)/)?.[1] || "";
  const replaceTextIndent = replaceTextLine.match(/(^\s*)/)?.[1] || "";
  //jebac to po dlugosci
  const indentDifference = currentIndent.slice(0, currentIndent.length - replaceTextIndent.length);

  return {
    confidence: similarityFunction(currentLine.trim(), replaceTextLine.trim()),
    indent: indentDifference,
  };
}

function ignoreLeadingAndTrailingWhiteSpaceSimilariryunction(
  currentLine: string,
  replaceTextLine: string,
  contentSimilarityFunction: (a: string, b: string) => number
) {
  const currentPrefix = currentLine.match(/(^\s*)/)?.[1] || "";
  const replaceTextPrefix = replaceTextLine.match(/(^\s*)/)?.[1] || "";

  const currentPostfix = currentLine.match(/(\s*$)/)?.[1] || "";
  const replaceTextPostfix = replaceTextLine.match(/(\s*$)/)?.[1] || "";

  const CONTENT_WEIGTH = 0.9;
  const PREFIX_WEIGTH = 0.05;
  const POSTFIX_WEIGTH = 0.05;

  return (
    contentSimilarityFunction(currentLine.trim(), replaceTextLine.trim()) * CONTENT_WEIGTH +
    equalsStringSimilarity(currentPrefix, replaceTextPrefix) * PREFIX_WEIGTH +
    equalsStringSimilarity(currentPostfix, replaceTextPostfix) * POSTFIX_WEIGTH
  );
}

function normalizeIndent(slice: string[]) {
  if (slice.length === 0) {
    return slice;
  }

  const sliceNoIndent = removeIndent(slice);

  //Normalized form has the first line not copied in full
  sliceNoIndent[0] = sliceNoIndent[0].trimStart();

  return sliceNoIndent;
}

/**
 * Try to guess identation from the current slice and replaceTextLines
 */
function findIndentationDifference(
  currentSlice: string[],
  replaceTextLines: string[],
  similarityFunction: (a: string, b: string) => number,
  matchAllLines = false
) {
  let indentations: string[] = [];

  let processedSlice = removeEmptyLines(currentSlice);
  let processedReplaceTextLines = removeEmptyLines(replaceTextLines);

  for (let j = 0; j < Math.min(processedSlice.length, processedReplaceTextLines.length); j++) {
    const lineIndent = fuzzyGetIndentationDifference(currentSlice[j], replaceTextLines[j], similarityFunction);

    if (lineIndent.confidence > 0.7) {
      indentations.push(lineIndent.indent);
    }
  }

  //return smallest, negative first
  return indentations.sort((a: string, b: string) => {
    return a.length - b.length;
  })[0];
}

/*function customIndentBasedSimilarity(possibleSpot: string, replaceText: string): number {
  const currentCodeLines = possibleSpot.split('\n');
  const replaceTextLines = replaceText.split("\n");

  const indentation = findIndentation(currentCodeLines, replaceTextLines, equalsStringSimilarity);

  if (indentation !== undefined) {
    let adjustedReplaceTextLines = adjustLinesIndentation(replaceTextLines, indentation);
    let adjustedReplaceText = adjustedReplaceTextLines.join("\n");
  
    if (possibleSpot.includes(adjustedReplaceText)) {
      return 0.99;
    }

    //check if we match output, with any preceeding whitespace
    const regex = new RegExp(
      "^" +
      replaceText
          .split("\n")
          .map((line) => "\\s*" + line)
          .join("\\n"),
      "m"
    );

    if (regex.test(possibleSpot)) {
      return 0.90;
    }
  }

  return 0;
}
*/

/*
function findCommonIndent(lines: string[]) {
  let commonIndent = undefined;
  for (let line of lines) {
    let lineIndent = line.match(/(^\s*)/)?.[1] || "";

    if (commonIndent === undefined) {
      commonIndent = lineIndent;
    } else {
      commonIndent = commonStringEnd(commonIndent, lineIndent);
    }
  }

  return commonIndent;
}
*/

/*
function findPossibleIndents(s: string): string[] {
  let lines = s.split("\n");
  let i1 = findCommonIndent(lines);
  let i2 = findCommonIndent(lines.slice(1)); //first line is often not indented properly
  let ret = [];

  if (i1 !== undefined) ret.push(i1);
  if (i2 !== undefined && i1 !== i2) ret.push(i2);

  return ret;
}
*/

export function exactLinesSimilarity(original: string[], replace: string[], lineSimilarityFunction: SingleLineSimilarityFunction): number {
  if (original.length !== replace.length) {
    return 0;
  }

  if (original.length === 0 && replace.length === 0) {
    return 1;
  }

  if (original.length === 0 && replace.length !== 0) {
    return 0;
  }

  let similaritySum = 0;
  for (let i = 0; i < original.length; i++) {
    similaritySum += lineSimilarityFunction(original[i], replace[i]);
  }

  const averageSimilarity = similaritySum / original.length;

  return averageSimilarity;
}

export const coreSimilarityFunction = (original: string[], replacement: string[]) => {
  if (original.join("\n") === replacement.join("\n")) {
    return 1;
  }

  function calculateSimlarity(a: string[], b: string[]) {
    let similartyWithWsDistance = exactLinesSimilarity(removeEmptyLines(a), removeEmptyLines(b), (a, b) =>
      ignoreLeadingAndTrailingWhiteSpaceSimilariryunction(a, b, codeStringSimilarity)
    );

    let similarityNotIgnoringWhitespace = exactLinesSimilarity(
      removeEmptyLines(normalizeIndent(a)),
      removeEmptyLines(normalizeIndent(b)),
      levenshteinDistanceSimilarity
    );

    let similarity = 0.5 * similartyWithWsDistance + 0.5 * similarityNotIgnoringWhitespace;

    return similarity;
  }

  let normalSimilarity = calculateSimlarity(original, replacement);

  let trimmedSimilarity = calculateSimlarity(trimEmptyLinesAtTheBeginingAndEnd(original), trimEmptyLinesAtTheBeginingAndEnd(replacement));

  if (trimmedSimilarity > normalSimilarity) {
    let difference = trimmedSimilarity - normalSimilarity;
    return normalSimilarity + difference * 0.9; //still it's not as good as plain similarity
  } else {
    return normalSimilarity;
  }
};

export function fuzzyFindText({
  currentCode,
  findText,
  similarityFunction = coreSimilarityFunction,
  lineNumTolerance = Math.ceil(findText.split("\n").length * 0.1),
}: {
  currentCode: string;
  findText: string;
  similarityFunction?: (original: string[], replacement: string[]) => number;
  lineNumTolerance?: number;
}): { lineStartIndex: number; lineEndIndex: number; confidence: number } {
  const currentCodeLines = currentCode.split("\n");
  const findTextLines = findText.split("\n");

  // Step 3: Iterate through the currentCodeLines with a nested loop to find the highest similarity between the lines in the currentCode and the findText.
  let maxSimilarity = -1;
  let maxSimilarityLineStartIndex = -1;
  let maxSimilarityLineEndIndex = -1;

  let minLinesToReplace = Math.max(0, findTextLines.length - lineNumTolerance);
  let maxLinesToReplace = findTextLines.length + lineNumTolerance;

  for (let start = 0; start < currentCodeLines.length - minLinesToReplace; start++) {
    for (let end = start + minLinesToReplace; end < Math.min(currentCodeLines.length + 1, start + maxLinesToReplace); end++) {
      const currentSlice = currentCodeLines.slice(start, end);
      const similarity = similarityFunction(currentSlice, findTextLines);

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        maxSimilarityLineStartIndex = start;
        maxSimilarityLineEndIndex = end;
      }
    }
  }

  return {
    lineStartIndex: maxSimilarityLineStartIndex,
    lineEndIndex: maxSimilarityLineEndIndex,
    confidence: maxSimilarity,
  };
}

export function fuzzyReplaceText({
  currentCode,
  replaceText,
  withText,
  similarityFunction = coreSimilarityFunction,
  similarityThreshold = 0.75,
}: ReplaceWindowParams) {
  let { lineStartIndex: startIndex, lineEndIndex: endIndex, confidence } = fuzzyFindText({ currentCode, findText: replaceText, similarityFunction });

  if (confidence >= similarityThreshold) {
    const currentCodeLines = currentCode.split("\n");

    console.log(`sim: ${confidence} start: ${startIndex} end: ${endIndex}`);
    const currentSlice = currentCodeLines.slice(startIndex, endIndex);
    let indentDifference = findIndentationDifference(currentSlice, replaceText.split("\n"), equalsStringSimilarity) || "";
    console.log("indent difference", indentDifference.length, `"${indentDifference}"`);

    const adjustedWithTextLines = applyIndent(withText.split("\n"), indentDifference);
    const adjustedWithText = adjustedWithTextLines.join("\n");

    let preChange = currentCodeLines.slice(0, startIndex).join("\n");
    let postChange = currentCodeLines.slice(endIndex).join("\n");

    //console.log("preChange", preChange.split("\n").map((line) => `"${line}"`).join("\n"));
    //console.log("adjustedWithText", adjustedWithText.split("\n").map((line) => `"${line}"`).join("\n"));
    //console.log("postChange", postChange.split("\n").map((line) => `"${line}"`).join("\n"));

    return `${preChange}${"\n"}${adjustedWithText}${postChange ? "\n" : ""}${postChange}`;
  }
}
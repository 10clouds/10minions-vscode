import common = require("mocha/lib/interfaces/common");

interface ReplaceWindowParams {
  currentCode: string;
  replaceText: string;
  withText: string;
  similarityFunction: (a: string, b: string) => number;
  similarityThreshold?: number;
}

type Indent = {
  type: "negative" | "positive";
  str: string;
};

/**
 * Find the indentation of the `currentLine`, based on the position of `replaceTextLine`.
 *
 * @param currentLine - The current line of code to analyze
 * @param replaceTextLine - The line of code to look for
 * @returns An object with the indentation type and the string of the indentation or undefined if no indentation is found.
 */
function getIndentation(currentLine: string, replaceTextLine: string): Indent | undefined {
  const position = currentLine.indexOf(replaceTextLine);

  if (position < 0) {
    const revPosition = replaceTextLine.indexOf(currentLine);

    if (revPosition < 0) {
      return undefined;
    } else {
      const indent = replaceTextLine.slice(0, revPosition);

      //if there are any non whitespace characters, return undefined
      if (indent.match(/\S/)) {
        return undefined;
      }

      return {
        type: "negative",
        str: indent,
      };
    }


    return undefined;
  } else {
    const indent = currentLine.slice(0, position);

    //if there are any non whitespace characters, return undefined
    if (indent.match(/\S/)) {
      return undefined;
    }

    return {
      type: "positive",
      str: indent,
    };
  }
}

/**
 * Try to guess identation from the current slice and replaceTextLines
 */
function fuzzyFindMedianIndentation(currentSlice: string[], replaceTextLines: string[]) {
  let indentations: Indent[] = [];

  for (let j = 0; j < replaceTextLines.length; j++) {
    const lineIndent = getIndentation(currentSlice[j], replaceTextLines[j]);

    if (lineIndent !== undefined) {
      indentations.push(lineIndent);
    }
  }

  //return smallest, negative first
  return indentations.sort((a: Indent, b: Indent) => {
    if (a.type === "negative" && b.type === "negative") {
      return b.str.length - a.str.length;
    }

    if (a.type === "positive" && b.type === "positive") {
      return a.str.length - b.str.length;
    }

    if (a.type === "negative" && b.type === "positive") {
      return b.str.length + a.str.length;
    }

    if (a.type === "positive" && b.type === "negative") {
      return a.str.length + b.str.length;
    }

    throw new Error("unreachable");
  })[0];
}

function adjustLinesIndentation(lines: string[], indentation: Indent): string[] {
  return lines.map((line) => {
    if (line.length === 0) {
      return "";
    }

    if (indentation.type === "positive") {
      return indentation.str + line;
    }

    if (indentation.type === "negative") {
      return line.slice(indentation.str.length);
    }

    throw new Error("unreachable");
  });
}

/*function replaceWithSlidingIndentInternal(currentCode: string, replaceText: string, withText: string, strictMode: boolean) {
  const currentCodeLines = currentCode.split("\n");
  const replaceTextLines = replaceText.split("\n");
  const withTextLines = withText.split("\n");

  // Add a new array to store the matching indices
  const matchIndices = [];

  for (let i = 0; i < currentCodeLines.length - replaceTextLines.length + 1; i++) {
    const currentSlice = currentCodeLines.slice(i, i + replaceTextLines.length);
    const currentLineIndentation = fuzzyFindMedianIndentation(currentSlice, replaceTextLines);

    if (currentLineIndentation !== undefined) {
      let adjustedReplaceTextLines = adjustLinesIndentation(replaceTextLines, currentLineIndentation);
      let adjustedReplaceText = adjustedReplaceTextLines.join("\n");

      if (strictMode) {
        if (currentCode.includes(adjustedReplaceText)) {
          matchIndices.push(i); // Add the match index
        }
      } else {
        const regex = new RegExp(
          "^" +
            adjustedReplaceText
              .split("\n")
              .map((line) => "\\s*" + line.slice(currentLineIndentation.length))
              .join("\\n"),
          "m"
        );

        if (regex.test(currentCode)) {
          matchIndices.push(i); // Add the match index
        }
      }
    }
  }

  // Create a new array to store the indentation adjustment lengths
  const adjustmentLengths = matchIndices.map((index) => {
    const currentSlice = currentCodeLines.slice(index, index + replaceTextLines.length);
    const currentLineIndentation = fuzzyFindMedianIndentation(currentSlice, replaceTextLines);
    return currentLineIndentation.length;
  });

  const minAdjustmentIndex = adjustmentLengths.findIndex((length) => length === Math.min(...adjustmentLengths));
  const selectedIndex = matchIndices[minAdjustmentIndex];

  if (selectedIndex >= 0) {
    const currentSlice = currentCodeLines.slice(selectedIndex, selectedIndex + replaceTextLines.length);

    // Get the correct indentation for the selected match index
    const currentLineIndentation = fuzzyFindMedianIndentation(currentSlice, replaceTextLines);

    // Adjust the withTextLines with the correct indentation
    let adjustedWithTextLines = adjustLinesIndentation(withTextLines, currentLineIndentation);

    let adjustedWithText = adjustedWithTextLines.join("\n");

    currentCode = currentCode.slice(0, selectedIndex) + adjustedWithText + currentCode.slice(selectedIndex + replaceTextLines.length);
    return currentCode;
  }

  return;
}*/

function trimEmptyLinesAtTheBeginingAndEnd(text: string): string {
  return text.replace(/^(\s*\n)*/, "").replace(/(\s*\n)*$/, "");
}

function preprocessString(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function longestCommonSubsequenceLength(s1: string, s2: string): number {
  const dp = Array.from({ length: s1.length + 1 }, () => new Array(s2.length + 1).fill(0));

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp[s1.length][s2.length];
}

function codeStringSimilarity(a: string, b: string): number {
  const preprocessedA = preprocessString(a);
  const preprocessedB = preprocessString(b);

  const lcsLength = longestCommonSubsequenceLength(preprocessedA, preprocessedB);

  const maxLength = Math.max(preprocessedA.length, preprocessedB.length);
  const similarityScore = lcsLength / maxLength;

  return similarityScore;
}

function plainStringSimilarityScore(a: string, b: string): number {
  // Step 1: Convert each input string into a set of characters
  const setA = new Set(a);
  const setB = new Set(b);

  // Step 2: Calculate the intersection of the two sets
  const intersection = new Set([...setA].filter((x) => setB.has(x)));

  // Step 3: Calculate the union of the two sets
  const union = new Set([...setA, ...setB]);

  // Step 4: Calculate the Jaccard similarity index by dividing the intersection size by the union size
  const similarityIndex = intersection.size / union.size;

  // Step 5: Return the Jaccard similarity index as the result
  return similarityIndex;
}

function replaceWindow({
  currentCode,
  replaceText,
  withText,
  similarityFunction,
  similarityThreshold = 0.5,
}: ReplaceWindowParams) {
  const currentCodeLines = currentCode.split("\n");
  const withTextLines = withText.split("\n");

  let maxSimilarity = -1;
  let maxSimilarityLineStartIndex = -1;
  let maxSimilarityLineEndIndex = -1;

  for (let start = 0; start < currentCodeLines.length; start++) {
    for (let end = start; end < currentCodeLines.length + 1; end++) {
      const currentSlice = currentCodeLines.slice(start, end);
      const similarity = similarityFunction(currentSlice.join("\n"), replaceText);

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        maxSimilarityLineStartIndex = start;
        maxSimilarityLineEndIndex = end;
      }
    }
  }

  if (maxSimilarity >= similarityThreshold) {
    const currentSlice = currentCodeLines.slice(maxSimilarityLineStartIndex, maxSimilarityLineEndIndex);
    let indent = fuzzyFindMedianIndentation(currentSlice, replaceText.split("\n")) || "";
    
    const adjustedWithTextLines = adjustLinesIndentation(withTextLines, indent);
    const adjustedWithText = adjustedWithTextLines.join("\n");

    return [
      currentCodeLines.slice(0, maxSimilarityLineStartIndex).join("\n"),
      adjustedWithText,
      currentCodeLines.slice(maxSimilarityLineEndIndex).join("\n")
    ].filter(l => l.length > 0).join("\n");
  }
}

function commonStringStart(commonIndent: string, lineIndent: string) {
  let commonStart = "";
  for (let i = 0; i < Math.min(commonIndent.length, lineIndent.length); i++) {
    if (commonIndent[i] === lineIndent[i]) {
      commonStart += commonIndent[i];
    } else {
      break;
    }
  }
  return commonStart;
}

function findCommonIndent(lines: string[]) {
  let commonIndent = undefined;
  for (let line of lines) {
    let lineIndent = line.match(/(^\s*)/)?.[1] || "";

    if (commonIndent === undefined) {
      commonIndent = lineIndent;
    } else {
      commonIndent = commonStringStart(commonIndent, lineIndent);
    }
  }

  return commonIndent;
}

function findPossibleIndents(s: string): string[] {
  let lines = s.split("\n");
  let i1 = findCommonIndent(lines);
  let i2 = findCommonIndent(lines.slice(1)); //first line is often not indented properly
  let ret = [];

  if (i1 !== undefined) ret.push(i1);
  if (i2 !== undefined && i1 !== i2) ret.push(i2);

  return ret;
}

/**
 * minimum number of single-character edits to change one to another
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
              matrix[i][j] = matrix[i - 1][j - 1];
          } else {
              matrix[i][j] = Math.min(
                  matrix[i - 1][j - 1] + 1, // substitution
                  Math.min(
                      matrix[i][j - 1] + 1, // insertion
                      matrix[i - 1][j] + 1 // deletion
                  )
              );
          }
      }
  }

  return matrix[b.length][a.length];
}


function sorensenDiceCoefficient(first: string, second: string) {
	first = first.replace(/\s+/g, '');
	second = second.replace(/\s+/g, '');

	if (first === second) return 1; // identical or empty
	if (first.length < 2 || second.length < 2) return 0; // if either is a 0-letter or 1-letter string

	let firstBigrams = new Map();
	for (let i = 0; i < first.length - 1; i++) {
		const bigram = first.substring(i, i + 2);
		const count = firstBigrams.has(bigram)
			? firstBigrams.get(bigram) + 1
			: 1;

		firstBigrams.set(bigram, count);
	};

	let intersectionSize = 0;
	for (let i = 0; i < second.length - 1; i++) {
		const bigram = second.substring(i, i + 2);
		const count = firstBigrams.has(bigram)
			? firstBigrams.get(bigram)
			: 0;

		if (count > 0) {
			firstBigrams.set(bigram, count - 1);
			intersectionSize++;
		}
	}

	return (2.0 * intersectionSize) / (first.length + second.length - 2);
}

export function fuzzyReplaceText(currentCode: string, replaceText: string, withText: string) {


  {
    let result = replaceWindow({ currentCode, replaceText, withText, similarityFunction: (a: string, b: string) => {
      let normalSimilarity = 0.33 * codeStringSimilarity(a, b) +
      0.33 * sorensenDiceCoefficient(a, b) +
      0.33 / (1 + levenshteinDistance(a, b));

      let trimmedSimilarity = 0.33 * codeStringSimilarity(a.trim(), b.trim()) +
      0.33 * sorensenDiceCoefficient(a.trim(), b.trim()) +
      0.33 / (1 + levenshteinDistance(a.trim(), b.trim()));

      if (trimmedSimilarity > normalSimilarity) {
        let difference = trimmedSimilarity - normalSimilarity;
        return normalSimilarity + difference * 0.9; //still it's not as good as plain similarity
      } else {
        return normalSimilarity;
      }
    }, similarityThreshold: 0.5 });

    if (result !== undefined) {
      return result;
    }
  }

  /*
  //Direct match
    {
    if (currentCode.indexOf(replaceText) >= 0) {
      return currentCode.replace(replaceText, withText);
    }
  }

  let result;
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

  if (result === undefined) {
    result = replaceWithSlidingIndentSoft(currentCode, replaceText, withText);
  }
  */

  return undefined;
}




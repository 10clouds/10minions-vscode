export function commonStringEnd(commonIndent: string, lineIndent: string): string {
  let commonEnd = "";
  for (let i = 0; i < Math.min(commonIndent.length, lineIndent.length); i++) {
    if (commonIndent[commonIndent.length - i - 1] === lineIndent[lineIndent.length - i - 1]) {
      commonEnd = commonIndent[commonIndent.length - i - 1] + commonEnd;
    } else {
      break;
    }
  }
  return commonEnd;
}

export function commonStringStart(commonIndent: string, lineIndent: string) {
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

/**
 * assumes that indents is not empty
 */
export function commonStringEndArray(indents: string[]) {
  let commonIndent = undefined;
  for (let lineIndent of indents) {
    if (commonIndent === undefined) {
      commonIndent = lineIndent;
    } else {
      commonIndent = commonStringEnd(commonIndent, lineIndent);
    }
  }

  return commonIndent;
}


export function removeEmptyLines(slice: string[]) {
  return slice.filter((line) => line.trim().length > 0);
}

export function removeIndent(slice: string[], indent?: string) {
  if (indent === undefined) {
    const indents = slice.map((line) => line.match(/(^\s*)/)?.[1] || "");
    indent = commonStringEndArray(indents);
  }

  if (indent === undefined) {
    return slice;
  }

  return slice.map((line) => line.slice(indent!.length));
}

export function applyIndent(slice: string[], indent: string) {
  return slice.map((line) => line.trim().length > 0 ? indent + line : line);
}

export function jaccardSimilarityIndex(a: string, b: string): number {
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

/**
 * minimum number of single-character edits to change one to another
 */
export function levenshteinDistance(a: string, b: string): number {
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

export function levenshteinDistanceSimilarity(a: string, b: string): number {
  return 1  - levenshteinDistance(a, b) / Math.max(a.length, b.length);
}

export function sorensenDiceCoefficient(first: string, second: string) {
  first = first.replace(/\s+/g, "");
  second = second.replace(/\s+/g, "");

  if (first === second) return 1; // identical or empty
  if (first.length < 2 || second.length < 2) return 0; // if either is a 0-letter or 1-letter string

  let firstBigrams = new Map();
  for (let i = 0; i < first.length - 1; i++) {
    const bigram = first.substring(i, i + 2);
    const count = firstBigrams.has(bigram) ? firstBigrams.get(bigram) + 1 : 1;

    firstBigrams.set(bigram, count);
  }

  let intersectionSize = 0;
  for (let i = 0; i < second.length - 1; i++) {
    const bigram = second.substring(i, i + 2);
    const count = firstBigrams.has(bigram) ? firstBigrams.get(bigram) : 0;

    if (count > 0) {
      firstBigrams.set(bigram, count - 1);
      intersectionSize++;
    }
  }

  return (2.0 * intersectionSize) / (first.length + second.length - 2);
}

export function equalsStringSimilarity(a: string, b: string): number {
  let matchingChars = 0;

  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) {
      matchingChars++;
    } else {
      break;
    }
  }

  let max = Math.max(a.length, b.length);

  if (max === 0) {
    return 1;
  }

  return matchingChars / max;
}

export function trimEmptyLinesAtTheBeginingAndEnd(textLines: string[]): string[] {
  let start = 0;
  let end = textLines.length - 1;

  while (start < end && textLines[start].trim().length === 0) {
    start++;
  }

  while (end > start && textLines[end].trim().length === 0) {
    end--;
  }

  return textLines.slice(start, end + 1);
}

export function longestCommonSubsequenceLength(s1: string, s2: string): number {
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

export function normalizeWhiteSpace(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

export function codeStringSimilarity(a: string, b: string): number {
  const preprocessedA = normalizeWhiteSpace(a);
  const preprocessedB = normalizeWhiteSpace(b);

  const changes = levenshteinDistance(preprocessedA, preprocessedB);

  const maxLength = Math.max(preprocessedA.length, preprocessedB.length);
  const similarityScore = 1 - changes / maxLength;

  return similarityScore;
}
import {
  applyIndent,
  codeStringSimilarity,
  equalsStringSimilarity,
  levenshteinDistanceSimilarity,
  removeEmptyLines,
  removeIndent,
} from './stringUtils';
import { stripAllComments } from './stripAllComments';

export type SingleLineSimilarityFunction = (
  original: string,
  replacement: string,
) => number;
export type MultiLineSimilarityFunction = (
  original: string[],
  replacement: string[],
) => number;

const DEFAULT_SIMILARITY_THRESHOLD = 0.75;

function fuzzyGetIndentationDifference(
  currentLine: string,
  replaceTextLine: string,
  similarityFunction: (a: string, b: string) => number,
) {
  return {
    confidence: similarityFunction(currentLine.trim(), replaceTextLine.trim()),
    indent: getIndentationDifference(currentLine, replaceTextLine),
  };
}

function getIndentationDifference(
  currentLine: string,
  replaceTextLine: string,
) {
  const currentIndent = currentLine.match(/(^\s*)/)?.[1] || '';
  const replaceTextIndent = replaceTextLine.match(/(^\s*)/)?.[1] || '';
  const indentDifference = currentIndent.slice(
    0,
    currentIndent.length - replaceTextIndent.length,
  );
  return indentDifference;
}

function ignoreLeadingAndTrailingWhiteSpaceSimilariryunction(
  currentLine: string,
  replaceTextLine: string,
  contentSimilarityFunction: (a: string, b: string) => number,
) {
  const currentPrefix = currentLine.match(/(^\s*)/)?.[1] || '';
  const replaceTextPrefix = replaceTextLine.match(/(^\s*)/)?.[1] || '';

  const currentPostfix = currentLine.match(/(\s*$)/)?.[1] || '';
  const replaceTextPostfix = replaceTextLine.match(/(\s*$)/)?.[1] || '';

  const CONTENT_WEIGTH = 0.9;
  const PREFIX_WEIGTH = 0.05;
  const POSTFIX_WEIGTH = 0.05;

  return (
    contentSimilarityFunction(currentLine.trim(), replaceTextLine.trim()) *
      CONTENT_WEIGTH +
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
) {
  const indentations: string[] = [];

  const processedSlice = removeEmptyLines(currentSlice);
  const processedReplaceTextLines = removeEmptyLines(replaceTextLines);

  for (
    let j = 0;
    j < Math.min(processedSlice.length, processedReplaceTextLines.length);
    j++
  ) {
    const lineIndent = fuzzyGetIndentationDifference(
      currentSlice[j],
      replaceTextLines[j],
      similarityFunction,
    );

    if (lineIndent.confidence > 0.7) {
      indentations.push(lineIndent.indent);
    }
  }

  const sorted = indentations.sort((a: string, b: string) => {
    return a.length - b.length;
  });

  //return median
  return sorted[0];
}

export function exactLinesSimilarityAndMap(
  original: string[],
  find: string[],
  lineSimilarityFunction: SingleLineSimilarityFunction,
  mapFindLine: (original: string | undefined, findLine: string) => string = (
    original,
    findLine,
  ) => findLine,
): { similiarity: number; mappedFind: string[] } {
  const mappedFind: string[] = [];
  let originalLine = 0;
  let findLine = 0;

  let originalSimilarityLines = 0;

  function lineSkippedValue(line: string) {
    const baseSkippedValue = 0.02;
    const scalableSkippedValue = 0.98;
    const skipScaling = 1 - 1 / (1 + line.trim().length);
    return baseSkippedValue + scalableSkippedValue * skipScaling;
  }

  const options = [
    {
      condition: () => originalLine < original.length && findLine < find.length,
      simiarity: () =>
        lineSimilarityFunction(original[originalLine], find[findLine]),
      skippedOriginalLines: () => 0,
      skippedFindLines: () => 0,
      apply: () => {
        mappedFind.push(mapFindLine(original[originalLine], find[findLine]));
        originalLine++;
        findLine++;
        originalSimilarityLines++;
      },
    },
    ...[1].map((skippedOriginalLines) => ({
      condition: () =>
        originalLine + skippedOriginalLines < original.length &&
        findLine < find.length,
      simiarity: () =>
        lineSimilarityFunction(
          original[originalLine + skippedOriginalLines],
          find[findLine],
        ),
      skippedOriginalLines: () => skippedOriginalLines,
      skippedFindLines: () => 0,
      apply: () => {
        mappedFind.push(
          mapFindLine(
            original[originalLine + skippedOriginalLines],
            find[findLine],
          ),
        );

        originalLine++;
        findLine++;
        originalSimilarityLines++;

        originalLine += skippedOriginalLines;
      },
    })),
    ...[1].map((skippedFindLines) => ({
      condition: () =>
        originalLine < original.length &&
        findLine + skippedFindLines < find.length,
      simiarity: () =>
        lineSimilarityFunction(
          original[originalLine],
          find[findLine + skippedFindLines],
        ),
      skippedOriginalLines: () => 0,
      skippedFindLines: () => skippedFindLines,
      apply: () => {
        for (let i = 0; i < skippedFindLines; i++) {
          mappedFind.push(mapFindLine(undefined, find[findLine + i]));
        }
        mappedFind.push(
          mapFindLine(
            original[originalLine],
            find[findLine + skippedFindLines],
          ),
        );

        originalLine++;
        findLine++;
        originalSimilarityLines++;

        findLine += skippedFindLines;
      },
    })),
    {
      condition: () =>
        originalLine < original.length && findLine >= find.length,
      simiarity: () => 0,
      skippedOriginalLines: () => 1,
      skippedFindLines: () => 0,
      apply: () => {
        originalLine++;
      },
    },
    {
      condition: () =>
        originalLine >= original.length && findLine < find.length,
      simiarity: () => 0,
      skippedOriginalLines: () => 0,
      skippedFindLines: () => 1,
      apply: () => {
        mappedFind.push(mapFindLine(undefined, find[findLine]));
        findLine++;
      },
    },
  ];

  let similaritySum = 0;
  let linesSkipped = 0;

  while (true) {
    let bestOption;
    let bestSimialrity = Number.MIN_SAFE_INTEGER;

    for (const option of options) {
      if (option.condition()) {
        const similarity = option.simiarity();

        if (isNaN(similarity)) {
          throw new Error('similarity is NaN');
        }

        if (similarity > bestSimialrity) {
          bestSimialrity = similarity;
          bestOption = option;
        }
      }
    }

    if (bestOption === undefined) {
      break;
    }

    for (
      let orgIndex = 0;
      orgIndex < bestOption.skippedOriginalLines();
      orgIndex++
    ) {
      linesSkipped += lineSkippedValue(original[originalLine + orgIndex]);
    }

    for (
      let findIndex = 0;
      findIndex < bestOption.skippedFindLines();
      findIndex++
    ) {
      linesSkipped += lineSkippedValue(find[findLine + findIndex]);
    }

    bestOption.apply();
    similaritySum += bestSimialrity;
  }

  if (original.length === 0 && find.length === 0) {
    return { similiarity: 1, mappedFind };
  }

  if (original.length === 0 && find.length !== 0) {
    return { similiarity: 0, mappedFind };
  }

  const averageSimilarity =
    originalSimilarityLines === 0 ? 1 : similaritySum / originalSimilarityLines;
  const noSkipRatio =
    (3 * (1 - linesSkipped / original.length) + 1 * (1 / (1 + linesSkipped))) /
    4;

  return { similiarity: averageSimilarity * noSkipRatio, mappedFind };
}

export const coreSimilarityFunction = (
  original: string[],
  replacement: string[],
) => {
  if (original.join('\n') === replacement.join('\n')) {
    return 1;
  }

  const similartyWithWsDistance = exactLinesSimilarityAndMap(
    original,
    replacement,
    (a, b) =>
      ignoreLeadingAndTrailingWhiteSpaceSimilariryunction(
        a,
        b,
        codeStringSimilarity,
      ),
  ).similiarity;

  const similarityNotIgnoringWhitespace = exactLinesSimilarityAndMap(
    normalizeIndent(stripAllComments(original)),
    normalizeIndent(stripAllComments(replacement)),
    levenshteinDistanceSimilarity,
  ).similiarity;

  const core = Math.max(
    similartyWithWsDistance,
    similarityNotIgnoringWhitespace,
  );

  const similarity =
    0.6 * core +
    0.2 * similartyWithWsDistance +
    0.2 * similarityNotIgnoringWhitespace;

  if (isNaN(similarity)) {
    throw new Error('similarity is NaN');
  }

  {
    // Just for testing
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const similartyWithWsDistance = exactLinesSimilarityAndMap(
      original,
      replacement,
      (a, b) =>
        ignoreLeadingAndTrailingWhiteSpaceSimilariryunction(
          a,
          b,
          codeStringSimilarity,
        ),
    ).similiarity;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const similarityNotIgnoringWhitespace = exactLinesSimilarityAndMap(
      normalizeIndent(stripAllComments(original)),
      normalizeIndent(stripAllComments(replacement)),
      levenshteinDistanceSimilarity,
    ).similiarity;
  }

  return similarity;
};

export async function fuzzyFindText({
  currentCode,
  findText,
  similarityFunction = coreSimilarityFunction,
  lineNumTolerance = Math.ceil(findText.split('\n').length * 0.05),
  similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
}: {
  currentCode: string;
  findText: string;
  similarityFunction?: (original: string[], replacement: string[]) => number;
  lineNumTolerance?: number;
  similarityThreshold?: number;
}): Promise<{
  lineStartIndex: number;
  lineEndIndex: number;
  confidence: number;
}> {
  const currentCodeLines = currentCode.split('\n');
  const findTextLines = findText.split('\n');

  // Step 3: Iterate through the currentCodeLines with a nested loop to find the highest similarity between the lines in the currentCode and the findText.
  let maxSimilarity = -1;
  let maxSimilarityLineStartIndex = -1;
  let maxSimilarityLineEndIndex = -1;

  const minLinesToReplace = Math.max(
    0,
    findTextLines.length - lineNumTolerance,
  );

  for (
    let start = 0;
    start < currentCodeLines.length - minLinesToReplace;
    start++
  ) {
    let maxLinesToReplace = minLinesToReplace + 3; // This will get enlarged
    let lastSimilarity = 0;
    for (
      let end = start + minLinesToReplace;
      end <= Math.min(currentCodeLines.length, start + maxLinesToReplace);
      end++
    ) {
      const currentSlice = currentCodeLines.slice(start, end);
      const similarity = similarityFunction(currentSlice, findTextLines);

      if (similarity > lastSimilarity) {
        maxLinesToReplace += 1;
      }
      lastSimilarity = similarity;

      if (similarity > maxSimilarity && similarity >= similarityThreshold) {
        //console.log(`sim: ${similarity} start: ${start} end: ${end} minLinesToReplace: ${minLinesToReplace} maxLinesToReplace: ${maxLinesToReplace}`);

        maxSimilarity = similarity;
        maxSimilarityLineStartIndex = start;
        maxSimilarityLineEndIndex = end;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1));
  }

  return {
    lineStartIndex: maxSimilarityLineStartIndex,
    lineEndIndex: maxSimilarityLineEndIndex,
    confidence: maxSimilarity,
  };
}

export async function fuzzyReplaceTextInner({
  currentCode,
  findText,
  withText,
  similarityFunction = coreSimilarityFunction,
  similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
}: {
  currentCode: string;
  findText: string;
  withText: string;
  similarityFunction?: MultiLineSimilarityFunction;
  similarityThreshold?: number;
  lineNumTolerance?: number;
}) {
  const {
    lineStartIndex: startIndex,
    lineEndIndex: endIndex,
    confidence,
  } = await fuzzyFindText({
    currentCode,
    findText,
    similarityFunction,
    similarityThreshold,
  });

  if (confidence >= similarityThreshold) {
    const currentCodeLines = currentCode.split('\n');

    const currentSlice = currentCodeLines.slice(startIndex, endIndex);
    const findTextLines = findText.split('\n');
    const withTextLines = withText.split('\n');

    function mapFindWithIndent(
      originalLine: string | undefined,
      searchLine: string,
    ) {
      if (originalLine === undefined) {
        return lastIndent + searchLine;
      } else {
        const indentDiff = getIndentationDifference(originalLine, searchLine);
        lastIndent = indentDiff;
        return indentDiff + searchLine;
      }
    }

    let lastIndent = '';

    const indentAdjustedFindLines = exactLinesSimilarityAndMap(
      currentSlice,
      findTextLines,
      (a, b) => levenshteinDistanceSimilarity(a, b),
      mapFindWithIndent,
    ).mappedFind;

    lastIndent = '';

    //split the withTextLines into a segment containing the segment up to first non empty first line and a segment containing the rest
    const withTextUpToFirstNonEmptyLine = withTextLines.slice(0, 1);
    const withTextRest = withTextLines.slice(1);

    const indentAdjustedFindLinesUpToFirstNonEmptyLine =
      indentAdjustedFindLines.slice(0, 1);
    const indentAdjustedFindLinesRest = indentAdjustedFindLines.slice(1);

    const indentAdjustedWithTextupToFirstNonEmptyLine =
      exactLinesSimilarityAndMap(
        indentAdjustedFindLinesUpToFirstNonEmptyLine,
        withTextUpToFirstNonEmptyLine,
        (a, b) => levenshteinDistanceSimilarity(a, b),
        mapFindWithIndent,
      ).mappedFind;

    const overalIndentDifference =
      findIndentationDifference(
        indentAdjustedFindLinesRest,
        withTextRest,
        equalsStringSimilarity,
      ) || '';
    const indentAdjustedWithTextRest = applyIndent(
      withTextRest,
      overalIndentDifference,
    );
    const indentAdjustedWithLines = [
      ...indentAdjustedWithTextupToFirstNonEmptyLine,
      ...indentAdjustedWithTextRest,
    ];

    const adjustedWithText = indentAdjustedWithLines.join('\n');

    const preChange = currentCodeLines.slice(0, startIndex).join('\n');
    const postChange = currentCodeLines.slice(endIndex).join('\n');

    return [
      preChange + (preChange ? '\n' : ''),
      adjustedWithText,
      (postChange ? '\n' : '') + postChange,
    ];
  }
}

export async function fuzzyReplaceText({
  currentCode,
  findText,
  withText,
  similarityFunction = coreSimilarityFunction,
  similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
}: {
  currentCode: string;
  findText: string;
  withText: string;
  similarityFunction?: MultiLineSimilarityFunction;
  similarityThreshold?: number;
  lineNumTolerance?: number;
}) {
  return (
    await fuzzyReplaceTextInner({
      currentCode,
      findText,
      withText,
      similarityFunction,
      similarityThreshold,
    })
  )?.join('');
}

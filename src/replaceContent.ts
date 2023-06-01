import * as vscode from "vscode";
import { editDocument } from "./AICursor";
import * as Diff from "diff";

export async function replaceContent(
  document: vscode.TextDocument,
  newContent: string
) {
  await editDocument(async (edit) => {
    if (document) {
      edit.replace(
        document.uri,
        new vscode.Range(
          new vscode.Position(0, 0),
          new vscode.Position(
            document.lineCount,
            document.lineAt(document.lineCount - 1).text.length
          )
        ),
        newContent!
      );
    }
  });
}

function levenshtein(a: string, b: string) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  // increment along the first column of each row
  let i;
  for (i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // increment each column in the first row
  let j;
  for (j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (i = 1; i <= b.length; i++) {
    for (j = 1; j <= a.length; j++) {
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

function simplify(code: string) {
  // Replace all non-identifier characters with a space
  let simplified = code.replace(/[^a-zA-Z0-9{}()[\];_]/g, " ");

  // Replace multiple consecutive spaces with a single space
  simplified = simplified.replace(/\s+/g, " ");

  return simplified.trim();
}

function calculateSimilarity(code1: string, code2: string) {
  const simplified1 = simplify(code1);
  const simplified2 = simplify(code2);

  // Calculate structure similarity
  const structure1 = simplified1.replace(/[a-zA-Z0-9_]/g, "");
  const structure2 = simplified2.replace(/[a-zA-Z0-9_]/g, "");
  let structureSimilarity = 0;
  if (structure1.length === 0 && structure2.length === 0) {
    structureSimilarity = 1;
  } else if (structure1.length > 0 || structure2.length > 0) {
    const structureDistance = levenshtein(structure1, structure2);
    structureSimilarity =
      1 - structureDistance / Math.max(structure1.length, structure2.length);
  }

  // Calculate identifier similarity
  const identifiers1 = simplified1.match(/[a-zA-Z0-9_]+/g) || [];
  const identifiers2 = simplified2.match(/[a-zA-Z0-9_]+/g) || [];
  let identifierSimilarity = 0;
  if (identifiers1.length === 0 && identifiers2.length === 0) {
    identifierSimilarity = 1;
  } else if (identifiers1.length > 0 || identifiers2.length > 0) {
    const identifierDistance = levenshtein(
      identifiers1.join(" "),
      identifiers2.join(" ")
    );
    identifierSimilarity =
      1 -
      identifierDistance /
        Math.max(identifiers1.join(" ").length, identifiers2.join(" ").length);
  }

  // Calculate combined similarity
  const combinedSimilarity = (structureSimilarity + identifierSimilarity) / 2;

  return combinedSimilarity;
}

export async function replaceContentWithDiff(
  document: vscode.TextDocument,
  postfix: string,
  diff: string
) {
  return new Promise<void>(async (resolve, reject) => {
    try {
      let content = document.getText();

      let modifiedContent = Diff.applyPatch(content, diff, {
        fuzzFactor: 5,
        compareLine: (
          lineNumber: number,
          line: string,
          operation: "-" | " ",
          patchContent: string
        ) => {
          let similarity = calculateSimilarity(line, patchContent);
          console.log(
            `similarity ${similarity} line ${line} patchContent ${patchContent}`
          );
          return similarity > 0.9;
        },
      });

      if (!modifiedContent) {
        reject("Unable to apply diff.");
      } else {
        modifiedContent = modifiedContent + "\n\n" + postfix;
        await replaceContent(document, modifiedContent);
        resolve();
      }
    } catch (err) {
      vscode.window.showErrorMessage("Error applying diff: " + err);
      reject(err);
    }
  });
}

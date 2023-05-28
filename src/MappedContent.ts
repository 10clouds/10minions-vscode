import * as vscode from "vscode";
import { randomBytes } from "crypto";

export type MappedContent = {
  id: string;
  lastKnownPosition: number;
  line: string;
}[];

export function mapFileContents(contents: string): MappedContent {
  return contents.split("\n").map((line, index) => {
    return {
      id: randomBytes(4).toString("hex"),
      lastKnownPosition: index,
      line,
    };
  });
}

export function formatMappedContent(mappedContent: MappedContent): string {
  return `
id      | line contents
--------|-----------------------------
${mappedContent.map((line) => `${line.id}| ${line.line}`).join("\n")}
`.trim();
}

export function indentifyLine(
  lineId: string,
  document: vscode.TextDocument,
  mappedContent: MappedContent
) {
  let possiblyMappedLine = mappedContent.find(
    (line) => line.id === lineId
  );
  if (!possiblyMappedLine) {
    throw new Error("Line not found");
  }
  let mappedLine = possiblyMappedLine;

  let lineNumberToGoTo = mappedLine.lastKnownPosition;

  //check whenever the content of the line matches, if not search for the nearest line that matches content
  //if not found stop execution
  if (document.lineCount <= lineNumberToGoTo ||
    document.lineAt(lineNumberToGoTo).text !== mappedLine.line) {
    //idenfify matching lines
    let matchingLines = document
      .getText()
      .split("\n")
      .map((line, index) => {
        return {
          line,
          index,
        };
      })
      .filter((line) => line.line === mappedLine.line);

    //find the nearest line
    let nearestLine = matchingLines.reduce((prev, curr) => {
      let prevDistance = Math.abs(prev.index - mappedLine.lastKnownPosition);
      let currDistance = Math.abs(curr.index - mappedLine.lastKnownPosition);
      return currDistance < prevDistance ? curr : prev;
    });

    lineNumberToGoTo = nearestLine.index;

    //if not found stop execution
    if (document.lineAt(lineNumberToGoTo).text !== mappedLine.line) {
      console.log("Line not found", lineId);
      return;
    }
  }

  return lineNumberToGoTo;
}

import * as vscode from "vscode";
import { MappedContent } from "./MappedContent";

export function indentifyLine(
  lineId: string,
  document: vscode.TextDocument,
  mappedContent: MappedContent
) {
  let possiblyMappedLine = mappedContent.find(
    (line) => (line.lastKnownPosition + 1).toString() === lineId
  );
  if (!possiblyMappedLine) {
    throw new Error("Line not found");
  }
  let mappedLine = possiblyMappedLine;

  let lineToGoTo = mappedLine.lastKnownPosition;

  //check whenever the content of the line matches, if not search for the nearest line that matches content
  //if not found stop execution
  if (document.lineCount <= lineToGoTo ||
    document.lineAt(lineToGoTo).text !== mappedLine.line) {
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

    lineToGoTo = nearestLine.index;

    //if not found stop execution
    if (document.lineAt(lineToGoTo).text !== mappedLine.line) {
      console.log("Line not found", lineId);
      return;
    }
  }

  return lineToGoTo;
}

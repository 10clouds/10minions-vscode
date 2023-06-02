import * as React from "react";
import { ExecutionInfo } from "./ExecutionInfo";
import { StopIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { ProgressBar } from "./ProgressBar";
import { vscode } from "./SideBarWebViewInnerComponent";

// eslint-disable-next-line @typescript-eslint/naming-convention
export function Execution({ execution }: { execution: ExecutionInfo; }) {
  let userQueryLines = execution.userQuery.split("\n");
  let userQueryPreview = userQueryLines[0].substring(0, 100);

  if (userQueryLines.length > 1 || userQueryLines[0].length > 100) {
    userQueryPreview += "…";
  }
  return (
    <div
      key={execution.id}
      className="mb-2 p-4 bg-gray-700 rounded flex flex-col"
    >
      <div className="flex justify-between">
        <div className="font-semibold mb-2">
          <span
            className="cursor-pointer"
            onClick={() => {
              vscode.postMessage({
                type: "openDocument",
                documentURI: execution.documentURI,
              });
            }}
          >
            🧠 {execution.documentName}
          </span>
        </div>

        {!execution.stopped ? (
          <StopIcon
            onClick={() => {
              vscode.postMessage({
                type: "stopExecution",
                executionId: execution.id,
              });
            }}
            className="stop-button  h-6 w-6 cursor-pointer" />
        ) : (
          <XMarkIcon
            onClick={() => {
              vscode.postMessage({
                type: "closeExecution",
                executionId: execution.id,
              });
            }}
            className="stop-button h-6 w-6 cursor-pointer" />
        )}
      </div>
      <div className="mb-2">{userQueryPreview}</div>
      <div className="mb-2">{execution.executionStage}</div>
      <div
        className="mb-2 cursor-pointer w-full flex justify-center"
        onClick={() => {
          vscode.postMessage({
            type: "openDocument",
            documentURI: execution.logFileURI,
          });
        }}
      >
        <ProgressBar progress={execution.progress} />
      </div>
    </div>
  );
}

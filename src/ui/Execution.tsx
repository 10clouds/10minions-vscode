import * as React from "react";
import { ExecutionInfo, FINISHED_STAGE_NAME } from "./ExecutionInfo";
import { ArrowPathIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { ProgressBar } from "./ProgressBar";
import { vscode } from "./SideBarWebViewInnerComponent";

function getUserQueryPreview(userQuery: string) {
  const lines = userQuery.split("\n");
  let preview = lines[0].substring(0, 100);

  if (lines.length > 1 || lines[0].length > 100) {
    preview += "…";
  }

  return preview;
}

export function Execution({ execution }: { execution: ExecutionInfo }) {
  const userQueryPreview = getUserQueryPreview(execution.userQuery);

  return (
    <div
      style={{
        backgroundColor: "var(--vscode-editor-background)",
        color: "var(--vscode-editor-foreground)",
        borderColor: "var(--vscode-focusBorder)",
        animation: "bounce-half 0.3s",
      }}
      key={execution.id}
      className="execution mb-2 p-4 rounded flex flex-col"
    >
      <div className="flex justify-between">
        <div className="text-base font-semibold mb-2 flex-grow">
          <span
            title="Open Document" // Added tooltip
            className="cursor-pointer"
            onClick={() => {
              vscode.postMessage({
                type: "openDocument",
                documentURI: execution.documentURI,
              });
            }}
          >
            🤖 {execution.documentName}
          </span>
        </div>

        {execution.stopped && (
          <ArrowPathIcon
            title="Re-run Execution" // Added tooltip
            onClick={() => {
              vscode.postMessage({
                type: "reRunExecution",
                executionId: execution.id,
              });
            }}
            className="h-6 w-6 cursor-pointer"
          />
        )}

        {!execution.stopped ? (
          <span
            title="Stop Execution" // Added tooltip
            onClick={() => {
              vscode.postMessage({
                type: "stopExecution",
                executionId: execution.id,
              });
            }}
            className="cursor-pointer"
          >
            Stop
          </span>
        ) : (
          <XMarkIcon
            title="Close Execution" // Added tooltip
            onClick={() => {
              vscode.postMessage({
                type: "closeExecution",
                executionId: execution.id,
              });
            }}
            className="h-6 w-6 cursor-pointer"
          />
        )}
      </div>
      <div className="mb-2">{userQueryPreview}</div>
      <hr className="mb-2 mt-2" style={{ opacity: 0.2 }} />
      <div className="mb-2">
        {execution.executionStage}{" "}
        {execution.executionStage === FINISHED_STAGE_NAME && (
          (<a
            //present it as a link
            title="Show Diff" // Added tooltip
            className="inline-block btn cursor-pointer"
            onClick={() => {
              vscode.postMessage({
                type: "showDiff",
                executionId: execution.id,
              });
            }}
          >
            Show diff
          </a>)
        )}
      </div>
      <div
        className="mb-2 cursor-pointer w-full flex justify-center"
        title="Open Log File" // Added tooltip
        onClick={() => {
          vscode.postMessage({
            type: "openDocument",
            documentURI: execution.logFileURI,
          });
        }}
      >
        <ProgressBar progress={execution.progress} stopped={execution.stopped} />
      </div>
    </div>
  );
}
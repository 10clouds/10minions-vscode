import * as React from "react";
import { ExecutionInfo, FINISHED_STAGE_NAME } from "./ExecutionInfo";
import { ArrowPathIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { ProgressBar } from "./ProgressBar";
import { vscode } from "./SideBarWebViewInnerComponent";

export function Execution({ execution }: { execution: ExecutionInfo }) {
  let userQueryLines = execution.userQuery.split("\n");
  let userQueryPreview = userQueryLines[0].substring(0, 100);

  if (userQueryLines.length > 1 || userQueryLines[0].length > 100) {
    userQueryPreview += "…";
  }
  return (
    <div
      key={execution.id}
      className="mb-2 p-4 bg-gray-700 rounded flex flex-col"
      style={{
        animation: "bounce-half 0.3s",
      }}
    >
      <div className="flex justify-between">
        <div className="font-semibold mb-2 flex-grow">
          <span
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
            onClick={() => {
              vscode.postMessage({
                type: "reRunExecution",
                executionId: execution.id,
              });
            }}
            className="stop-button  h-6 w-6 cursor-pointer"
          />
        )}

        {!execution.stopped ? (
          <span
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
            onClick={() => {
              vscode.postMessage({
                type: "closeExecution",
                executionId: execution.id,
              });
            }}
            className="stop-button h-6 w-6 cursor-pointer"
          />
        )}
      </div>
      <div className="mb-2">{userQueryPreview}</div>
      <div className="mb-2">
        {execution.executionStage}{" "}
        {execution.executionStage === FINISHED_STAGE_NAME && (
          <button
            //present it as a link
            className="inline-block btn btn-link p-0 m-0 text-sm text-blue-500 hover:text-blue-200"
            onClick={() => {
              vscode.postMessage({
                type: "showDiff",
                executionId: execution.id,
              });
            }}
          >
            Show diff
          </button>
        )}
      </div>
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

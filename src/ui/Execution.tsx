import { XMarkIcon } from "@heroicons/react/24/solid";
import * as React from "react";
import { ExecutionInfo, FINISHED_STAGE_NAME } from "./ExecutionInfo";
import { ProgressBar } from "./ProgressBar";
import { vscode } from "./SideBarWebViewInnerComponent";

function adjustTextAreaHeight(target: HTMLTextAreaElement) {
  target.style.height = "auto";
  target.style.height = target.scrollHeight + "px";
}

function getUserQueryPreview(userQuery: string) {
  const lines = userQuery.split("\n");
  let preview = lines[0].substring(0, 100);

  if (lines.length > 1 || lines[0].length > 100) {
    preview += "…";
  }

  return preview;
}

export function Execution({ execution, ...props }: { execution: ExecutionInfo } & React.HTMLAttributes<HTMLDivElement>) {
  const { className, ...propsWithoutClassName } = props;

  const userQueryPreview = getUserQueryPreview(execution.userQuery);

  // State variables for managing the input field state
  const [isInputOpen, setIsInputOpen] = React.useState(false);
  const [updatedPrompt, setUpdatedPrompt] = React.useState(execution.userQuery);

  React.useEffect(() => {
    setUpdatedPrompt(execution.userQuery);
  }, [execution.userQuery]);

  React.useLayoutEffect(() => {
    if (isInputOpen) {
      const textAreaElement = document.querySelector<HTMLTextAreaElement>(".execution textarea");
      if (textAreaElement) {
        adjustTextAreaHeight(textAreaElement);
      }
    }
  }, [isInputOpen]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Only call handleRun() when Enter key is pressed without Shift
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      setIsInputOpen(false);

      handleRun();
    }
  }

  function handleRun() {
    if (updatedPrompt !== execution.userQuery) {
      // Stop the current execution
      vscode.postMessage({
        type: "stopExecution",
        executionId: execution.id,
      });

      // Re-run the execution with the updated prompt
      vscode.postMessage({
        type: "reRunExecution",
        executionId: execution.id,
        newUserQuery: updatedPrompt, // Pass the updated prompt value
      });
    }
  }

  return (
    <div
      style={{
        backgroundColor: "var(--vscode-editor-background)",
        color: "var(--vscode-editor-foreground)",
        borderColor: "var(--vscode-focusBorder)",
        animation: "bounce-half 0.3s",
      }}
      key={execution.id}
      className={`execution mb-2 p-4 rounded flex flex-col ${className}`}
      {...propsWithoutClassName}
    >
      <div className="flex justify-between">
        <div className="text-base font-semibold mb-2 flex-grow">
          <span
            title="Open Document"
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
        <XMarkIcon
          title="Close Execution"
          onClick={() => {
            vscode.postMessage({
              type: "closeExecution",
              executionId: execution.id,
            });
          }}
          className="h-6 w-6 cursor-pointer"
        />
      </div>
      <div className="mb-2" onClick={() => setIsInputOpen(true)}>
        {isInputOpen ? (
          <textarea
            style={{
              backgroundColor: "inherit",
              color: "inherit",
              border: "none",
              outline: "none",
              cursor: "text",
              width: "100%", // Make it span the entire line
              resize: "none", // Disable the resizing of the textarea
            }}
            value={updatedPrompt}
            onChange={(event) => setUpdatedPrompt(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              setIsInputOpen(false);
              handleRun();
            }}
            autoFocus
            // Make the textarea auto expand based on the content
            onInput={(event: React.FormEvent<HTMLTextAreaElement>) => {
              adjustTextAreaHeight(event.target as HTMLTextAreaElement);
            }}
          />
        ) : (
          userQueryPreview
        )}{" "}
      </div>
      <hr className="mb-2 mt-2" style={{ opacity: 0.2 }} />
      <div className="flex justify-between mb-2 items-center">
        <span>
          {execution.executionStage}{" "}
          {execution.executionStage === FINISHED_STAGE_NAME && (
            <a
              //present it as a link
              title="Show Diff"
              className="inline-block btn cursor-pointer"
              onClick={() => {
                vscode.postMessage({
                  type: "showDiff",
                  executionId: execution.id,
                });
              }}
            >
              Show diff
            </a>
          )}
        </span>
        {!execution.stopped ? (
          <a
            title="Stop Execution"
            onClick={() => {
              vscode.postMessage({
                type: "stopExecution",
                executionId: execution.id,
              });
            }}
            className="cursor-pointer "
          >
            Stop
          </a>
        ) : (
          <a
            title="Re-run Execution"
            onClick={() => {
              vscode.postMessage({
                type: "reRunExecution",
                executionId: execution.id,
              });
            }}
            className="cursor-pointer "
          >
            Re-run
          </a>
        )}
      </div>
      {execution.classification === "AnswerQuestion" ? (
        <pre style={{ whiteSpace: "pre-wrap" }}>{execution.modificationDescription}</pre>
      ) : (
        <>
          <div className="flex items-center mb-2">
            <div
              className="cursor-pointer w-full"
              title="Open Log File"
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
        </>
      )}
    </div>
  );
}

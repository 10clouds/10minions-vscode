import { XMarkIcon, ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/solid";
import * as React from "react";
import { ExecutionInfo, FINISHED_STAGE_NAME } from "./ExecutionInfo";
import { ProgressBar } from "./ProgressBar";
import { postMessageToVsCode } from "./SideBarWebViewInnerComponent";
import { forwardRef } from "react";
import { ALL_MINION_ICONS_FILL } from "./MinionIconsFill";
import { blendWithForeground, getBaseColor } from "../utils/blendColors";
import { exec } from "child_process";

function adjustTextAreaHeight(target: HTMLTextAreaElement) {
  target.style.height = "auto";
  target.style.height = target.scrollHeight + "px";
}

// Constants
const MAX_PREVIEW_LENGTH = 100;

function getUserQueryPreview(userQuery: string) {
  const lines = userQuery.split("\n");
  let preview = lines[0].substring(0, MAX_PREVIEW_LENGTH);

  // Add ellipsis if the query exceeds the preview length or has multiple lines
  if (lines.length > 1 || lines[0].length > MAX_PREVIEW_LENGTH) {
    preview += "…";
  }

  return preview;
}

export const MinionTaskComponent = forwardRef(
  ({ execution, ...props }: { execution: ExecutionInfo } & React.HTMLAttributes<HTMLDivElement>, ref: React.ForwardedRef<HTMLDivElement>) => {
    const { className, ...propsWithoutClassName } = props;

    const userQueryPreview = getUserQueryPreview(execution.userQuery);
    const [isExpanded, setIsExpanded] = React.useState(false);

    // State variables for managing the input field state
    const [isInputOpen, setIsInputOpen] = React.useState(false);
    const [updatedPrompt, setUpdatedPrompt] = React.useState(execution.userQuery);

    React.useEffect(() => {
      if (execution.classification === "AnswerQuestion") {
        setIsExpanded(true);
      }
    }, [execution.classification]);

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
       postMessageToVsCode({
          type: "stopExecution",
          executionId: execution.id,
        });

        // Retry the execution with the updated prompt
       postMessageToVsCode({
          type: "reRunExecution",
          executionId: execution.id,
          newUserQuery: updatedPrompt, // Pass the updated prompt value
        });
      }
    }

    function simpleStringHash(str: string) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const charCode = str.charCodeAt(i);
        hash = (hash << 5) - hash + charCode;
        hash |= 0; // Convert to a 32-bit integer
      }
      return Math.abs(hash);
    }

    function handleClickShowDiff() {
     postMessageToVsCode({
        type: "showDiff",
        executionId: execution.id,
      });
    }

    let RobotIcon = ALL_MINION_ICONS_FILL[execution.minionIndex];

    return (
      <div
        ref={ref}
        style={{
          backgroundColor: "var(--vscode-editor-background)",
          color: "var(--vscode-editor-foreground)",
          borderColor: "var(--vscode-focusBorder)",
        }}
        key={execution.id}
        className={`execution mb-4 overflow-hidden rounded flex flex-col ${className}`}
        {...propsWithoutClassName}
      >
        <div className="pl-3 pr-3 pt-3 pb-3">
          <div className="flex justify-between">
            <div
              title="Open Log"
              onClick={() => {
               postMessageToVsCode({
                  type: "openDocument",
                  documentURI: execution.logFileURI,
                });
              }}
              className={`w-6 h-6 mr-2 cursor-pointer transition-color ${!execution.stopped && !execution.waiting ? "busy-robot" : ""}`}
              style={{
                color: blendWithForeground(getBaseColor(execution)),
              }}
            >
              <RobotIcon className={`w-6 h-6 inline-flex ${!execution.stopped && !execution.waiting ? "busy-robot-extra" : ""}`} />
            </div>
            <div className="text-base font-semibold flex-grow flex-shrink truncate">
              <span
                className="cursor-pointer truncate"
                title="Open Log"
                onClick={() => {
                 postMessageToVsCode({
                    type: "openDocument",
                    documentURI: execution.logFileURI,
                  });
                }}
              >
                {execution.shortName}
              </span>
            </div>
            {execution.waiting && <button
                title="Force execution anyway"
                onClick={() => {
                 postMessageToVsCode({
                    type: "forceExecution",
                    executionId: execution.id,
                  });
                }}
                style={{
                  borderColor: "var(--vscode-button-separator)",
                }}
                className="cursor-pointer border rounded px-2 ml-2"
              >
                Force
              </button>}
            {execution.executionStage === FINISHED_STAGE_NAME && (
              <button
                title="Show Diff"
                style={{
                  borderColor: "var(--vscode-button-separator)",
                }}
                className="cursor-pointer border rounded px-2 ml-2"
                onClick={handleClickShowDiff}
              >
                Diff
              </button>
            )}
            {!execution.stopped ? (
              <button
                title="Stop Execution"
                onClick={() => {
                 postMessageToVsCode({
                    type: "stopExecution",
                    executionId: execution.id,
                  });
                }}
                style={{
                  borderColor: "var(--vscode-button-separator)",
                }}
                className="cursor-pointer border rounded px-2 ml-2"
              >
                Stop
              </button>
            ) : (
              <button
                title="Retry Execution"
                onClick={() => {
                 postMessageToVsCode({
                    type: "reRunExecution",
                    executionId: execution.id,
                  });
                }}
                style={{
                  borderColor: "var(--vscode-button-separator)",
                }}
                className="cursor-pointer border rounded px-2 ml-2"
              >
                Retry
              </button>
            )}
            {isExpanded ? (
              <ChevronDownIcon title="Contract" onClick={() => setIsExpanded(false)} className="h-6 w-6  min-w-min cursor-pointer ml-2" />
            ) : (
              <ChevronUpIcon title="Expand" onClick={() => setIsExpanded(true)} className="h-6 w-6 min-w-min cursor-pointer ml-2" />
            )}
            <XMarkIcon
              title="Close Execution"
              onClick={() => {
               postMessageToVsCode({
                  type: "closeExecution",
                  executionId: execution.id,
                });
              }}
              className="h-6 w-6 min-w-min cursor-pointer ml-2"
            />
          </div>

          {isExpanded && (
            <>
              <div className="grid grid-cols-[auto,1fr] gap-x-4 mt-4 mb-2">
                <div className="mb-2">File:</div>

                <span
                  title="Open Document"
                  className="cursor-pointer mb-2"
                  onClick={() => {
                   postMessageToVsCode({
                      type: "openDocument",
                      documentURI: execution.documentURI,
                    });
                  }}
                >
                  {execution.documentName}
                </span>

                <div className="mb-2">Task:</div>

                <div className="mb-2 overflow-x-auto" onClick={() => setIsInputOpen(true)}>
                  {isInputOpen ? (
                    <textarea
                      style={{
                        backgroundColor: "inherit",
                        color: "inherit",
                        border: "none",
                        outline: "none",
                        width: "100%", // Make it span the entire line
                        resize: "none", // Disable the resizing of the textarea
                        margin: 0,
                        padding: 0,
                      }}
                      value={updatedPrompt}
                      onChange={(event) => setUpdatedPrompt(event.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={() => {
                        setIsInputOpen(false);
                        handleRun();
                      }}
                      autoFocus
                      onInput={(event: React.FormEvent<HTMLTextAreaElement>) => {
                        adjustTextAreaHeight(event.target as HTMLTextAreaElement);
                      }}
                    />
                  ) : (
                    // Wrap the userQueryPreview inside a div with the same line-height as the textarea
                    // Apply required padding and margin in this div
                    <div>{userQueryPreview}</div>
                  )}
                </div>

                {execution.selectedText && <div>Selection:</div>}
                {execution.selectedText && (
                  <div
                    className="text-xs overflow-auto"
                    style={{
                      whiteSpace: "pre",
                    }}
                  >
                    <pre>{execution.selectedText}</pre>
                  </div>
                )}
              </div>
              <div>
                {execution.classification === "AnswerQuestion" ? <pre style={{ whiteSpace: "pre-wrap" }}>{execution.modificationDescription}</pre> : <></>}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center">
          <div
            className="cursor-pointer w-full"
            title="Open Log"
            onClick={() => {
             postMessageToVsCode({
                type: "openDocument",
                documentURI: execution.logFileURI,
              });
            }}
          >
            <ProgressBar execution={execution} />
          </div>
        </div>
      </div>
    );
  }
);

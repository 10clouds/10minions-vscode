import { ChevronDownIcon, ChevronUpIcon, XMarkIcon } from "@heroicons/react/24/solid";
import * as React from "react";
import { forwardRef } from "react";
import { blendWithForeground, getBaseColor } from "../utils/blendColors";
import { ALL_MINION_ICONS_FILL } from "./MinionIconsFill";
import { FINISHED_STAGE_NAME, MinionTaskUIInfo } from "./MinionTaskUIInfo";
import { ProgressBar } from "./ProgressBar";
import { postMessageToVsCode } from "./SideBarWebViewInnerComponent";

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
  ({ minionTask, ...props }: { minionTask: MinionTaskUIInfo } & React.HTMLAttributes<HTMLDivElement>, ref: React.ForwardedRef<HTMLDivElement>) => {
    const { className, ...propsWithoutClassName } = props;

    const userQueryPreview = getUserQueryPreview(minionTask.userQuery);
    const [isExpanded, setIsExpanded] = React.useState(false);

    // State variables for managing the input field state
    const [isInputOpen, setIsInputOpen] = React.useState(false);
    const [updatedPrompt, setUpdatedPrompt] = React.useState(minionTask.userQuery);

    React.useEffect(() => {
      if (minionTask.classification === "AnswerQuestion") {
        setIsExpanded(true);
      }
    }, [minionTask.classification]);

    React.useEffect(() => {
      setUpdatedPrompt(minionTask.userQuery);
    }, [minionTask.userQuery]);

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
      if (updatedPrompt !== minionTask.userQuery) {
        // Stop the current execution
        postMessageToVsCode({
          type: "stopExecution",
          minionTaskId: minionTask.id,
        });

        // Retry the execution with the updated prompt
        postMessageToVsCode({
          type: "reRunExecution",
          minionTaskId: minionTask.id,
          newUserQuery: updatedPrompt, // Pass the updated prompt value
        });
      }
    }

    function handleClickShowDiff() {
      postMessageToVsCode({
        type: "showDiff",
        minionTaskId: minionTask.id,
      });
    }

    let RobotIcon = ALL_MINION_ICONS_FILL[minionTask.minionIndex];

    const forceButton = (
      <button
        title="Force execution anyway"
        onClick={() => {
          postMessageToVsCode({
            type: "forceExecution",
            minionTaskId: minionTask.id,
          });
        }}
        style={{
          borderColor: "var(--vscode-button-separator)",
        }}
        className="cursor-pointer border rounded px-2 ml-2"
      >
        Force
      </button>
    );

    const stopButton = (
      <button
        title="Stop Execution"
        onClick={() => {
          postMessageToVsCode({
            type: "stopExecution",
            minionTaskId: minionTask.id,
          });
        }}
        style={{
          borderColor: "var(--vscode-button-separator)",
        }}
        className="cursor-pointer border rounded px-2 ml-2"
      >
        Stop
      </button>
    );

    const chevronButton = isExpanded ? <ChevronDownIcon className="h-6 w-6 min-w-min ml-2" /> : <ChevronUpIcon className="h-6 w-6 min-w-min ml-2" />;

    const closeButton = (
      <XMarkIcon
        title="Close Execution"
        onClick={() => {
          postMessageToVsCode({
            type: "closeExecution",
            minionTaskId: minionTask.id,
          });
        }}
        className="h-6 w-6 min-w-min cursor-pointer ml-2"
      />
    );

    const diffButton = (
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
    );

    const retryButton = (
      <button
        title="Retry Execution"
        onClick={() => {
          postMessageToVsCode({
            type: "reRunExecution",
            minionTaskId: minionTask.id,
          });
        }}
        style={{
          borderColor: "var(--vscode-button-separator)",
        }}
        className="cursor-pointer border rounded px-2 ml-2"
      >
        Retry
      </button>
    );

    return (
      <div
        ref={ref}
        style={{
          backgroundColor: "var(--vscode-editor-background)",
          color: "var(--vscode-editor-foreground)",
          borderColor: "var(--vscode-focusBorder)",
        }}
        key={minionTask.id}
        className={`execution mb-4 overflow-hidden rounded flex flex-col ${className}`}
        {...propsWithoutClassName}
      >
        <div className="pl-3 pr-3 pt-3 pb-3">
          <div
            className="flex justify-between cursor-pointer"
            title={!isExpanded ? "Click for more info" : "Click to hide"}
            onClick={() => {
              setIsExpanded(!isExpanded);
            }}
          >
            <div
              className={`w-6 h-6 mr-2 transition-color ${!minionTask.stopped && !minionTask.waiting ? "busy-robot" : ""}`}
              style={{
                color: blendWithForeground(getBaseColor(minionTask)),
              }}
            >
              <RobotIcon className={`w-6 h-6 inline-flex ${!minionTask.stopped && !minionTask.waiting ? "busy-robot-extra" : ""}`} />
            </div>
            <div className="text-base font-semibold flex-grow flex-shrink truncate">
              <span className="truncate">{minionTask.shortName}</span>
            </div>
            {minionTask.waiting && !minionTask.stopped && forceButton}

            {!minionTask.stopped ? (
              <button
                title="Stop Execution"
                onClick={() => {
                  postMessageToVsCode({
                    type: "stopExecution",
                    minionTaskId: minionTask.id,
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
              <> </>
            )}
            {chevronButton}
            {closeButton}
          </div>

          {isExpanded && (
            <>
              <div className="grid grid-cols-[auto,1fr] gap-x-4 mt-4 mb-2">
                <div className="mb-2">Log:</div>
                <span
                  title="Open Document"
                  className="cursor-pointer mb-2"
                  onClick={() => {
                    postMessageToVsCode({
                      type: "openLog",
                      minionTaskId: minionTask.id,
                    });
                  }}
                >
                  Log file
                </span>

                <div className="mb-2">File:</div>

                <span className="mb-2">
                  <span
                    title="Open Document"
                    className="cursor-pointer"
                    onClick={() => {
                      postMessageToVsCode({
                        type: "openDocument",
                        minionTaskId: minionTask.id,
                      });
                    }}
                  >
                    {minionTask.documentName}
                  </span>

                  {minionTask.executionStage === FINISHED_STAGE_NAME && diffButton}
                </span>

                <div className="mb-2">Task:</div>

                <div className="mb-2 overflow-x-auto">
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
                    <div>
                      <span title="Edit task" onClick={() => setIsInputOpen(true)}>
                        {userQueryPreview}{" "}
                      </span>
                      {retryButton}
                    </div>
                  )}
                </div>

                {minionTask.selectedText && <div>Selection:</div>}
                {minionTask.selectedText && (
                  <div
                    className="text-xs overflow-auto"
                    style={{
                      whiteSpace: "pre",
                    }}
                  >
                    <pre>{minionTask.selectedText}</pre>
                  </div>
                )}
              </div>
              <div>
                {minionTask.classification === "AnswerQuestion" ? <pre style={{ whiteSpace: "pre-wrap" }}>{minionTask.modificationDescription}</pre> : <></>}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center">
          <div className="w-full" title="Task Progress">
            <ProgressBar execution={minionTask} />
          </div>
        </div>
      </div>
    );
  }
);

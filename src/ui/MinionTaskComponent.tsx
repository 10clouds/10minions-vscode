import { ChevronDownIcon, ChevronUpIcon, XMarkIcon } from "@heroicons/react/24/solid";
import * as React from "react";
import { forwardRef } from "react";
import { blendWithForeground, getBaseColor } from "../utils/blendColors";
import { ALL_MINION_ICONS_FILL } from "./MinionIconsFill";
import { APPLIED_STAGE_NAME, CANCELED_STAGE_NAME, FINISHED_STAGE_NAME, MinionTaskUIInfo } from "./MinionTaskUIInfo";
import { ProgressBar } from "./ProgressBar";
import { postMessageToVsCode } from "./SideBarWebViewInnerComponent";
import { MessageToVSCodeType } from "../Messages";
import { useUserQueryPreview } from "./useUserQueryPreview";
import { OutlineButton } from "./OutlineButton";

function adjustTextAreaHeight(target: HTMLTextAreaElement) {
  target.style.height = "auto";
  target.style.height = target.scrollHeight + "px";
}

// Constants
export const MAX_PREVIEW_LENGTH = 100;

export const MinionTaskComponent = forwardRef(
  ({ minionTask, ...props }: { minionTask: MinionTaskUIInfo } & React.HTMLAttributes<HTMLDivElement>, ref: React.ForwardedRef<HTMLDivElement>) => {
    const { className, ...propsWithoutClassName } = props;

    const userQueryPreview = useUserQueryPreview(minionTask.userQuery);
    const [isExpanded, setIsExpanded] = React.useState(false);

    // State variables for managing the input field state
    const [isInputOpen, setIsInputOpen] = React.useState(false);
    const [updatedPrompt, setUpdatedPrompt] = React.useState(minionTask.userQuery);

    React.useEffect(() => {
      if (!!minionTask.inlineMessage) {
        setIsExpanded(true);
      }
    }, [!!minionTask.inlineMessage]);

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
          type: MessageToVSCodeType.StopExecution,
          minionTaskId: minionTask.id,
        });

        // Retry the execution with the updated prompt
        postMessageToVsCode({
          type: MessageToVSCodeType.ReRunExecution,
          minionTaskId: minionTask.id,
          newUserQuery: updatedPrompt, // Pass the updated prompt value
        });
      }
    }

    let RobotIcon = ALL_MINION_ICONS_FILL[minionTask.minionIndex];

    const stopButton = (
      <OutlineButton
        className="mb-2 ml-2"
        title="Stop Execution"
        description="Stop"
        onClick={() => {
          postMessageToVsCode({
            type: MessageToVSCodeType.StopExecution,
            minionTaskId: minionTask.id,
          });
        }}
      />
    );

    const assessButton = (
      <OutlineButton
        className="mb-2 ml-2"
        title="Apply and Review"
        description="Apply"
        onClick={(e) => {
          postMessageToVsCode({
            type: MessageToVSCodeType.ApplyAndReviewTask,
            minionTaskId: minionTask.id,
            reapply: false,
          });
          setIsExpanded(true);
          e.stopPropagation();
        }}
      />
    );

    const markAsReadButton = (
      <OutlineButton
        className="mb-2 ml-2"
        title="Mark as read"
        description="Acknowledge"
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          postMessageToVsCode({
            type: MessageToVSCodeType.MarkAsApplied,
            minionTaskId: minionTask.id,
          });
          setIsExpanded(true);
          e.stopPropagation();
        }}
      />
    );

    const chevronButton = isExpanded ? <ChevronDownIcon className="h-6 w-6 min-w-min ml-2" /> : <ChevronUpIcon className="h-6 w-6 min-w-min ml-2" />;

    const closeButton = (
      <XMarkIcon
        title="Close Execution"
        onClick={(e) => {
          postMessageToVsCode({
            type: MessageToVSCodeType.CloseExecution,
            minionTaskId: minionTask.id,
          });
          e.stopPropagation();
        }}
        className="h-6 w-6 min-w-min cursor-pointer ml-2"
      />
    );

    const retryButton = (
      <OutlineButton
        title="Retry Execution"
        description="Retry"
        onClick={() => {
          postMessageToVsCode({
            type: MessageToVSCodeType.ReRunExecution,
            minionTaskId: minionTask.id,
          });
        }}
      />
    );

    const diffButton = (
      <OutlineButton
        title="Review changes since before application"
        description="Review"
        onClick={(e) => {
          postMessageToVsCode({
            type: MessageToVSCodeType.ShowDiff,
            minionTaskId: minionTask.id,
          });

          e.stopPropagation();
        }}
      />
    );

    const reapplyModificationButton = (
      <OutlineButton
        title="Reapply Modification"
        description="Reapply"
        onClick={() => {
          postMessageToVsCode({
            type: MessageToVSCodeType.ApplyAndReviewTask,
            minionTaskId: minionTask.id,
            reapply: true,
          });
        }}
      />
    );

    const openLogFileButton = (
      <OutlineButton
        title="Open Log"
        description="Open Log file"
        onClick={() => {
          postMessageToVsCode({
            type: MessageToVSCodeType.OpenLog,
            minionTaskId: minionTask.id,
          });
        }}
      />
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
        <div className="pt-3">
          <div
            className="flex justify-between cursor-pointer pl-3 pr-3 "
            title={!isExpanded ? "Click for more info" : "Click to hide"}
            onClick={() => {
              setIsExpanded(!isExpanded);
            }}
          >
            <div
              className={`w-6 h-6 mr-2 transition-color ${!minionTask.stopped ? "busy-robot" : ""} ${
                minionTask.executionStage === FINISHED_STAGE_NAME ? "motion-safe:animate-bounce" : ""
              } ${minionTask.isError ? "error-robot" : ""}`}
              style={{
                color: blendWithForeground(getBaseColor(minionTask)),
              }}
            >
              <RobotIcon className={`w-6 h-6 inline-flex ${!minionTask.stopped ? "busy-robot-extra" : ""}`} />
            </div>
            <div className="text-base font-semibold flex-grow flex-shrink truncate">
              <span className="truncate">{minionTask.shortName}</span>
            </div>
            {minionTask.modificationDescription &&
              minionTask.executionStage === FINISHED_STAGE_NAME &&
              (minionTask.modificationProcedure ? assessButton : markAsReadButton)}
            {(minionTask.executionStage === CANCELED_STAGE_NAME || minionTask.isError) && retryButton}

            {!minionTask.stopped ? stopButton : <> </>}
            {chevronButton}
            {closeButton}
          </div>

          {!isExpanded ? (
            <div className="pb-3" />
          ) : (
            <>
              <div className="pl-3 pr-3 pb-3">
                {minionTask.inlineMessage ? <pre style={{ whiteSpace: "pre-wrap" }}>{minionTask.inlineMessage}</pre> : <></>}
              </div>
              <div className="grid grid-cols-[auto,1fr] gap-x-4 mt-4 pb-3 pl-3 pr-3 overflow-auto">
                <div className="mb-2">Log:</div>
                <span className="mb-2">{openLogFileButton}</span>

                <div className="mb-2">File:</div>

                <span className="mb-2">
                  <span
                    title="Open Document"
                    className="cursor-pointer"
                    onClick={() => {
                      postMessageToVsCode({
                        type: MessageToVSCodeType.OpenDocument,
                        minionTaskId: minionTask.id,
                      });
                    }}
                  >
                    {minionTask.documentName} {minionTask.executionStage === APPLIED_STAGE_NAME && minionTask.modificationProcedure && diffButton}
                  </span>
                </span>

                <div className="mb-2">Status:</div>

                <span className="mb-2">
                  {minionTask.executionStage} {minionTask.executionStage === APPLIED_STAGE_NAME && reapplyModificationButton}
                </span>

                <div className="mb-2">Task:</div>

                <div className="mb-2">
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
                      {minionTask.stopped && retryButton}
                    </div>
                  )}
                </div>

                {minionTask.selectedText && <div>Selection:</div>}
                {minionTask.selectedText && (
                  <div
                    className="text-xs cursor-pointer"
                    onClick={() => {
                      postMessageToVsCode({
                        type: MessageToVSCodeType.OpenSelection,
                        minionTaskId: minionTask.id,
                      });
                    }}
                    style={{
                      whiteSpace: "pre",
                    }}
                  >
                    <pre>{minionTask.selectedText.includes("\n") ? minionTask.selectedText : minionTask.selectedText.trim()}</pre>
                  </div>
                )}
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

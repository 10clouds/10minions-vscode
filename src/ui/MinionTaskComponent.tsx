import React, { useEffect, useLayoutEffect, forwardRef } from 'react';
import { blendWithForeground, getBaseColor } from './utils/blendColors';
import { ALL_MINION_ICONS_FILL } from './MinionIconsFill';
import { MinionTaskUIInfo } from '10minions-engine/dist/managers/MinionTaskUIInfo';
import {
  APPLIED_STAGE_NAME,
  APPLYING_STAGE_NAME,
  CANCELED_STAGE_NAME,
  FINISHED_STAGE_NAME,
} from '10minions-engine/dist/const';
import { ProgressBar } from './ProgressBar';
import { postMessageToVsCode } from './SideBarWebViewInnerComponent';
import { MessageToVSCodeType } from '10minions-engine/dist/Messages';
import { useUserQueryPreview } from './useUserQueryPreview';
import {
  ApplyButton,
  ChevronButton,
  CloseButton,
  DiffButton,
  MarkAsReadButton,
  OpenLogFileButton,
  ReapplyModificationButton,
  RetryButton,
  StopButton,
} from './MinionTaskButtons';

// Constants
export const MAX_PREVIEW_LENGTH = 100;
const EDIT_TASK_TEXT_AREA_MIN_HEIGHT = 22;

function adjustTextAreaHeight(target: HTMLTextAreaElement) {
  const parent = target.parentElement;
  const textAreaHeight = target.scrollHeight;
  if (textAreaHeight > EDIT_TASK_TEXT_AREA_MIN_HEIGHT && parent) {
    parent.style.maxHeight = `${textAreaHeight}px`;
    target.style.height = `${textAreaHeight}px`;
    target.style.marginTop = '-1px';
  }
}

export const MinionTaskComponent = forwardRef(
  (
    {
      minionTask,
      ...props
    }: { minionTask: MinionTaskUIInfo } & React.HTMLAttributes<HTMLDivElement>,
    ref: React.ForwardedRef<HTMLDivElement>,
  ) => {
    const { className, ...propsWithoutClassName } = props;
    const {
      inlineMessage,
      userQuery,
      id: minionTaskId,
      minionIndex,
      stopped,
      executionStage,
      shortName,
      selectedText,
      modificationProcedure,
      isError,
      documentName,
    } = minionTask;
    const userQueryPreview = useUserQueryPreview(userQuery);
    const [isExpanded, setIsExpanded] = React.useState(false);

    // State variables for managing the input field state
    const [isInputOpen, setIsInputOpen] = React.useState(false);
    const [updatedPrompt, setUpdatedPrompt] = React.useState(userQuery);

    useEffect(() => {
      if (!!inlineMessage) {
        setIsExpanded(true);
      }
    }, [inlineMessage]);

    useEffect(() => {
      setUpdatedPrompt(userQuery);
    }, [userQuery]);

    useLayoutEffect(() => {
      if (isInputOpen) {
        const textAreaElement = document.querySelector<HTMLTextAreaElement>(
          '.execution textarea',
        );
        if (textAreaElement) {
          adjustTextAreaHeight(textAreaElement);
        }
      }
    }, [isInputOpen]);

    function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
      // Only call handleRun() when Enter key is pressed without Shift
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        setIsInputOpen(false);

        handleRun();
      }
    }

    function handleRun() {
      if (updatedPrompt !== userQuery) {
        // Stop the current execution
        postMessageToVsCode({
          type: MessageToVSCodeType.StopExecution,
          minionTaskId,
        });

        // Retry the execution with the updated prompt
        postMessageToVsCode({
          type: MessageToVSCodeType.ReRunExecution,
          minionTaskId,
          newUserQuery: updatedPrompt, // Pass the updated prompt value
        });
      }
    }

    const RobotIcon = ALL_MINION_ICONS_FILL[minionIndex];

    const moveToSelection = () => {
      postMessageToVsCode({
        type: MessageToVSCodeType.OpenSelection,
        minionTaskId,
      });
    };

    const recalculateTextAreaHeight = (
      event: React.FormEvent<HTMLTextAreaElement>,
    ) => adjustTextAreaHeight(event.target as HTMLTextAreaElement);

    const handleTextAreaBlur = () => {
      setIsInputOpen(false);
      handleRun();
    };

    const minionTaskColor = blendWithForeground(getBaseColor(minionTask));
    const isRobotBusy = !stopped || executionStage === APPLYING_STAGE_NAME;
    const isFinishedStage = executionStage === FINISHED_STAGE_NAME;
    return (
      <div
        ref={ref}
        style={{
          backgroundColor: 'var(--vscode-editor-background)',
          color: 'var(--vscode-editor-foreground)',
          borderColor: 'var(--vscode-focusBorder)',
        }}
        key={minionTaskId}
        className={`execution mb-4 overflow-hidden rounded flex flex-col ${className}`}
        {...propsWithoutClassName}
      >
        <div className="pt-3">
          <div
            className="flex justify-between cursor-pointer pl-3 pr-3 "
            title={!isExpanded ? 'Click for more info' : 'Click to hide'}
            onClick={() => {
              setIsExpanded(!isExpanded);
            }}
          >
            <div
              className={`w-6 h-6 mr-2 transition-color ${
                isRobotBusy ? 'busy-robot' : ''
              } ${isFinishedStage ? 'motion-safe:animate-bounce' : ''} ${
                isError ? 'error-robot' : ''
              }`}
              style={{
                color: minionTaskColor,
              }}
            >
              <RobotIcon
                className={`w-6 h-6 inline-flex ${
                  isRobotBusy ? 'busy-robot-extra' : ''
                }`}
              />
            </div>
            <div className="text-base font-semibold flex-grow flex-shrink truncate">
              <span className="truncate">{shortName}</span>
            </div>
            {inlineMessage && isFinishedStage && (
              <MarkAsReadButton
                minionTaskId={minionTaskId}
                setIsExpanded={setIsExpanded}
              />
            )}
            {modificationProcedure && isFinishedStage && (
              <ApplyButton
                minionTaskId={minionTaskId}
                setIsExpanded={setIsExpanded}
              />
            )}
            {(executionStage === CANCELED_STAGE_NAME || isError) && (
              <RetryButton minionTaskId={minionTaskId} />
            )}

            {!stopped ? <StopButton minionTaskId={minionTaskId} /> : null}
            <ChevronButton isExpanded={isExpanded} />
            <CloseButton minionTaskId={minionTaskId} />
          </div>

          {!isExpanded ? (
            <div className="pb-3" />
          ) : (
            <>
              <div className="pl-3 pr-3 pb-3">
                {inlineMessage ? (
                  <pre style={{ whiteSpace: 'pre-wrap' }}>{inlineMessage}</pre>
                ) : (
                  <></>
                )}
              </div>
              <div className="grid grid-cols-[auto,1fr] gap-x-4 mt-4 pb-3 pl-3 pr-3 overflow-auto">
                <div className="mb-2">Log:</div>
                <span className="mb-2">
                  <OpenLogFileButton minionTaskId={minionTaskId} />
                </span>

                <div className="mb-2">File:</div>

                <span className="mb-2">
                  <span
                    title="Open Document"
                    className="cursor-pointer"
                    onClick={() => {
                      postMessageToVsCode({
                        type: MessageToVSCodeType.OpenDocument,
                        minionTaskId,
                      });
                    }}
                  >
                    {documentName}{' '}
                    {executionStage === APPLIED_STAGE_NAME &&
                      modificationProcedure && (
                        <DiffButton minionTaskId={minionTaskId} />
                      )}
                  </span>
                </span>

                <div className="mb-2">Status:</div>

                <span className="mb-2">
                  {executionStage}{' '}
                  {executionStage === APPLIED_STAGE_NAME && (
                    <ReapplyModificationButton minionTaskId={minionTaskId} />
                  )}
                </span>

                <div className="mb-2">Task:</div>

                <div
                  style={{ minHeight: `${EDIT_TASK_TEXT_AREA_MIN_HEIGHT}px` }}
                >
                  {isInputOpen ? (
                    <textarea
                      style={{
                        backgroundColor: 'inherit',
                        color: 'inherit',
                        outline: 'none',
                        width: '100%', // Make it span the entire line
                        resize: 'none', // Disable the resizing of the textarea
                        margin: 0,
                        padding: 0,
                        minHeight: `${EDIT_TASK_TEXT_AREA_MIN_HEIGHT}px`,
                        lineHeight: '20.5px',
                        height: `${EDIT_TASK_TEXT_AREA_MIN_HEIGHT}px`,
                        border: 'none',
                      }}
                      value={updatedPrompt}
                      onChange={(event) => setUpdatedPrompt(event.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={handleTextAreaBlur}
                      onFocus={recalculateTextAreaHeight}
                      autoFocus
                      onInput={recalculateTextAreaHeight}
                    />
                  ) : (
                    // Wrap the userQueryPreview inside a div with the same line-height as the textarea
                    // Apply required padding and margin in this div
                    <>
                      <div
                        title="Edit task"
                        style={{
                          minHeight: `${EDIT_TASK_TEXT_AREA_MIN_HEIGHT}px`,
                        }}
                        onClick={() => setIsInputOpen(true)}
                      >
                        {userQueryPreview}{' '}
                        {stopped && <RetryButton minionTaskId={minionTaskId} />}
                      </div>
                    </>
                  )}
                </div>

                {selectedText && <div>Selection:</div>}
                {selectedText && (
                  <div
                    className="text-xs cursor-pointer"
                    onClick={moveToSelection}
                    style={{
                      whiteSpace: 'pre',
                    }}
                  >
                    <pre>
                      {selectedText.includes('\n')
                        ? selectedText
                        : selectedText.trim()}
                    </pre>
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
  },
);

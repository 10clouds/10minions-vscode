import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  EDIT_TASK_TEXT_AREA_MIN_HEIGHT,
  adjustTextAreaHeight,
} from './utils/adjustTextAreaHeight';
import { useUserQueryPreview } from './useUserQueryPreview';
import { postMessageToVsCode } from './utils/postMessageToVsCode';
import { MessageToVSCodeType } from '10minions-engine/dist/src/managers/Messages';
import { RetryButton } from './MinionTaskButtons';

const textAreaStyles: React.CSSProperties = {
  backgroundColor: 'inherit',
  color: 'inherit',
  outline: 'none',
  width: '100%',
  resize: 'none',
  margin: 0,
  padding: 0,
  minHeight: `${EDIT_TASK_TEXT_AREA_MIN_HEIGHT}px`,
  lineHeight: '20.5px',
  height: `${EDIT_TASK_TEXT_AREA_MIN_HEIGHT}px`,
  border: 'none',
};

interface MinionTaskSelectionProps {
  minionTaskId: string;
  userQuery: string;
  stopped: boolean;
}

const MinionTaskSelection = ({
  minionTaskId,
  userQuery,
  stopped,
}: MinionTaskSelectionProps) => {
  const userQueryPreview = useUserQueryPreview(userQuery);
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [updatedPrompt, setUpdatedPrompt] = useState(userQuery);

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
        type: MessageToVSCodeType.STOP_EXECUTION,
        minionTaskId,
      });

      // Retry the execution with the updated prompt
      postMessageToVsCode({
        type: MessageToVSCodeType.RERUN_EXECUTION,
        minionTaskId,
        newUserQuery: updatedPrompt, // Pass the updated prompt value
      });
    }
  }

  const recalculateTextAreaHeight = (
    event: React.FormEvent<HTMLTextAreaElement>,
  ) => adjustTextAreaHeight(event.target as HTMLTextAreaElement);

  const handleTextAreaBlur = () => {
    setIsInputOpen(false);
    handleRun();
  };

  return (
    <>
      <div className="mb-2">Task:</div>
      <div style={{ minHeight: `${EDIT_TASK_TEXT_AREA_MIN_HEIGHT}px` }}>
        {isInputOpen ? (
          <textarea
            style={textAreaStyles}
            value={updatedPrompt}
            onChange={(event) => setUpdatedPrompt(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleTextAreaBlur}
            onFocus={recalculateTextAreaHeight}
            autoFocus
            onInput={recalculateTextAreaHeight}
          />
        ) : (
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
        )}
      </div>
    </>
  );
};

export default MinionTaskSelection;

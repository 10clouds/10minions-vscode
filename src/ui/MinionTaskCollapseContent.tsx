import React from 'react';
import { APPLIED_STAGE_NAME } from '10minions-engine/dist/src/tasks/stageNames';
import {
  DiffButton,
  OpenLogFileButton,
  ReapplyModificationButton,
} from './MinionTaskButtons';
import { MessageToVSCodeType } from '10minions-engine/dist/src/managers/Messages';
import { postMessageToVsCode } from './utils/postMessageToVsCode';
import { MinionTaskUIInfo } from '10minions-engine/dist/src/managers/MinionTaskUIInfo';
import MinionTaskSelection from './MinionTaskSelection';
import MinionTaskTextField from './MinionTaskTextField';

const openDocument = (minionTaskId: string) => () => {
  postMessageToVsCode({
    type: MessageToVSCodeType.OPEN_DOCUMENT,
    minionTaskId,
  });
};

interface MinionTaskCollapseContentProps {
  minionTask: MinionTaskUIInfo;
}

const MinionTaskCollapseContent = ({
  minionTask,
}: MinionTaskCollapseContentProps) => {
  const {
    inlineMessage,
    userQuery,
    id: minionTaskId,
    stopped,
    executionStage,
    selectedText,
    modificationProcedure,
    documentName,
  } = minionTask;

  return (
    <>
      <div className="pl-3 pr-3 pb-3">
        {inlineMessage ? (
          <pre style={{ whiteSpace: 'pre-wrap' }}>{inlineMessage}</pre>
        ) : null}
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
            onClick={openDocument(minionTaskId)}
          >
            {documentName}{' '}
            {executionStage === APPLIED_STAGE_NAME && modificationProcedure && (
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
        <MinionTaskTextField
          minionTaskId={minionTaskId}
          userQuery={userQuery}
          stopped={stopped}
        />
        {selectedText && (
          <MinionTaskSelection
            minionTaskId={minionTaskId}
            selectedText={selectedText}
          />
        )}
      </div>
    </>
  );
};

export default MinionTaskCollapseContent;

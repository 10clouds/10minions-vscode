import React from 'react';
import { MessageToVSCodeType } from '10minions-engine/dist/src/managers/Messages';
import { postMessageToVsCode } from './utils/postMessageToVsCode';

const moveToSelection = (minionTaskId: string) => () => {
  postMessageToVsCode({
    type: MessageToVSCodeType.OPEN_SELECTION,
    minionTaskId,
  });
};

interface MinionTaskSelectionProps {
  minionTaskId: string;
  selectedText: string;
}

const MinionTaskSelection = ({
  minionTaskId,
  selectedText,
}: MinionTaskSelectionProps) => (
  <>
    <div>Selection:</div>
    <div
      className="text-xs cursor-pointer"
      onClick={moveToSelection(minionTaskId)}
      style={{
        whiteSpace: 'pre',
      }}
    >
      <pre>
        {selectedText.includes('\n') ? selectedText : selectedText.trim()}
      </pre>
    </div>
  </>
);

export default MinionTaskSelection;

import React from 'react';
import { MessageToVSCodeType } from '10minions-engine/dist/src/managers/Messages';
import { OutlineButton } from './OutlineButton';
import ChevronDownIcon from '@heroicons/react/24/solid/ChevronDownIcon';
import ChevronUpIcon from '@heroicons/react/24/solid/ChevronUpIcon';
import XMarkIcon from '@heroicons/react/24/solid/XMarkIcon';
import { postMessageToVsCode } from './utils/postMessageToVsCode';

interface MinionTaskButtonProps {
  minionTaskId: string;
  setIsExpanded?: (value: React.SetStateAction<boolean>) => void;
}

export const StopButton = ({ minionTaskId }: MinionTaskButtonProps) => (
  <OutlineButton
    className="mb-2 ml-2"
    title="Stop Execution"
    description="Stop"
    onClick={() => {
      postMessageToVsCode({
        type: MessageToVSCodeType.STOP_EXECUTION,
        minionTaskId,
      });
    }}
  />
);

export const ApplyButton = ({
  minionTaskId,
  setIsExpanded,
}: MinionTaskButtonProps) => (
  <OutlineButton
    className="mb-2 ml-2"
    title="Apply and Review"
    description="Apply"
    onClick={(e) => {
      postMessageToVsCode({
        type: MessageToVSCodeType.APPLY_AND_REVIEW_TASK,
        minionTaskId,
        reapply: false,
      });
      setIsExpanded?.(true);
      e.stopPropagation();
    }}
  />
);

export const MarkAsReadButton = ({
  minionTaskId,
  setIsExpanded,
}: MinionTaskButtonProps) => (
  <OutlineButton
    className="mb-2 ml-2"
    title="Mark as read"
    description="Acknowledge"
    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
      postMessageToVsCode({
        type: MessageToVSCodeType.MARK_AS_APPLIED,
        minionTaskId,
      });
      setIsExpanded?.(true);
      e.stopPropagation();
    }}
  />
);

export const ChevronButton = ({ isExpanded }: { isExpanded: boolean }) =>
  isExpanded ? (
    <ChevronDownIcon className="h-6 w-6 min-w-min ml-2" />
  ) : (
    <ChevronUpIcon className="h-6 w-6 min-w-min ml-2" />
  );

export const CloseButton = ({ minionTaskId }: MinionTaskButtonProps) => (
  <XMarkIcon
    title="Close Execution"
    onClick={(e) => {
      postMessageToVsCode({
        type: MessageToVSCodeType.CLOSE_EXECUTION,
        minionTaskId,
      });
      e.stopPropagation();
    }}
    className="h-6 w-6 min-w-min cursor-pointer ml-2"
  />
);

export const RetryButton = ({ minionTaskId }: MinionTaskButtonProps) => (
  <OutlineButton
    title="Retry Execution"
    description="Retry"
    onClick={() => {
      postMessageToVsCode({
        type: MessageToVSCodeType.RERUN_EXECUTION,
        minionTaskId,
      });
    }}
  />
);

export const DiffButton = ({ minionTaskId }: MinionTaskButtonProps) => (
  <OutlineButton
    title="Review changes since before application"
    description="Review"
    onClick={(e) => {
      postMessageToVsCode({
        type: MessageToVSCodeType.SHOW_DIFF,
        minionTaskId,
      });

      e.stopPropagation();
    }}
  />
);

export const ReapplyModificationButton = ({
  minionTaskId,
}: MinionTaskButtonProps) => (
  <OutlineButton
    title="Reapply Modification"
    description="Reapply"
    onClick={() => {
      postMessageToVsCode({
        type: MessageToVSCodeType.APPLY_AND_REVIEW_TASK,
        minionTaskId,
        reapply: true,
      });
    }}
  />
);

export const OpenLogFileButton = ({ minionTaskId }: MinionTaskButtonProps) => (
  <OutlineButton
    title="Open Log"
    description="Open Log file"
    onClick={() => {
      postMessageToVsCode({
        type: MessageToVSCodeType.OPEN_LOG,
        minionTaskId,
      });
    }}
  />
);

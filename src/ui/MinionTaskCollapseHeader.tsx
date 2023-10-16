import React from 'react';
import clsx from 'clsx';
import { ALL_MINION_ICONS_FILL } from '../constants';
import {
  APPLYING_STAGE_NAME,
  CANCELED_STAGE_NAME,
  FINISHED_STAGE_NAME,
} from '10minions-engine/dist/src/tasks/stageNames';
import {
  ApplyButton,
  ChevronButton,
  CloseButton,
  MarkAsReadButton,
  RetryButton,
  StopButton,
} from './MinionTaskButtons';
import { blendWithForeground, getBaseColor } from './utils/blendColors';
import { MinionTaskUIInfo } from '10minions-engine/dist/src/managers/MinionTaskUIInfo';

interface MinionTaskCollapseHeaderProps {
  isExpanded: boolean;
  setIsExpanded: (value: React.SetStateAction<boolean>) => void;
  minionTask: MinionTaskUIInfo;
}

const MinionTaskCollapseHeader = ({
  minionTask,
  isExpanded,
  setIsExpanded,
}: MinionTaskCollapseHeaderProps) => {
  const {
    inlineMessage,
    id: minionTaskId,
    minionIndex,
    stopped,
    executionStage,
    shortName,
    modificationProcedure,
    isError,
  } = minionTask;
  const RobotIcon = ALL_MINION_ICONS_FILL[minionIndex];
  const minionTaskColor = blendWithForeground(getBaseColor(minionTask));
  const isRobotBusy = !stopped || executionStage === APPLYING_STAGE_NAME;
  const isFinishedStage = executionStage === FINISHED_STAGE_NAME;

  const toggle = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div
      className="flex justify-between cursor-pointer pl-3 pr-3 "
      title={isExpanded ? 'Click to hide' : 'Click for more info'}
      onClick={toggle}
    >
      <div
        className={clsx('w-6 h-6 mr-2 transition-color ', {
          'busy-robot': isRobotBusy,
          'motion-safe:animate-bounce': isFinishedStage,
          'error-robot': isError,
        })}
        style={{
          color: minionTaskColor,
        }}
      >
        <RobotIcon
          className={clsx('w-6 h-6 inline-flex', {
            'busy-robot-extra': isRobotBusy,
          })}
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
  );
};

export default MinionTaskCollapseHeader;

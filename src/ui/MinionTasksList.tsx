import React from 'react';
import FlipMove from 'react-flip-move';
import { MinionTaskListItem } from './MinionTaskListItem';
import { MinionTaskUIInfo } from '10minions-engine/dist/src/managers/MinionTaskUIInfo';

export const MinionTasksList = ({
  executionList,
}: {
  executionList: MinionTaskUIInfo[];
}) => {
  return (
    <FlipMove
      enterAnimation={{
        from: {
          transform: 'translateY(-10%)',
          animationTimingFunction: 'cubic-bezier(0.8, 0, 1, 1)',
          opacity: '0.1',
        },
        to: {
          transform: 'translateY(0)',
          animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)',
          opacity: '1',
        },
      }}
      leaveAnimation={{
        from: {
          transform: 'translateY(0)',
          animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)',
          opacity: '1',
        },
        to: {
          transform: 'translateY(-10%)',
          animationTimingFunction: 'cubic-bezier(0.8, 0, 1, 1)',
          opacity: '0.1',
        },
      }}
    >
      {executionList.length === 0 && (
        <div key="no-minions" className="text-center">
          No minions are active.
        </div>
      )}

      {executionList.map((execution) => (
        <MinionTaskListItem key={execution.id} minionTask={execution} />
      ))}
    </FlipMove>
  );
};

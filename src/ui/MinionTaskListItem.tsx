import React, { useEffect, forwardRef, useState, useMemo } from 'react';
import { MinionTaskUIInfo } from '10minions-engine/dist/src/managers/MinionTaskUIInfo';
import { ProgressBar } from './ProgressBar';
import MinionTaskCollapseContent from './MinionTaskCollapseContent';
import MinionTaskCollapseHeader from './MinionTaskCollapseHeader';
import {
  blendWithForeground,
  getBaseColor,
  getOpacity,
} from './utils/blendColors';

export const MAX_PREVIEW_LENGTH = 100;

export const MinionTaskListItem = forwardRef(
  (
    {
      minionTask,
      ...props
    }: { minionTask: MinionTaskUIInfo } & React.HTMLAttributes<HTMLDivElement>,
    ref: React.ForwardedRef<HTMLDivElement>,
  ) => {
    const { className, ...propsWithoutClassName } = props;
    const { inlineMessage, id: minionTaskId } = minionTask;
    const [isExpanded, setIsExpanded] = useState(false);
    const opacity = useMemo(() => getOpacity(minionTask), [minionTask]);
    const color = useMemo(
      () => blendWithForeground(getBaseColor(minionTask)),
      [minionTask],
    );

    useEffect(() => {
      if (inlineMessage) {
        setIsExpanded(true);
      }
    }, [inlineMessage]);

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
          <MinionTaskCollapseHeader
            minionTask={minionTask}
            setIsExpanded={setIsExpanded}
            isExpanded={isExpanded}
          />
          {isExpanded ? (
            <MinionTaskCollapseContent minionTask={minionTask} />
          ) : (
            <div className="pb-3" />
          )}
        </div>
        <div className="flex items-center">
          <div className="w-full" title="Task Progress">
            <ProgressBar
              progress={minionTask.progress}
              stopped={minionTask.stopped}
              opacity={opacity}
              color={color}
            />
          </div>
        </div>
      </div>
    );
  },
);

MinionTaskListItem.displayName = 'MinionTaskListItem';

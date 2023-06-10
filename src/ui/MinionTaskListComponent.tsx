import * as React from "react";
import FlipMove from "react-flip-move";
import { MinionTaskComponent } from "./MinionTaskComponent";
import { ExecutionInfo } from "./ExecutionInfo";


export function MinionTaskListComponent({ executionList }: { executionList: ExecutionInfo[]; }) {
  return (
    <FlipMove
      enterAnimation={{
        from: {
          transform: "translateY(-10%)",
          animationTimingFunction: "cubic-bezier(0.8, 0, 1, 1)",
          opacity: "0.1",
        },
        to: {
          transform: "translateY(0)",
          animationTimingFunction: "cubic-bezier(0, 0, 0.2, 1)",
          opacity: "1",
        },
      }}
      leaveAnimation="elevator"
    >
      {executionList.length === 0 && (
        <div key="no-minions" className="text-center">
          No minions are active.
        </div>
      )}

      {executionList.map((execution) => (
        <MinionTaskComponent key={execution.id} execution={execution} />
      ))}
    </FlipMove>
  );
}

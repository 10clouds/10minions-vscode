import { stageStarting } from "./pre/stageStarting";
import { stageClassifyTask } from "./pre/stageClassifyTask";
import { stageExtractRelevantCode } from "./workspace/3_stageExtractRelevantCode";
import { stageCreateModificationProcedure } from "./simpleedit/4_stageCreateModificationProcedure";
import { stageFinishing } from "./common/stageFinishing";
import { stageCreateModification } from "./simpleedit/3_stageCreateCodeEdit";

export type TASK_STRATEGY_ID =
  | "AnswerQuestion"
  | "AutonomousAgent"
  | "VectorizeAndExecute"
  | "WorkspaceWide"
  | "CodeChange";

/**
 * Interface representing a stage in the process.
 * Each stage contains a name, weight, execution function, and a disabled flag.
 */
export interface Stage {
  name: string;
  weight: number;
  execution: () => void;
}

export const PRE_STAGES: Stage[] = [
  {
    name: "Starting ...",
    weight: 10,
    execution: stageStarting,
  },
  {
    name: "Understanding ...",
    weight: 50,
    execution: stageClassifyTask,
  },
];

export const TASK_STRATEGIES: {
  name: TASK_STRATEGY_ID;
  description: string;
  stages: Stage[];
}[] = [
  {
    name: "AutonomousAgent",
    description:
      "Choose this classification if you don't want to modify code when doing this task or it's not appropriate to modifiy code based on this task. The result is not code, but textual description. A good example of this is when you are asked a question, and you need to answer it. For example: For example: are strings immutable in java? explain how this works, come up with 5 ideas for a name etc.",
    stages: [
      {
        name: "Extracting ...",
        weight: 100,
        execution: stageExtractRelevantCode,
      },
      {
        name: "Finishing ...",
        weight: 10,
        execution: stageFinishing,
      },
    ],
  },
  {
    name: "VectorizeAndExecute",
    description:
      "Choose this classification if you don't want to modify code when doing this task or it's not appropriate to modifiy code based on this task. The result is not code, but textual description. A good example of this is when you are asked a question, and you need to answer it. For example: For example: are strings immutable in java? explain how this works, come up with 5 ideas for a name etc.",
    stages: [
      {
        name: "Extracting ...",
        weight: 100,
        execution: stageExtractRelevantCode,
      },
      {
        name: "Finishing ...",
        weight: 10,
        execution: stageFinishing,
      },
    ],
  },
  {
    name: "WorkspaceWide",
    description:
      "Choose this classification if you don't want to modify code when doing this task or it's not appropriate to modifiy code based on this task. The result is not code, but textual description. A good example of this is when you are asked a question, and you need to answer it. For example: For example: are strings immutable in java? explain how this works, come up with 5 ideas for a name etc.",
    stages: [
      {
        name: "Extracting ...",
        weight: 100,
        execution: stageExtractRelevantCode,
      },
      {
        name: "Finishing ...",
        weight: 10,
        execution: stageFinishing,
      },
    ],
  },
  {
    name: "AnswerQuestion",
    description:
      "Choose this classification if you don't want to modify code when doing this task or it's not appropriate to modifiy code based on this task. The result is not code, but textual description. A good example of this is when you are asked a question, and you need to answer it. For example: For example: are strings immutable in java? explain how this works, come up with 5 ideas for a name etc.",
    stages: [
      {
        name: "Conceptualising ...",
        weight: 100,
        execution: stageCreateModification,
      },
      {
        name: "Finishing ...",
        weight: 10,
        execution: stageFinishing,
      },
    ],
  },
  {
    name: "CodeChange",
    description:
      "Choose if it's makes sense to modify code for this task. For example: fix a bug, add a feature, add a test, are there any bugs?, critisize this code, refactor this code, document this code etc.",
    stages: [
      {
        name: "Conceptualising ...",
        weight: 100,
        execution: stageCreateModification,
      },
      {
        name: "Preparing Changes ...",
        weight: 80,
        execution: stageCreateModificationProcedure,
      },
      {
        name: "Finishing ...",
        weight: 10,
        execution: stageFinishing,
      },
    ],
  },
];

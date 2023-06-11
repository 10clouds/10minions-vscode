import { stageStarting } from "./1_stageStarting";
import { stageClassifyTask } from "./2_stageClassifyTask";
import { stageCreateModification } from "./3_stageCreateModification";
import { stageCreateModificationProcedure } from "./4_stageCreateModificationProcedure";
import { stageFinishing } from "./7_stageFinishing";

/**
 * Interface representing a stage in the process.
 * Each stage contains a name, weight, execution function, and a disabled flag.
 */
interface Stage {
  name: string;
  weight: number;
  execution: () => void;
}

export const STAGES: Stage[] = [
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
];

export const TOTAL_WEIGHTS = STAGES.reduce((acc, stage) => {
  return acc + stage.weight;
}, 0);
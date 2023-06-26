import path from "path";
import fs from "fs";
import { initCLISystems, setupCLISystemsForTest } from "../CLI/setupCLISystems";
import { MinionTask } from "../MinionTask";
import { getEditorManager } from "../managers/EditorManager";
import { applyMinionTask } from "../strategies/utils/applyMinionTask";
import { GptMode, gptExecute } from "../openai";

function logToFile(logMessage: string, logType: "log" | "error" = "log") {
  const directoryPath = path.join(__dirname, "logs");
  const filePath = path.join(directoryPath, `${logType}.log`);

  // Check if logs directory exist or not
  if (!fs.existsSync(directoryPath)) { 
    fs.mkdirSync(directoryPath); // If logs directory does not exist, create it
  }

  // If the file does not exist, create it, else append to it. `writeFileSync` and `appendFileSync` both create the file if it doesn't exist.
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, logMessage + "\n");
  } else {
    fs.appendFileSync(filePath, logMessage + "\n");
  }
}

async function gptAssert({
  originalCode,
  resultingCode,
  mode = "FAST",
  assertion,
}: {
  originalCode: string;
  resultingCode: string;
  mode?: GptMode;
  assertion: string;
}) {
  let response = await gptExecute({
    fullPrompt: `Original code:\n${originalCode}\n\nResulting code:\n${resultingCode}\n\nPlease analyse the resulting code and answer: does the resulting code passess this test: "${assertion}"\n\n`,
    maxTokens: 100,
    mode,
    outputType: {
      name: "reportTestResult",
      description: `Report a result of the test, whanever the resulting code meets the criteria: ${assertion}, provide a comment explaining why it does not meet the criteria`,
      parameters: {
        type: "object",
        properties: {
          comment: { type: "string", description: "Desribe the reason for why the code passed (or did not pass) the test." },
          passessTest: { type: "boolean" },
        },
        required: ["passessTest", "comment"],
      },
    },
  });

  let { passessTest, comment } = JSON.parse(response.result);

  return {
    passessTest,
    comment,
  };
}

export type TestDefinition = { type: "gptAssert"; mode: GptMode; assertion: string } | { type: "simpleStringFind"; stringToFind: string };

async function runTest({ fileName, iterations = 5 }: { fileName: string, iterations?: number  }) {
  let tests: TestDefinition[] = require(path.join(__dirname, "score", fileName + ".tests.json"));
  let userQuery = fs.readFileSync(path.join(__dirname, "score", fileName + ".userQuery.txt"), "utf8");

  let statistics = {
    total: 0,
    passed: 0,
  };

  for (let i = 0; i < iterations; i++) {

    setupCLISystemsForTest();

    console.log(`Iteration ${i + 1} of ${iterations}`);
    
    const execution = await MinionTask.create({
      userQuery,
      document: await getEditorManager().openTextDocument(getEditorManager().createUri(path.join(__dirname, "score", fileName))),
      selection: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
      selectedText: "",
      minionIndex: 0,
      onChanged: async (important) => {
        logToFile(".");
      },
    });

    await execution.run();
    await applyMinionTask(execution);

    let resultingCode = (await execution.document()).getText();

    logToFile("File contents");
    logToFile(resultingCode);

    for (let test of tests) {
      statistics.total++;

      if (test.type === "gptAssert") {
        let { passessTest, comment } = await gptAssert({ originalCode: execution.originalContent, resultingCode, assertion: test.assertion });
        logToFile(`Test: ${test.assertion}`);

        if (!passessTest) {
          logToFile(`Test failed: ${test.assertion}`);
          logToFile(`Comment: ${comment}`);
        } else {
          statistics.passed++;
        }
      } else if (test.type === "simpleStringFind") {
        let passessTest = resultingCode.includes(test.stringToFind);
        logToFile(`Test: ${test.stringToFind}`);

        if (!passessTest) {
          logToFile(`Test failed: ${test.stringToFind}`);
        } else {
          statistics.passed++;
        }
      }
    }
  }

  console.log(`Test summary for '${fileName}' (over ${iterations} iterations)\n Total: ${statistics.total}\nPassed: ${statistics.passed}\nFailed: ${statistics.total - statistics.passed}`);
}

async function runScoring(): Promise<void> {
  console.log("Running tests...");
  
  logToFile("\n\nRunning tests...\n\n");

  initCLISystems();

  await runTest({fileName: "code-review.js"});
  await runTest({fileName: "ConsumingOpenAICacheManager.ts"});

  console.log("Done!");
}

runScoring();

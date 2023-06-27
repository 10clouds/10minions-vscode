import * as glob from "glob";
import path from "path";
import fs from "fs";
import { initCLISystems, setupCLISystemsForTest } from "../CLI/setupCLISystems";
import { MinionTask } from "../MinionTask";
import { getEditorManager } from "../managers/EditorManager";
import { applyMinionTask } from "../strategies/utils/applyMinionTask";
import { GptMode, gptExecute } from "../openai";
import * as ts from "typescript";
import { Validator } from "jsonschema"; // Imported the jsonschema library

export type TestDefinition =
  | { type: "gptAssert"; mode: GptMode; assertion: string }
  | { type: "simpleStringFind"; stringToFind: string }
  | { type: "functionReturnTypeCheck"; functionName: string; expectedType: string };

const gptAssertSchema = {
  properties: {
    type: { type: "string", pattern: "gptAssert" },
    mode: { type: "string" },
    assertion: { type: "string" },
  },
  required: ["type", "mode", "assertion"],
};

const simpleStringFindSchema = {
  properties: {
    type: { type: "string", pattern: "simpleStringFind" },
    stringToFind: { type: "string" },
  },
  required: ["type", "stringToFind"],
};

const functionReturnTypeCheckSchema = {
  properties: {
    type: { type: "string", pattern: "functionReturnTypeCheck" },
    functionName: { type: "string" },
    expectedType: { type: "string" },
  },
  required: ["type", "functionName", "expectedType"],
};

const TestDefinitionSchema = {
  id: "/TestDefinition",
  oneOf: [gptAssertSchema, simpleStringFindSchema, functionReturnTypeCheckSchema],
};

async function checkFunctionReturnType({ code, functionName }: { code: string; functionName: string }): Promise<string> {
  try {
    // Create and compile program
    // Create an in-memory source file
    const sourceFile = ts.createSourceFile("temp.ts", code, ts.ScriptTarget.ES2015, true);

    // Create an in-memory compiler host
    const compilerHost: ts.CompilerHost = {
      ...ts.createCompilerHost({}),
      getSourceFile: (fileName, languageVersion) => fileName === 'temp.ts' ? sourceFile : undefined,
      readFile: (fileName) => fileName === 'temp.ts' ? code : undefined,
    };

    // Create and compile program with the in-memory compiler host
    const program = ts.createProgram(["temp.ts"], {}, compilerHost);
    const checker = program.getTypeChecker();

    // Helper function to search the AST nodes for a function declaration
    function findFunctionDeclaration(node: ts.Node, functionName: string): ts.FunctionDeclaration | undefined {
      
      if (ts.isFunctionDeclaration(node) && node.name && node.name.text === functionName) {
        return node;
      }

      let functionDecl: ts.FunctionDeclaration | undefined;
      ts.forEachChild(node, (childNode) => {
        if (functionDecl) return;
        functionDecl = findFunctionDeclaration(childNode, functionName);
      });

      return functionDecl;
    }
 
    // Find function declaration
    const funcDecl = findFunctionDeclaration(sourceFile, functionName);


    if (!funcDecl?.name) {
      throw new Error(`Function '${functionName}' not found in code.`);
    }

    const funcSym = checker.getSymbolAtLocation(funcDecl?.name);

    if (!funcSym || !funcSym.valueDeclaration) {
      throw new Error(`Symbol not found for function '${functionName}'. Ensure the function exists and is correctly spelled.`);
    }

    const typeOfFuncSym = checker.getTypeOfSymbolAtLocation(funcSym, funcSym.valueDeclaration);

    const returnType = checker.getReturnTypeOfSignature(typeOfFuncSym.getCallSignatures()[0]);

    return checker.typeToString(returnType);
  } catch (error) {
    logToFile(`Error during return type check: ${error instanceof Error ? error.message : error}`);

    return "Error during return type check";
  }
}

const directoryPath = path.join(__dirname, "logs");
// Added the Date object to get the current date and time and formatted it as per requirement (YYYY-MM-DD_HH-MM-SS).
const current_date = new Date();
const date_string = `${current_date.getFullYear()}-${("00" + (current_date.getMonth() + 1)).slice(-2)}-${("00" + current_date.getDate()).slice(-2)}_${("00" + current_date.getHours()).slice(-2)}-${("00" + current_date.getMinutes()).slice(-2)}-${("00" + current_date.getSeconds()).slice(-2)}`;

// Concatenating date_string with the filename to include the current date and time in the filename.
const logFilePath = path.join(directoryPath, `log_${date_string}.log`);

function logToFile(logMessage: string) {
  
  // Check if logs directory exist or not
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath); // If logs directory does not exist, create it
  }

  // If the file does not exist, create it, else append to it. `writeFileSync` and `appendFileSync` both create the file if it doesn't exist.
  if (!fs.existsSync(logFilePath)) {
    fs.writeFileSync(logFilePath, logMessage + "\n");
  } else {
    fs.appendFileSync(logFilePath, logMessage + "\n");
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

async function runTest({ fileName, iterations = 10 }: { fileName: string; iterations?: number }) {
  let tests: TestDefinition[] = require(path.join(__dirname, "score", fileName + ".tests.json"));

  // Create a validator instance
  const validator = new Validator();

  // Validate each test in the tests array against the TestDefinitionSchema
  for (let test of tests) {
    let validation = validator.validate(test, TestDefinitionSchema);

    // If validation fails, throw error with details
    if (!validation.valid) {
      throw new Error(`Test validation failed for '${fileName}': ${validation.errors.join(", ")}`);
    }
  }
  let userQuery = fs.readFileSync(path.join(__dirname, "score", fileName + ".userQuery.txt"), "utf8");

  let statistics = {
    total: 0,
    passed: 0,
  };

  logToFile(`Running test for '${fileName} (${iterations} iterations)'`);

  for (let i = 0; i < iterations; i++) { 
    setupCLISystemsForTest();

    logToFile(`Iteration ${i + 1} of ${iterations}`);

    const checkPath = path.join(__dirname, "score", fileName + ".selectedText.txt"); // Path to the selectedText file
    const selectedTextExists = fs.existsSync(checkPath); // Check if selectedText file exists
    const readSelectedText = selectedTextExists ? fs.readFileSync(checkPath, "utf8") : ""; // Read the selectedText file if it exists, else "".

    let start = { line: 0, character: 0 };
    let end = { line: 0, character: 0 };

    if (readSelectedText !== "") {
      const startIndex = userQuery.indexOf(readSelectedText);
      const endIndex = startIndex + readSelectedText.length;

      // For simplicity we're considering flat characters indices in file
      // A more advanced implementation would consider \n character to split lines
      start = { line: startIndex, character: 0 };
      end = { line: endIndex, character: 0 };
    }

    const execution = await MinionTask.create({
      userQuery,
      document: await getEditorManager().openTextDocument(getEditorManager().createUri(path.join(__dirname, "score", fileName))),

      // Use dynamically calculated 'start' and 'end'
      selection: { start, end },

      selectedText: readSelectedText,
      minionIndex: 0,
      onChanged: async (important) => {},
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
        logToFile(`Comment: ${comment}`);

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
      } else if (test.type === "functionReturnTypeCheck") {
        let returnType = await checkFunctionReturnType({ code: resultingCode, functionName: test.functionName });
        logToFile(`Return type of function ${test.functionName}: ${returnType}`);

        if (returnType !== test.expectedType) {
          logToFile(`Test failed: The return type of function ${test.functionName} is not ${test.expectedType}`);
        } else {
          statistics.passed++;
        }
      }
    }
  }

  console.log(
    `'${fileName}' score: ${(100 * statistics.passed/statistics.total).toFixed(0)}%`
  );
  logToFile(`'${fileName}' score: ${(100 * statistics.passed/statistics.total).toFixed(0)}%`);
}

async function runScoring(): Promise<void> {
  console.log("Running tests...");
  console.log(`Log file: ${logFilePath}`);

  logToFile("\n\nRunning tests...\n\n");

  initCLISystems();

  // Use glob to get all .original.txt file paths from the 'score' directory
  let testFileNames = glob.sync("**/*.original.txt", { cwd: path.join(__dirname, "score") });

  for (let fullName of testFileNames) {
    let baseName = path.basename(fullName).replace(".original.txt", "");
    await runTest({ fileName: baseName });
  }

  console.log(`Log file: ${logFilePath}`);
  console.log("Done!");
}

runScoring();

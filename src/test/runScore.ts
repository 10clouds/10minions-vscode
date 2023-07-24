import fs from 'fs';
import * as glob from 'glob';
import { Validator } from 'jsonschema'; // Imported the jsonschema library
import path from 'path';
import ts from 'typescript';
import { initCLISystems, setupCLISystemsForTest } from '../CLI/setupCLISystems';
import { MinionTask } from '../MinionTask';
import { getEditorManager } from '../managers/EditorManager';
import { gptExecute } from '../openai';
import {
  LOG_NO_FALLBACK_MARKER as LOG_NORMAL_MODIFICATION_MARKER,
  applyMinionTask,
} from '../strategies/utils/applyMinionTask';

import { LOG_PLAIN_COMMENT_MARKER as LOG_FALLBACK_COMMENT_MARKER } from '../strategies/utils/applyFallback';
import chalk from 'chalk';
import { GptMode } from '../types';
import { OptionValues, program } from 'commander';
import { mapLimit } from 'async';

export type TestDefinition =
  | { type: 'gptAssert'; mode: GptMode; assertion: string }
  | { type: 'simpleStringFind'; stringToFind: string }
  | {
      type: 'functionReturnTypeCheck';
      functionName: string;
      expectedType: string;
    };

interface ScoringTestOptions extends OptionValues {
  iterations: number;
  pattern?: string;
  concurrency: number;
}

const defaultIternationsNumber = 10;

const gptAssertSchema = {
  properties: {
    type: { type: 'string', pattern: 'gptAssert' },
    mode: { type: 'string' },
    assertion: { type: 'string' },
  },
  required: ['type', 'mode', 'assertion'],
};

const simpleStringFindSchema = {
  properties: {
    type: { type: 'string', pattern: 'simpleStringFind' },
    stringToFind: { type: 'string' },
  },
  required: ['type', 'stringToFind'],
};

const functionReturnTypeCheckSchema = {
  properties: {
    type: { type: 'string', pattern: 'functionReturnTypeCheck' },
    functionName: { type: 'string' },
    expectedType: { type: 'string' },
  },
  required: ['type', 'functionName', 'expectedType'],
};

const TestDefinitionSchema = {
  id: '/TestDefinition',
  oneOf: [
    gptAssertSchema,
    simpleStringFindSchema,
    functionReturnTypeCheckSchema,
  ],
};

async function checkFunctionReturnType({
  code,
  functionName,
}: {
  code: string;
  functionName: string;
}): Promise<string> {
  try {
    // Create and compile program
    // Create an in-memory source file
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      code,
      ts.ScriptTarget.ES2015,
      true,
    );

    // Create an in-memory compiler host
    const compilerHost: ts.CompilerHost = {
      ...ts.createCompilerHost({}),
      getSourceFile: (fileName) =>
        fileName === 'temp.ts' ? sourceFile : undefined,
      readFile: (fileName) => (fileName === 'temp.ts' ? code : undefined),
    };

    // Create and compile program with the in-memory compiler host
    const program = ts.createProgram(['temp.ts'], {}, compilerHost);
    const checker = program.getTypeChecker();

    // Helper function to search the AST nodes for a function declaration
    function findFunctionDeclaration(
      node: ts.Node,
      functionName: string,
    ): ts.FunctionDeclaration | undefined {
      if (
        ts.isFunctionDeclaration(node) &&
        node.name &&
        node.name.text === functionName
      ) {
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
      throw new Error(
        `Symbol not found for function '${functionName}'. Ensure the function exists and is correctly spelled.`,
      );
    }

    const typeOfFuncSym = checker.getTypeOfSymbolAtLocation(
      funcSym,
      funcSym.valueDeclaration,
    );

    const returnType = checker.getReturnTypeOfSignature(
      typeOfFuncSym.getCallSignatures()[0],
    );

    return checker.typeToString(returnType);
  } catch (error) {
    logToFile(
      `Error during return type check: ${
        error instanceof Error ? error.message : error
      }`,
    );

    return 'Error during return type check';
  }
}

const directoryPath = path.join(__dirname, 'logs');
// Added the Date object to get the current date and time and formatted it as per requirement (YYYY-MM-DD_HH-MM-SS).
const current_date = new Date();
const date_string = `${current_date.getFullYear()}-${(
  '00' +
  (current_date.getMonth() + 1)
).slice(-2)}-${('00' + current_date.getDate()).slice(-2)}_${(
  '00' + current_date.getHours()
).slice(-2)}-${('00' + current_date.getMinutes()).slice(-2)}-${(
  '00' + current_date.getSeconds()
).slice(-2)}`;

// Concatenating date_string with the filename to include the current date and time in the filename.
const logFilePath = path.join(directoryPath, `log_${date_string}.log`);

function logToFile(logMessage: string) {
  // Check if logs directory exist or not
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath); // If logs directory does not exist, create it
  }

  // If the file does not exist, create it, else append to it. `writeFileSync` and `appendFileSync` both create the file if it doesn't exist.
  if (!fs.existsSync(logFilePath)) {
    fs.writeFileSync(logFilePath, logMessage + '\n');
  } else {
    fs.appendFileSync(logFilePath, logMessage + '\n');
  }
}

async function gptAssert({
  originalCode,
  resultingCode,
  mode = 'FAST',
  assertion,
}: {
  originalCode: string;
  resultingCode: string;
  mode?: GptMode;
  assertion: string;
}) {
  const response = await gptExecute({
    fullPrompt: `Original code:\n${originalCode}\n\nResulting code:\n${resultingCode}\n\nPlease analyse the resulting code and answer: does the resulting code passes this test: "${assertion}"\n\n`,
    maxTokens: 100,
    mode,
    outputType: {
      name: 'reportTestResult',
      description: `Report a result of the test, whenever the resulting code meets the criteria: ${assertion}, provide a comment explaining why it does not meet the criteria`,
      parameters: {
        type: 'object',
        properties: {
          comment: {
            type: 'string',
            description:
              'Describe the reason for why the code passed (or did not pass) the test.',
          },
          passessTest: { type: 'boolean' },
        },
        required: ['passessTest', 'comment'],
      },
    },
  });

  const { passessTest, comment } = JSON.parse(response.result);

  return {
    passessTest,
    comment,
  };
}

async function runTest({
  fileName,
  iterations = defaultIternationsNumber,
}: {
  fileName: string;
  iterations?: number;
}) {
  //TODO: fix this linter error
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const tests: TestDefinition[] = require(path.join(
    __dirname,
    'score',
    fileName + '.tests.json',
  ));

  // Create a validator instance
  const validator = new Validator();

  // Validate each test in the tests array against the TestDefinitionSchema
  for (const test of tests) {
    const validation = validator.validate(test, TestDefinitionSchema);

    // If validation fails, throw error with details
    if (!validation.valid) {
      throw new Error(
        `Test validation failed for '${fileName}': ${validation.errors.join(
          ', ',
        )}`,
      );
    }
  }
  const userQuery = fs.readFileSync(
    path.join(__dirname, 'score', fileName + '.userQuery.txt'),
    'utf8',
  );

  const statistics = {
    total: 0,
    passed: 0,
  };

  logToFile(`Running test for '${fileName} (${iterations} iterations)'`);

  for (let i = 0; i < iterations; i++) {
    setupCLISystemsForTest();

    logToFile(`Iteration ${i + 1} of ${iterations}`);

    const checkPath = path.join(
      __dirname,
      'score',
      fileName + '.selectedText.txt',
    ); // Path to the selectedText file
    const selectedTextExists = fs.existsSync(checkPath); // Check if selectedText file exists
    const readSelectedText = selectedTextExists
      ? fs.readFileSync(checkPath, 'utf8')
      : ''; // Read the selectedText file if it exists, else "".

    let start = { line: 0, character: 0 };
    let end = { line: 0, character: 0 };

    if (readSelectedText !== '') {
      const startIndex = userQuery.indexOf(readSelectedText);
      const endIndex = startIndex + readSelectedText.length;

      // For simplicity, we're considering flat characters indices in file
      // A more advanced implementation would consider \n character to split lines
      start = { line: startIndex, character: 0 };
      end = { line: endIndex, character: 0 };
    }

    const execution = await MinionTask.create({
      userQuery,
      document: await getEditorManager().openTextDocument(
        getEditorManager().createUri(path.join(__dirname, 'score', fileName)),
      ),

      // Use dynamically calculated 'start' and 'end'
      selection: { start, end },

      selectedText: readSelectedText,
      minionIndex: 0,
      onChanged: async () => {},
    });
    await execution.run();
    await applyMinionTask(execution);

    const resultingCode = (await execution.document()).getText();

    logToFile('File contents');
    logToFile(resultingCode);

    statistics.total++;
    const includesNormalModification = execution.logContent.includes(
      LOG_NORMAL_MODIFICATION_MARKER,
    );
    const includesFallbackComment = execution.logContent.includes(
      LOG_FALLBACK_COMMENT_MARKER,
    );

    if (includesNormalModification && !includesFallbackComment) {
      logToFile(`Test passed: No fallback`);
      statistics.passed++;
    } else {
      if (includesNormalModification) {
        logToFile(
          `Test failed: Includes both normal modification & fallback comment `,
        );
      } else if (!includesFallbackComment) {
        logToFile(`Test failed: No modification (normal or fallback)`);
      } else {
        logToFile(`Test failed: Fallback comment applied`);
      }
    }

    for (const test of tests) {
      statistics.total++;

      if (test.type === 'gptAssert') {
        const { passessTest, comment } = await gptAssert({
          originalCode: execution.originalContent,
          resultingCode,
          assertion: test.assertion,
        });

        if (!passessTest) {
          logToFile(`Test failed: ${test.assertion}`);
          logToFile(`Comment: ${comment}`);
        } else {
          logToFile(`Test passed: ${test.assertion}`);
          logToFile(`Comment: ${comment}`);
          statistics.passed++;
        }
      } else if (test.type === 'simpleStringFind') {
        const passessTest = resultingCode.includes(test.stringToFind);
        logToFile(`Test: ${test.stringToFind}`);

        if (!passessTest) {
          logToFile(`Test failed: ${test.stringToFind}`);
        } else {
          statistics.passed++;
        }
      } else if (test.type === 'functionReturnTypeCheck') {
        const returnType = await checkFunctionReturnType({
          code: resultingCode,
          functionName: test.functionName,
        });
        logToFile(
          `Return type of function ${test.functionName}: ${returnType}`,
        );

        if (returnType !== test.expectedType) {
          logToFile(
            `Test failed: The return type of function ${test.functionName} is not ${test.expectedType}`,
          );
        } else {
          statistics.passed++;
        }
      }
    }
  }

  const score = ((100 * statistics.passed) / statistics.total).toFixed();

  console.log(`'${chalk.green(fileName)}' score: ${score}%`);
  logToFile(`'${fileName}' score: ${score}%`);
}

async function runScoring(options: ScoringTestOptions): Promise<void> {
  console.log('Running tests...');
  console.log(`Log file: ${logFilePath}`);

  logToFile('\n\nRunning tests...\n\n');

  initCLISystems();
  // this probably will be parametrized in the future
  const TEST_FILE_POSTFIX = '.original.txt';

  // Use glob to get all .original.txt file paths from the 'score' directory
  const testBaseNames = glob
    .sync(`**/${options.pattern}${TEST_FILE_POSTFIX}`, {
      cwd: path.join(__dirname, 'score'),
    })
    // Remove the '.original.txt' postfix from the file names
    .map((fileName) => fileName.slice(0, -TEST_FILE_POSTFIX.length));
  console.log(testBaseNames);
  await mapLimit(
    testBaseNames.map((fileName) => ({ fileName })),
    options.concurrency,
    runTest,
  );

  console.log(`Log file: ${logFilePath}`);
  console.log('Done!');
  return;
}

// TODO: move it to the isolated scope
program
  .name('AI score testing')
  .description('AI score testing ( beta )')
  .version('0.0.1')
  .option(
    '-i, --iterations <iterations>',
    'Number of iterations',
    (value) => parseInt(value),
    1,
  )
  .option('-p, --pattern <pattern>', 'File patterns to run tests on', '*')
  .option(
    '-c, --concurrency <concurency>',
    'Number of concurrent tests',
    (value) => parseInt(value),
    1,
  )
  .addHelpText(
    'after',
    `
  Examples:
    $ yarn <package.json script name> // runs all tests
    $ yarn <package.json script name> -p "test*" // runs all tests that match the pattern
    $ yarn <package.json script name> -p "test*" -c 2 // runs all tests that match the pattern with concurrency of 2
  `,
  )
  .parse();

program.parse(process.argv);
runScoring(program.opts<ScoringTestOptions>())
  .catch((e) => {
    console.log(e);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });

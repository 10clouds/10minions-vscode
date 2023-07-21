import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import path from 'path';
import fs from 'fs';
import { input, select, confirm } from '@inquirer/prompts';
import chalk from 'chalk';

interface TestRequiredData {
  selectedText: string;
  originalContent: string;
  finalContent: string;
  userQuery: string;
  modificationProcedure: string;
  modificationDescription: string;
}

enum TestType {
  SCORE,
  REPLACE_PROCEDURE,
  CREATE_PROCEDURE,
}

type TestLanguages = 'typescript' | 'javascript';

const TestLanguagesExtensions: Record<TestLanguages, string> = {
  javascript: 'js',
  typescript: 'ts',
};

interface TestConfig {
  id: string;
  testName: string;
  testType: TestType;
  withSelectedText: boolean;
  language: TestLanguages;
}

const baseDir = path.resolve(__dirname);
const serviceAccount = JSON.parse(
  readFileSync(path.resolve(baseDir, '../CLI/serviceAccount.json'), 'utf8'),
);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const REPLACE_PROCEDURE_TEST_FILE_PATH = 'replaceProcedure';
const CREATE_PROCEDURE_TEST_FILE_PATH = 'createProcedure';
const SCORE_TEST_FILE_PATH = 'score';

const getTestFilePath = (testType: TestType) => {
  return {
    [TestType.SCORE]: SCORE_TEST_FILE_PATH,
    [TestType.REPLACE_PROCEDURE]: REPLACE_PROCEDURE_TEST_FILE_PATH,
    [TestType.CREATE_PROCEDURE]: CREATE_PROCEDURE_TEST_FILE_PATH,
  }[testType];
};

function createTestsDirectory(testType: TestType, testName: string): string {
  const directoryName = getTestFilePath(testType);
  const directoryPath = path.resolve(__dirname, directoryName);
  const testDirPath = `${directoryPath}/${testName}`;

  if (!fs.existsSync(testDirPath)) {
    fs.mkdirSync(testDirPath);
  }
  return testDirPath;
}

function createTestFile(content: string, fileName: string) {
  const directoryPath = path.resolve(__dirname, fileName);

  if (!fs.existsSync(directoryPath)) {
    fs.writeFileSync(directoryPath, content);
  }
}

const createScoreTestFiles = async (
  testData: TestRequiredData,
  config: TestConfig,
): Promise<void> => {
  const { selectedText, originalContent, userQuery } = testData;
  const languageFileExtension = TestLanguagesExtensions[config.language];

  const testFileNamePrefix = `${SCORE_TEST_FILE_PATH}/${config.testName}.${languageFileExtension}.`;

  if (config.withSelectedText) {
    createTestFile(selectedText, `${testFileNamePrefix}selectedText.txt`);
  }
  createTestFile(originalContent, `${testFileNamePrefix}original.txt`);
  createTestFile(userQuery, `${testFileNamePrefix}userQuery.txt`);
  createTestFile(
    `[
         { "type": "gptAssert", "mode": "FAST", "assertion": "The code is a valid ${config.language} code" }
      ]`,
    `${testFileNamePrefix}tests.json`,
  );
};

const createProcedureTestFiles = async (
  testData: TestRequiredData,
  config: TestConfig,
) => {
  const {
    finalContent,
    originalContent,
    modificationDescription,
    modificationProcedure,
  } = testData;
  const testDirPath = createTestsDirectory(config.testType, config.testName);
  const testFileNamePrefix = `${testDirPath}/`;

  if (config.testType === TestType.CREATE_PROCEDURE) {
    createTestFile(
      modificationDescription,
      `${testFileNamePrefix}modification.txt`,
    );
  }

  createTestFile(originalContent, `${testFileNamePrefix}original.txt`);
  createTestFile(modificationProcedure, `${testFileNamePrefix}procedure.txt`);
  createTestFile(finalContent, `${testFileNamePrefix}result.txt`);
};

const createTestFiles = async (
  testData: TestRequiredData,
  config: TestConfig,
): Promise<void> => {
  const createFunction = {
    [TestType.SCORE]: createScoreTestFiles.bind(this, testData, config),
    [TestType.REPLACE_PROCEDURE]: createProcedureTestFiles.bind(
      this,
      testData,
      config,
    ),
    [TestType.CREATE_PROCEDURE]: createProcedureTestFiles.bind(
      this,
      testData,
      config,
    ),
  }[config.testType];
  createFunction && (await createFunction());
};

const collectBaseTestData = async (): Promise<
  Omit<TestConfig, 'withSelectedText' | 'language'>
> => {
  const testId = await input({
    message: 'Enter Firestore test ID ( 36 characters a-zA-Z0-9 )',
    validate: (value) => value.length === 36,
  });
  const testName = await input({
    message: 'Enter test name',
    validate: (value) => value.length > 10,
  });
  const testType = await select({
    message: 'Enter test type (replaceProcedure, createProcedure, score)',
    choices: [
      {
        name: 'replaceProcedure',
        value: TestType.REPLACE_PROCEDURE,
      },
      {
        name: 'createProcedure',
        value: TestType.CREATE_PROCEDURE,
      },
      {
        name: 'score',
        value: TestType.SCORE,
      },
    ],
  });

  console.log(`
Test config summary:
Firestore document ID: ${chalk.green(testId)}
Test name: ${chalk.green(testName)}
Test type: ${chalk.green(testType)}
`);

  const confirmResult = await confirm({ message: 'Continue?' });

  if (!confirmResult) {
    console.log(`${chalk.red('Aborted, please start again.')}`);
    return process.exit(0);
  }

  return {
    id: testId,
    testName,
    testType,
  };
};

const prepareTestFiles = async () => {
  const testConfigBase = await collectBaseTestData();

  try {
    const minionTaskSnapshot = await admin
      .firestore()
      .collection('minionTasks')
      .where('id', '==', testConfigBase.id)
      .limit(1)
      .get();

    // it will always return 1 document since we've added the limit above, and
    // to proper functionality the document ID should be used not the ID from the collection doc itself
    minionTaskSnapshot.forEach((doc) => {
      createTestFiles(doc.data() as TestRequiredData, {
        ...testConfigBase,
        withSelectedText: true,
        language: 'typescript',
      });
    });

    // createTestFiles(testData, testType);
  } catch (error) {
    console.error(error);
  }
};

prepareTestFiles().catch((error) => console.error(error));

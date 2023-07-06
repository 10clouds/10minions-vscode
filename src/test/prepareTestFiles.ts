import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import path from 'path';
import fs from 'fs';

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

interface TestConfig {
  id: string;
  testName: string;
  testType: TestType;
  withSelectedText: boolean;
  language: TestLanguages;
}

const config: TestConfig = {
  id: '', // pass id of minionTask from firestore
  testName: '', // name your test
  testType: TestType.REPLACE_PROCEDURE,
  withSelectedText: false, // if you want include selectedText in your score test files set this to true
  language: 'typescript', // set language that is used in your test
};

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
  let directoryName = '';
  switch (testType) {
    case TestType.SCORE:
      directoryName = SCORE_TEST_FILE_PATH;
      break;
    case TestType.REPLACE_PROCEDURE:
      directoryName = REPLACE_PROCEDURE_TEST_FILE_PATH;
      break;
    case TestType.CREATE_PROCEDURE:
      directoryName = CREATE_PROCEDURE_TEST_FILE_PATH;
      break;
    default:
      break;
  }

  return directoryName;
};

const getLanguegeFileExtension = () =>
  config.language === 'typescript' ? 'ts' : 'js';

function createTestsDirectory(testType: TestType) {
  const directoryName = getTestFilePath(testType);
  const directoryPath = path.resolve(__dirname, directoryName);
  const { testName } = config;
  const testDirPath = `${directoryPath}/${testName}`;

  if (!fs.existsSync(testDirPath)) {
    fs.mkdirSync(testDirPath);
    return testDirPath;
  }
}

function createTestFile(content: string, fileName: string, testType: TestType) {
  const directoryName = getTestFilePath(testType);
  const testFilePath = `${directoryName}/${fileName}`;
  const directoryPath = path.resolve(__dirname, fileName);

  if (!fs.existsSync(directoryPath)) {
    fs.writeFileSync(directoryPath, content);
  }
}

const SCORE_TEST_INITIAL_CONTENT = `[
    { "type": "gptAssert", "mode": "FAST", "assertion": "The code is valid ${config.language} code" }
  ]`;

const createScoreTestFiles = async (testData: TestRequiredData) => {
  const { selectedText, finalContent, originalContent, userQuery } = testData;
  const { testName, withSelectedText } = config;
  const languageFileExtension = getLanguegeFileExtension();
  const testFileNamePrefix = `${testName}.${languageFileExtension}.`;

  if (withSelectedText) {
    createTestFile(
      selectedText,
      `${testFileNamePrefix}selectedText.txt`,
      TestType.SCORE,
    );
  }
  createTestFile(
    originalContent,
    `${testFileNamePrefix}original.txt`,
    TestType.SCORE,
  );
  createTestFile(
    userQuery,
    `${testFileNamePrefix}userQuery.txt`,
    TestType.SCORE,
  );
  createTestFile(
    SCORE_TEST_INITIAL_CONTENT,
    `${testFileNamePrefix}tests.json`,
    TestType.SCORE,
  );
};

const createProcedureTestFiles = async (
  testData: TestRequiredData,
  testType: TestType,
) => {
  const {
    finalContent,
    originalContent,
    userQuery,
    modificationDescription,
    modificationProcedure,
  } = testData;
  const testDirPath = createTestsDirectory(testType);
  const testFileNamePrefix = `${testDirPath}/`;

  if (testType === TestType.CREATE_PROCEDURE) {
    createTestFile(
      modificationDescription,
      `${testFileNamePrefix}modification.txt`,
      testType,
    );
  }

  createTestFile(
    originalContent,
    `${testFileNamePrefix}original.txt`,
    testType,
  );
  createTestFile(
    modificationProcedure,
    `${testFileNamePrefix}procedure.txt`,
    testType,
  );
  createTestFile(finalContent, `${testFileNamePrefix}result.txt`, testType);
};

const createTestFiles = (testData: TestRequiredData, testType: TestType) => {
  switch (testType) {
    case TestType.SCORE:
      createScoreTestFiles(testData);
      break;
    case TestType.REPLACE_PROCEDURE:
      createProcedureTestFiles(testData, TestType.REPLACE_PROCEDURE);
      break;
    case TestType.CREATE_PROCEDURE:
      createProcedureTestFiles(testData, TestType.CREATE_PROCEDURE);
      break;
    default:
      break;
  }
};

const prepareTestFiles = async () => {
  const { id, testType, testName } = config;
  if (!id || !testType || !testName) {
    console.error('Incorrect test config - check your config');
    return;
  }

  try {
    const minionTaskSnapshot = await admin
      .firestore()
      .collection('minionTasks')
      .where('id', '==', '001279e4-8635-4d25-b9cd-8c3937693581')
      .get();

    let testData: TestRequiredData = {} as TestRequiredData;

    minionTaskSnapshot.forEach((doc) => {
      const {
        selectedText,
        finalContent,
        originalContent,
        userQuery,
        modificationDescription,
        modificationProcedure,
      } = doc.data();
      testData = {
        selectedText,
        finalContent,
        originalContent,
        userQuery,
        modificationDescription,
        modificationProcedure,
      };
    });

    createTestFiles(testData, testType);
  } catch (error) {
    console.error(error);
  }
};

prepareTestFiles();

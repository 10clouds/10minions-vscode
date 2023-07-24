import * as assert from 'assert';
import * as fs from 'fs';
import { readFileSync } from 'fs';
import * as glob from 'glob';
import * as path from 'path';
import { setupCLISystemsForTest } from '../../CLI/setupCLISystems';
import { applyModificationProcedure } from '../../strategies/utils/applyModificationProcedure';
import { createModificationProcedure } from '../../strategies/utils/createModificationProcedure';
import { extractFileNameFromPath } from '../../strategies/utils/extractFileNameFromPath';

suite('Create procedure test suite', () => {
  const baseDir = path.resolve(__dirname);

  const allPaths = glob.sync(path.resolve(baseDir, '*'));
  const testDirs = allPaths.filter((path) => fs.lstatSync(path).isDirectory());

  setupCLISystemsForTest();

  for (const testDir of testDirs) {
    test(testDir, async () => {
      const testOriginalFilePath = glob.sync(`${testDir}/*.original.txt`, {
        cwd: path.join(__dirname, testDir),
      })[0];

      const originalFileURI = testOriginalFilePath
        ? testOriginalFilePath
        : path.resolve(baseDir, testDir, 'original.txt');
      const filename = testOriginalFilePath
        ? extractFileNameFromPath(testOriginalFilePath)
        : '';
      const currentCode = readFileSync(originalFileURI, 'utf8');
      const modification = readFileSync(
        path.resolve(baseDir, testDir, 'modification.txt'),
        'utf8',
      );
      const expectedOutput = readFileSync(
        path.resolve(baseDir, testDir, 'result.txt'),
        'utf8',
      );

      const { result: procedure } = await createModificationProcedure(
        currentCode,
        modification,
        async () => {},
        () => false,
        filename,
      );

      fs.writeFileSync(
        path.resolve(baseDir, testDir, 'procedure.txt'),
        procedure,
      );

      let modifiedContent;
      try {
        modifiedContent = await applyModificationProcedure(
          currentCode,
          procedure,
          'typescript',
        );
      } catch (e) {
        const error = e as Error;
        modifiedContent = error.toString();
      }

      assert.strictEqual(modifiedContent, expectedOutput);
    });
  }
});

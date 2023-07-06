import * as assert from 'assert';
import * as fs from 'fs';
import { readFileSync } from 'fs';
import * as glob from 'glob';
import * as path from 'path';
import { setupCLISystemsForTest } from '../../CLI/setupCLISystems';
import { applyModificationProcedure } from '../../strategies/utils/applyModificationProcedure';
import { createModificationProcedure } from '../../strategies/utils/createModificationProcedure';

suite('Create procedure test suite', () => {
  const baseDir = path.resolve(__dirname);

  const allPaths = glob.sync(path.resolve(baseDir, '*'));
  const testDirs = allPaths.filter((path) => fs.lstatSync(path).isDirectory());

  setupCLISystemsForTest();

  for (const testDir of testDirs) {
    test(testDir, async () => {
      const currentCode = readFileSync(
        path.resolve(baseDir, testDir, 'original.txt'),
        'utf8',
      );
      const modification = readFileSync(
        path.resolve(baseDir, testDir, 'modification.txt'),
        'utf8',
      );
      const expectedOutput = readFileSync(
        path.resolve(baseDir, testDir, 'result.txt'),
        'utf8',
      );

      const { result: procedure, cost } = await createModificationProcedure(
        currentCode,
        modification,
        async (chunk) => {},
        () => false,
      );

      fs.writeFileSync(
        path.resolve(baseDir, testDir, 'procedure.txt'),
        procedure,
      );

      const modifiedContent = await applyModificationProcedure(
        currentCode,
        procedure,
        'typescript',
      );

      assert.strictEqual(modifiedContent, expectedOutput);
    });
  }
});

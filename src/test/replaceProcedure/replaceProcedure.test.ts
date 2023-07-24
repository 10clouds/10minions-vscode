import * as assert from 'assert';
import * as fs from 'fs';
import { readFileSync } from 'fs';
import * as glob from 'glob';
import * as path from 'path';
import { applyModificationProcedure } from '../../strategies/utils/applyModificationProcedure';

suite('Replace Procedure Test Suite', () => {
  const baseDir = path.resolve(__dirname);

  const allPaths = glob.sync(path.resolve(baseDir, '*'));
  const testDirs = allPaths.filter((path) => fs.lstatSync(path).isDirectory());

  for (const testDir of testDirs) {
    test(path.basename(testDir), async () => {
      const currentCode = readFileSync(
        path.resolve(baseDir, testDir, 'original.txt'),
        'utf8',
      );
      const procedure = readFileSync(
        path.resolve(baseDir, testDir, 'procedure.txt'),
        'utf8',
      );
      const expectedOutput = readFileSync(
        path.resolve(baseDir, testDir, 'result.txt'),
        'utf8',
      );

      let modifiedContent;
      try {
        modifiedContent = await applyModificationProcedure(
          currentCode,
          procedure,
          'typescript',
        );
      } catch (e: unknown) {
        if (e instanceof Error) {
          modifiedContent = e.toString();
        }
      }

      assert.strictEqual(modifiedContent, expectedOutput);
    });
  }
});

import * as assert from "assert";
import * as fs from 'fs';
import { readFileSync } from "fs";
import * as glob from 'glob';
import * as path from 'path';
import { applyModificationProcedure } from "../../strategies/utils/applyModificationProcedure";

suite("Replace Procedure Test Suite", () => {
  const baseDir = path.resolve(__dirname);

  let allPaths = glob.sync(path.resolve(baseDir, '*'));
  let testDirs = allPaths.filter((path) => fs.lstatSync(path).isDirectory());

  for (let testDir of testDirs) {
    test(path.basename(testDir), () => {
      const currentCode = readFileSync(path.resolve(baseDir, testDir, "original.txt"), "utf8");
      const procedure = readFileSync(path.resolve(baseDir, testDir, "procedure.txt"), "utf8");
      const expectedOutput = readFileSync(path.resolve(baseDir, testDir, "result.txt"), "utf8");
  
      let modifiedContent;
      try {
        modifiedContent = applyModificationProcedure(
          currentCode,
          procedure,
          "typescript",
        );
      } catch (e: any) {
        modifiedContent = e.toString();
      }
      
      assert.strictEqual(modifiedContent, expectedOutput);
    });
  }
});
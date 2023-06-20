import * as assert from "assert";
import * as fs from 'fs';
import { readFileSync } from "fs";
import * as glob from 'glob';
import * as path from 'path';
import { createModificationProcedure } from "../../utils/createModificationProcedure";
import { applyModificationProcedure } from "../../utils/applyModificationProcedure";

suite("Replace procedure test suite", () => {
  const baseDir = path.resolve(__dirname);

  let allPaths = glob.sync(path.resolve(baseDir, '*'));
  let testDirs = allPaths.filter((path) => fs.lstatSync(path).isDirectory());

  for (let testDir of testDirs) {
    test(testDir, async () => {
      const currentCode = readFileSync(path.resolve(baseDir, testDir, "original.txt"), "utf8");
      const modification = readFileSync(path.resolve(baseDir, testDir, "modification.txt"), "utf8");
      const expectedOutput = readFileSync(path.resolve(baseDir, testDir, "result.txt"), "utf8");

      console.log("CREATING PROCEDURE");
      let {result: procedure, cost} = await createModificationProcedure(currentCode, modification, async (chunk) => {

      }, () => false);

      console.log(procedure);

      let modifiedContent = applyModificationProcedure(
        currentCode,
        procedure,
        "typescript",
      );

      assert.strictEqual(modifiedContent, expectedOutput);
    });
  }
});
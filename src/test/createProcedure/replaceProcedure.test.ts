import * as assert from "assert";
import * as fs from 'fs';
import { readFileSync } from "fs";
import * as glob from 'glob';
import * as path from 'path';
import { createModificationProcedure } from "../../utils/createModificationProcedure";
import { applyModificationProcedure } from "../../utils/applyModificationProcedure";
import { setOpenAIApiKey } from "../../openai";
import { AnalyticsManager } from "../../managers/AnalyticsManager";
import { OpenAICacheManager } from "../../managers/OpenAICacheManager";

suite("Create procedure test suite", () => {
  const baseDir = path.resolve(__dirname);

  let allPaths = glob.sync(path.resolve(baseDir, '*'));
  let testDirs = allPaths.filter((path) => fs.lstatSync(path).isDirectory());

  setOpenAIApiKey(JSON.parse(readFileSync(path.resolve(baseDir, "openAIKey.json"), "utf8")).openAIKey);

  //const openAiCacheManager = new OpenAICacheManager(JSON.parse(readFileSync(path.resolve(baseDir, "serviceAccount.json"), "utf8")));
  const openAiCacheManager = new OpenAICacheManager();

  const analyticsManager = new AnalyticsManager(
    "localTests-installationId",
    "VsCodeStub",
  );
  analyticsManager.setSendDiagnosticsData(true);


  for (let testDir of testDirs) {
    test(testDir, async () => {
      const currentCode = readFileSync(path.resolve(baseDir, testDir, "original.txt"), "utf8");
      const modification = readFileSync(path.resolve(baseDir, testDir, "modification.txt"), "utf8");
      const expectedOutput = readFileSync(path.resolve(baseDir, testDir, "result.txt"), "utf8");

      let {result: procedure, cost} = await createModificationProcedure(currentCode, modification, async (chunk) => {

      }, () => false);

      fs.writeFileSync(path.resolve(baseDir, testDir, "procedure.txt"), procedure);

      let modifiedContent = applyModificationProcedure(
        currentCode,
        procedure,
        "typescript",
      );

      assert.strictEqual(modifiedContent, expectedOutput);
    });
  }
});
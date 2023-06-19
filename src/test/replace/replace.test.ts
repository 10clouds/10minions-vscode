import * as fs from 'fs';
import * as assert from "assert";
import { readFileSync } from "fs";
import * as path from 'path';
import * as glob from 'glob';
import { fuzzyReplaceText } from '../../utils/fuzzyReplaceText';

suite("Replace Test Suite", () => {
  test("Basic test case: Exact match found", () => {
    const currentCode = [
      `      function example() {`,
      `        console.log("Hello, world!");`, 
      `      }`
    ].join("\n");
    
    const findText = [
      `console.log("Hello, world!");`
    ].join("\n");

    const withText = [
      `console.log("Hello, moon!");`
    ].join("\n");

    const expectedOutput = [
      `      function example() {`,
      `        console.log("Hello, moon!");`,
      `      }`
    ].join("\n");

    const result = fuzzyReplaceText({currentCode, findText, withText});
    assert.strictEqual(result, expectedOutput);
  });
  test("Only replace with same indentation", () => {
    const currentCode = [
      `      function example() {`,
      `        console.log("Hello, world!");`, 
      `      }`,
      `      console.log("Hello, world!");`
    ].join("\n");

    const findText = [
      `      console.log("Hello, world!");`
    ].join("\n");

    const withText = [
      `      console.log("Hello, moon!");`
    ].join("\n");

    const expectedOutput = [
      `      function example() {`,
      `        console.log("Hello, world!");`, 
      `      }`,
      `      console.log("Hello, moon!");`
    ].join("\n");

    const result = fuzzyReplaceText({currentCode, findText, withText});
    assert.strictEqual(result, expectedOutput);
  });
  test("Only replace with same indentation (multiline)", () => {
    const currentCode = [
      `      function example() {`,
      `        console.log("Hello, world!");`, 
      `        console.log("Hello, warg!");`, 
      `      }`,
      `      console.log("Hello, world!");`,
      `      console.log("Hello, warg!");`
    ].join("\n");

    const findText = [
      `      console.log("Hello, world!");`,
      `      console.log("Hello, warg!");`
    ].join("\n");

    const withText = [
      `      console.log("Hello, moon!");`
    ].join("\n");

    const expectedOutput = [
      `      function example() {`,
      `        console.log("Hello, world!");`, 
      `        console.log("Hello, warg!");`, 
      `      }`,
      `      console.log("Hello, moon!");`
    ].join("\n");

    const result = fuzzyReplaceText({currentCode, findText, withText});
    assert.strictEqual(result, expectedOutput);
  });
  test("Only replace with nearest indentation (multiline)", () => {
    const currentCode = [
      `        function example() {`,
      `          console.log("Hello, world!");`, 
      `          console.log("Hello, warg!");`, 
      `        }`,
      `       console.log("Hello, world!");`,
      `       console.log("Hello, warg!");`,
      `        function example() {`,
      `        console.log("Hello, world!");`, 
      `        console.log("Hello, warg!");`, 
      `        }`,
    ].join("\n");

    const findText = [
      `      console.log("Hello, world!");`,
      `      console.log("Hello, warg!");`
    ].join("\n");

    const withText = [
      `      console.log("Hello, moon!");`
    ].join("\n");

    const expectedOutput = [
      `        function example() {`,
      `          console.log("Hello, world!");`, 
      `          console.log("Hello, warg!");`, 
      `        }`,
      `       console.log("Hello, moon!");`,
      `        function example() {`,
      `        console.log("Hello, world!");`, 
      `        console.log("Hello, warg!");`, 
      `        }`,
    ].join("\n");

    const result = fuzzyReplaceText({currentCode, findText, withText});
    assert.strictEqual(result, expectedOutput);
  });
  test("Multiline with different indentation", () => {
    const currentCode = [
      `      function example() {`,
      `        if (true) {`,
      `          console.log("Hello, world!");`,
      `          console.log("Hello, warg!");`,
      `        }`,
      `      }`
    ].join("\n");

    const findText = [
      `      console.log("Hello, world!");`,
      `      console.log("Hello, warg!");`,
    ].join("\n");

    const withText = [
      `      console.log("Hello, moon!");`
    ].join("\n");

    const expectedOutput = [
      `      function example() {`,
      `        if (true) {`,
      `          console.log("Hello, moon!");`,
      `        }`,
      `      }`
    ].join("\n");

    const result = fuzzyReplaceText({currentCode, findText, withText});
    assert.strictEqual(result, expectedOutput);
  });
  test("First line without indentation", () => {
    const currentCode = [
      `      function example() {`,
      `        if (true) {`,
      `          console.log("Hello, world!");`,
      `          console.log("Hello, warg!");`,
      `        }`,
      `      console.log("Hello, world!");`,
      `      console.log("Hello, warg!");`,
      `      }`
    ].join("\n");

    const findText = [
      `console.log("Hello, world!");`,
      `      console.log("Hello, warg!");`,
    ].join("\n");

    const withText = [
      `      console.log("Hello, moon!");`
    ].join("\n");

    const expectedOutput = [
      `      function example() {`,
      `        if (true) {`,
      `          console.log("Hello, world!");`,
      `          console.log("Hello, warg!");`,
      `        }`,
      `      console.log("Hello, moon!");`,
      `      }`
    ].join("\n");

    const result = fuzzyReplaceText({currentCode, findText, withText});
    assert.strictEqual(result, expectedOutput);
  });
  test("Fuzzy match with different syntax", () => {
    const currentCode = [
      `      function example() {`,
      `        console.log(say_hello("world"));`,
      `      }`
    ].join("\n");

    const findText = [
      `      console.log(say_hello("world"));`
    ].join("\n");

    const withText = [
      `      console.log(say_hello("moon"));`
    ].join("\n");

    const expectedOutput = [
      `      function example() {`,
      `        console.log(say_hello("moon"));`,
      `      }`
    ].join("\n");

    const result = fuzzyReplaceText({currentCode, findText, withText});
    assert.strictEqual(result, expectedOutput);
  });
  test("No match found", () => {
    const currentCode = [
      `      function example() {`,
      `        handleClearAndFocus();`,
      `      }`
    ].join("\n");

    const findText = [
      `      console.log("Hello, world!");`
    ].join("\n");

    const withText = [
      `      console.log("Hello, moon!");`
    ].join("\n");

    const result = fuzzyReplaceText({currentCode, findText, withText});
    assert.strictEqual(result, undefined);
  });

  const baseDir = path.resolve(__dirname);

  let allPaths = glob.sync(path.resolve(baseDir, '*'));
  let testDirs = allPaths.filter((path) => fs.lstatSync(path).isDirectory());

  for (let testDir of testDirs) {
    test(path.basename(testDir), () => {
      const currentCode = readFileSync(path.resolve(baseDir, testDir, "original.txt"), "utf8");
      const findText = readFileSync(path.resolve(baseDir, testDir, "replace.txt"), "utf8");
      const withText = readFileSync(path.resolve(baseDir, testDir, "with.txt"), "utf8");
      const expectedOutput = readFileSync(path.resolve(baseDir, testDir, "result.txt"), "utf8");
  
      const result = fuzzyReplaceText({currentCode, findText, withText});
      assert.strictEqual(result, expectedOutput);
    });
  }
});
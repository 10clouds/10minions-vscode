import * as assert from "assert";
import { fuzzyReplaceText } from "../../utils/fuzzyReplaceText";

suite("Replace With Sliding Indent Test Suite", () => {
  test("Basic test case: Exact match found", () => {
    const currentCode = [
      `      function example() {`,
      `        console.log("Hello, world!");`, 
      `      }`
    ].join("\n");
    
    const replaceText = [
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

    const result = fuzzyReplaceText(currentCode, replaceText, withText);
    assert.strictEqual(result, expectedOutput);
  });
  test("Only replace with same indentation", () => {
    const currentCode = [
      `      function example() {`,
      `        console.log("Hello, world!");`, 
      `      }`,
      `      console.log("Hello, world!");`
    ].join("\n");

    const replaceText = [
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

    const result = fuzzyReplaceText(currentCode, replaceText, withText);
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

    const replaceText = [
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

    const result = fuzzyReplaceText(currentCode, replaceText, withText);
    assert.strictEqual(result, expectedOutput);
  });
  test("Only replace with similar indentation (multiline)", () => {
    const currentCode = [
      `      function example() {`,
      `        console.log("Hello, world!");`, 
      `        console.log("Hello, warg!");`, 
      `      }`,
      `     console.log("Hello, world!");`,
      `     console.log("Hello, warg!");`,
      `      function example() {`,
      `        console.log("Hello, world!");`, 
      `        console.log("Hello, warg!");`, 
      `      }`,
    ].join("\n");

    const replaceText = [
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
      `     console.log("Hello, moon!");`,
      `      function example() {`,
      `        console.log("Hello, world!");`, 
      `        console.log("Hello, warg!");`, 
      `      }`,
    ].join("\n");

    const result = fuzzyReplaceText(currentCode, replaceText, withText);
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

    const replaceText = [
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

    const result = fuzzyReplaceText(currentCode, replaceText, withText);
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

    const replaceText = [
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

    const result = fuzzyReplaceText(currentCode, replaceText, withText);
    assert.strictEqual(result, expectedOutput);
  });
  test("Fuzzy match with different syntax", () => {
    const currentCode = [
      `      function example() {`,
      `        console.log(say_hello("world"));`,
      `      }`
    ].join("\n");

    const replaceText = [
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

    const result = fuzzyReplaceText(currentCode, replaceText, withText);
    assert.strictEqual(result, expectedOutput);
  });
  test("No match found", () => {
    const currentCode = [
      `      function example() {`,
      `        handleClearAndFocus();`,
      `      }`
    ].join("\n");

    const replaceText = [
      `      console.log("Hello, world!");`
    ].join("\n");

    const withText = [
      `      console.log("Hello, moon!");`
    ].join("\n");

    const result = fuzzyReplaceText(currentCode, replaceText, withText);
    assert.strictEqual(result, undefined);
  });
});

import * as assert from "assert";
import { stripAllComments } from "../../utils/stripAllComments";

suite("Strip All Comments Test Suite", () => {
  test("No comments in the Code", () => {
    const code = `
      function example() {
        console.log("Hello, world!");
      }`;
    const expectedResult = `${code}`;

    const result = stripAllComments(code.split("\n")).join("\n");
    assert.deepStrictEqual(result, expectedResult);
  });

  test("Code with line comments", () => {
    const code = `
      // This is a (test function) example
      function example() {
        console.log("Hello, world!");
      }`;
    const expectedResult = `
      function example() {
        console.log("Hello, world!");
      }`;

    const result = stripAllComments(code.split("\n")).join("\n");
    assert.deepStrictEqual(result, expectedResult);
  });

  test("Code with block comments", () => {
    const code = `
        /* This is a (test function) example*/
        function example() {
          console.log("Hello, world!");
        }`;

    const expectedResult = `
        function example() {
          console.log("Hello, world!");
        }`;

    const result = stripAllComments(code.split("\n")).join("\n");
    assert.deepStrictEqual(result, expectedResult);
  });

  test("Code with both line and block comments", () => {
    const code = `
      // This is a (test function) example
      function example() {
        console.log("Hello, world!");
      }`;
    const expectedResult = `
      function example() {
        console.log("Hello, world!");
      }`;

    const result = stripAllComments(code.split("\n")).join("\n");
    assert.deepStrictEqual(result, expectedResult);
  });

  test("Python Code with comments", () => {
    const code = `
    # This is a single line comment
    ''' This is a 
       multiline comment in python '''
    def example():
      print("Hello, world!")
    `;

    const expectedResult = `
    def example():
      print("Hello, world!")
    `;

    const result = stripAllComments(code.split("\n")).join("\n");
    assert.deepStrictEqual(result, expectedResult);
  });

  test("TypeScript Code with multiline comments", () => {
    const code = `
    /* This is a line of the comment.
       This is another line of the comment.
       Yet another line of the comment. */
    function example() {
      console.log("Hello, world!");
    }`;

    const expectedResult = `
    function example() {
      console.log("Hello, world!");
    }`;

    const result = stripAllComments(code.split("\n")).join("\n");
    assert.deepStrictEqual(result, expectedResult);
  });

  test("Golang Code with comments", () => {
    const code = `
    // This is a single line comment
    func example() {
      fmt.Println("Hello, world!")
    }`;

    const expectedResult = `
    func example() {
      fmt.Println("Hello, world!")
    }`;

    const result = stripAllComments(code.split("\n")).join("\n");
    assert.deepStrictEqual(result, expectedResult);
  });
});

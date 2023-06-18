import { DEBUG_PROMPTS } from "../const";
import { countTokens, ensureIRunThisInRange, gptExecute } from "../openai";


export const AVAILABE_COMMANDS = [
  `
# REPLACE / WITH / END_REPLACE

Use this se to replace a piece of code with another piece of code. Start it with the following line:

REPLACE

Followed by the lines of code you are replacing, and then, when ready to output the text to replace, start it with the following command:

WITH

Followed by the code you are replacing with. End the sequence with the following command:

END_REPLACE

Follow this rules when using REPLACE / WITH / END_REPLACE command sequence:
* All lines and whitespace in the text you are replacing matter, try to keep the newlines and indentation the same so proper match can be found.
* After REPLACEments the code should be final, production ready, as described in REQUESTED MODIFICATION.
`.trim(),



  /*`
  
  # REPLACE_ALL / END_REPLACE_ALL
  
  Use this command if most of the file is modified. When you are ready to output the final consolidated result, start it with the following line:
  
  REPLACE_ALL
  
  Followed by the lines of a full consolidated final, production ready, code, described in REQUESTED MODIFICATION when applied to ORIGINAL CODE. Followed by the following line:
  
  END_REPLACE_ALL
  
  Follow this rules when using REPLACE / WITH / END_REPLACE command sequence:
  * All lines and whitespace in the text you are replacing matter, try to keep the newlines and indentation the same so proper match can be found.
  * Keep in mind that all lines after WITH, and until next REPLACE, will be used, even the empty ones. So any output after final WITH will be part of the final replacement.
  * Do not invent your own commands, use only the ones described above.
  * After REPLACEments the code should be final, production ready, as described in REQUESTED MODIFICATION.
  
  `.trim()
  
  ,
  */
  `

# MODIFY_OTHER / END_MODIFY_OTHER

If REQUESTED_MODIFICATION specifies that other files must be created or modified, use this command to specify any modifications that need to happen in other files. User will apply them manually, so they don't have to compile, and can have instructions on how to apply them. Start it with the following line:

MODIFY_OTHER

Followed by the lines of instructions on what to modify and how. Followed by the following line:

END_MODIFY_OTHER

`.trim()
];

export const OUTPUT_FORMAT = `

Star your answer with the overview of what you are going to do, and then, follow it by one more COMMANDS.

## General considerations:
* Do not invent your own commands, use only the ones described below.

## Available commands are:
${AVAILABE_COMMANDS.join("\n\n")}

`.trim();

export async function createModificationProcedure(
  refCode: string,
  modification: string,
  onChunk: (chunk: string) => Promise<void>,
  isCancelled: () => boolean
) {
  //replace any lines with headers in format ===== HEADER ==== (must start and end the line without any additioanl characters) with # HEADER
  modification = modification.replace(
    /^(====+)([^=]+)(====+)$/gm,
    (match, p1, p2, p3) => {
      return `#${p2}`;
    }
  );

  let promptWithContext = createPrompt(refCode, modification);

  let tokensModification = countTokens(modification, "QUALITY");
  let tokensCode = countTokens(promptWithContext, "QUALITY");
  let luxiouriosTokens = Math.max(tokensCode, tokensModification) * 1.5;
  let absoluteMinimumTokens = Math.max(tokensCode, tokensModification);

  if (DEBUG_PROMPTS) {

    onChunk("<<<< PROMPT >>>>\n\n");
    onChunk(promptWithContext + "\n\n");
    onChunk("<<<< EXECUTION >>>>\n\n");
  }

  return await gptExecute({
    fullPrompt: promptWithContext,
    onChunk,
    maxTokens: ensureIRunThisInRange({
      prompt: promptWithContext,
      mode: "QUALITY",
      preferedTokens: luxiouriosTokens,
      minTokens: absoluteMinimumTokens,
    }),
    temperature: 0,
    isCancelled,
    mode: "FAST",
    outputType: "string",
  });
}
function createPrompt(refCode: string, modification: string) {
  return `
You are a higly intelligent AI file composer tool, you can take a piece of text and a modification described in natural langue, and return a consolidated answer.

==== FORMAT OF THE ANSWER ====
${OUTPUT_FORMAT} 

==== THINGS TO TAKE INTO CONSIDERATION ====

* You have been provided an exact modification (REQUESTED MODIFICATION section) that needs to be applied to the code (ORIGINAL CODE section).
* Make sure to exactly match the structure of the original and exactly the intention of the modification.
* You MUST ALWAYS expand all comments like "// ...", "/* remainig code */" or "// ...rest of the code remains the same..." to the exact code that they refer to. You are producting final production ready code, so you need complete code.
* If in the REQUESTED MODIFICATION section there are only comments, and user asked something that does not requrie modification of the code. Write the answer as a code comment in appropriate spot.
* You must always leave a mark on the final file, if there is nothing to modify in the file, you must leave a comment in the file describing why there is nothing to modify.

==== ORIGINAL CODE ====
${refCode}

==== REQUESTED MODIFICATION ====
${modification}

==== FINAL SUMMARY ====
You are a higly intelligent AI file composer tool, you can take a piece of text and a modification described in natural langue, and return a consolidated answer.

Let's take this step by step, first, describe in detail what you are going to do, and then perform previously described commands in FORMAT OF THE ANSWER section.
`.trim();
}

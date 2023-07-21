import { DEBUG_PROMPTS } from '../../const';
import { gptExecute } from '../../openai';
import { GptMode } from '../../types';
import { countTokens } from '../../utils/countTokens';
import { ensureIRunThisInRange } from '../../utils/ensureIRunThisInRange';

export const AVAILABLE_COMMANDS = [
  `
# Syntax and description of a REPLACE command

Use this to replace a block of lines of code with another block of lines of code. Start it with the following line:

REPLACE

Followed by the lines of code you are replacing, and then, when ready to output the text to replace, start it with the following command:

WITH

Followed by the code you are replacing with. End the sequence with the following command:

END_REPLACE

Follow this rules when using REPLACE / WITH / END_REPLACE command sequence:
* All lines and whitespace in the text you are replacing matter, try to keep the newlines and indentation the same so proper match can be found.
* You MUST use all 3 parts of the command: REPLACE, WITH and END_REPLACE.
`.trim(),

  `
# Syntax and description of a INSERT command

Use this to insert new code after a given piece of code. Start it with the following line:

INSERT

Followed by the lines of code you are inserting, and then, when ready to output the text that should follow the inserted text, start it with the following command:

BEFORE

Followed by the code that should follow the inserted code. End the sequence with the following command:

END_INSERT

Follow this rules when using INSERT / BEFORE / END_INSERT command sequence:
* All lines and whitespace in the text you are inserting matter.
* You MUST use all 3 parts of the command: INSERT, BEFORE and END_INSERT.
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
# Syntax and description of a MODIFY_OTHER command

If REQUESTED_MODIFICATION specifies that other files must be created or modified, use this command to specify any modifications that need to happen in other files. User will apply them manually, so they don't have to compile, and can have instructions on how to apply them. Start it with the following line:

MODIFY_OTHER

Followed by the lines of instructions on what to modify and how. Followed by the following line:

END_MODIFY_OTHER

`.trim(),
];

export const OUTPUT_FORMAT = `

Star your answer with the overview of what you are going to do, and then, follow it by one more COMMANDS.

## General considerations:
* Do not invent your own commands, use only the ones described below.
* After all INSERTS and REPLACEmeents the code should be final, production ready, as described in REQUESTED MODIFICATION.

## Available commands are:
${AVAILABLE_COMMANDS.join('\n\n')}

`.trim();

export async function createModificationProcedure(
  refCode: string,
  modification: string,
  onChunk: (chunk: string) => Promise<void>,
  isCancelled: () => boolean,
) {
  //replace any lines with headers in format ===== HEADER ==== (must start and end the line without any additioanl characters) with # HEADER
  modification = modification.replace(
    /^(====+)([^=]+)(====+)$/gm,

    (match, p1, p2) => {
      return `#${p2}`;
    },
  );

  const promptWithContext = createPrompt(refCode, modification);

  //console.log("Prompt with context:");
  //console.log(promptWithContext);

  const tokensModification = countTokens(modification, 'QUALITY') + 50;
  const luxiouriosTokens = tokensModification * 1.5;
  const absoluteMinimumTokens = tokensModification;

  if (DEBUG_PROMPTS) {
    onChunk('<<<< PROMPT >>>>\n\n');
    onChunk(promptWithContext + '\n\n');
    onChunk('<<<< EXECUTION >>>>\n\n');
  }

  const mode: GptMode = 'QUALITY';

  return await gptExecute({
    fullPrompt: promptWithContext,
    onChunk,
    maxTokens: ensureIRunThisInRange({
      prompt: promptWithContext,
      mode,
      preferedTokens: luxiouriosTokens,
      minTokens: absoluteMinimumTokens,
    }),
    temperature: 0,
    isCancelled,
    mode,
    outputType: 'string',
  });
}
function createPrompt(refCode: string, modification: string) {
  const { fileName } = getFileInfo();

  return `
You are a higly intelligent AI file composer tool, you can take a piece of text and a modification described in natural langue, and return a consolidated answer.

==== FORMAT OF THE ANSWER ====
${OUTPUT_FORMAT} 

==== THINGS TO TAKE INTO CONSIDERATION ====
* If you are not sure what is the TASK or TASK details are not specified, try to generate response based on FILENAME: '${fileName}'.
* ALWAYS use FILENAME as a hint when you answering the question.
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

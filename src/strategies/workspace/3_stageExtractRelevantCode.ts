import { MinionTask } from '../../MinionTask';
import { DEBUG_PROMPTS, DEBUG_RESPONSES } from '../../const';
import { EditorDocument, EditorPosition } from '../../managers/EditorManager';
import { gptExecute } from '../../openai';
import { countTokens } from '../../utils/countTokens';
import { ensureICanRunThis } from '../../utils/ensureIcanRunThis';

export function extractRelevantCodePrompt({
  userQuery,
  selectedText,
  fullFileContents,
  selectionPosition,
  document,
}: {
  userQuery: string;
  selectedText: string;
  fullFileContents: string;
  selectionPosition: EditorPosition;
  document: EditorDocument;
}) {
  return `
You are a line assesment AI system for automatic software development with an IQ of 200.
You are about to cut out all irrelevant code from the file below, so a further part of the system can analyse and execute the TASK on them.
The task to be performed is provided below in TASK section.

# TASK ${selectedText ? `(resolve in context of SELECTED CODE)` : ''}
${userQuery}

${
  selectedText
    ? `
# SELECTED CODE (starts on line ${selectionPosition.line + 1} column: ${
        selectionPosition.character + 1
      } in the file) 
${selectedText}
`
    : ''
}

# FILE (Language: ${document.languageId}) 
${fullFileContents}  

Now for each line of the above file, decide whenever it's relevant to the task or not. If it's relevant output the line as it is. If it's not relevant output a line cointaining exclusivelly "// IRRELEVANT" instead (no original code). Do not output anything else.
`.trim();
}

export async function stageExtractRelevantCode(this: MinionTask) {
  const document = await this.document();
  const userQuery = this.userQuery;
  const selectionPosition = this.selection.start;
  const selectedText = this.selectedText;
  const fullFileContents = this.originalContent;

  const promptWithContext = extractRelevantCodePrompt({
    userQuery,
    selectedText,
    fullFileContents,
    selectionPosition,
    document,
  });

  if (DEBUG_PROMPTS) {
    this.reportSmallProgress();
    this.appendSectionToLog(this.executionStage);
    this.appendToLog('<<<< PROMPT >>>>\n\n');
    this.appendToLog(promptWithContext + '\n\n');
    this.appendToLog('<<<< EXECUTION >>>>\n\n');
  }

  const tokensNeeded = countTokens(fullFileContents, 'QUALITY');

  ensureICanRunThis({
    prompt: promptWithContext,
    mode: 'QUALITY',
    maxTokens: tokensNeeded,
  });

  const { cost } = await gptExecute({
    fullPrompt: promptWithContext,
    onChunk: async (chunk: string) => {
      this.reportSmallProgress();
      if (DEBUG_RESPONSES) {
        this.appendToLog(chunk);
      } else {
        this.appendToLog('.');
      }
    },
    isCancelled: () => {
      return this.stopped;
    },
    maxTokens: tokensNeeded,
    mode: 'FAST',
    outputType: 'string' /*{
      name: "codeSegments",
      description: "Provided code segments",
      parameters: {
        type: "object",
        properties: {
          codeSegments: {
            type: "array",
            items: {
              type: "string",
            },
          },
        },
        required: ["codeSegments"],
      }
    },*/,
    controller: new AbortController(),
  });

  this.totalCost += cost;

  this.appendToLog('\n\n');
}

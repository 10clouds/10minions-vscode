
import * as vscode from "vscode";
import { gptExecute } from "./gptExecute";
import { postMessageToWebView } from "./TenMinionsViewProvider";
import { MessageToWebViewType } from "./Messages";

const BASE_COMMANDS = [
  { command: "Refactor this", timeStamp: Date.now() },
  { command: "Clean this up", timeStamp: Date.now() },
  { command: "How does this work?", timeStamp: Date.now() },
  { command: "Document this", timeStamp: Date.now() },
  { command: "Write tests for this", timeStamp: Date.now() },
  { command: "Make this UI look pretty", timeStamp: Date.now() },
  { command: "Rename this to something sensible", timeStamp: Date.now() },
  { command: "Are there any bugs? Fix them", timeStamp: Date.now() },
  { command: "Rework this so now it also does X", timeStamp: Date.now() },
  { command: "Optimize this for performance", timeStamp: Date.now() },
  { command: "Add error handling to this", timeStamp: Date.now() },
  { command: "Implement this functionality", timeStamp: Date.now() },
  { command: "Migrate this to a different library", timeStamp: Date.now() },
  { command: "Refactor this to use design pattern X", timeStamp: Date.now() },
  { command: "Integrate this with external service X", timeStamp: Date.now() },
];

function shuffledBaseCommands(): { command: string; timeStamp: number }[] {
  const randomizedCommands = BASE_COMMANDS.slice(); // Make a copy of the original array to avoid modifying it
  for (let i = randomizedCommands.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [randomizedCommands[i], randomizedCommands[j]] = [randomizedCommands[j], randomizedCommands[i]];
  }
  return randomizedCommands;
}

export class CommandHistoryManager {

  private commandHistory: { command: string; timeStamp: number }[] = [];
  private _view?: vscode.WebviewView;
  private _context: vscode.ExtensionContext;

  private suggestionProcessing: boolean = false;

  private gptSuggestionController: AbortController = new AbortController();
  private currentSuggestion = "";
  private lastInput?: string = undefined;
  private lastCode?: string = undefined;

  constructor(private context: vscode.ExtensionContext) {
    this._context = context;

    let commandHistory = this.context.globalState.get("10minions.commandHistory");

    //if is not a list - reset
    if (!Array.isArray(commandHistory)) {
      commandHistory = [];
    }

    this.commandHistory = commandHistory as { command: string; timeStamp: number }[];
  }

  updateView(view: vscode.WebviewView) {
    this._view = view;
  }

  cancelSuggestion() {
    // Step 1: Abort the current GPT suggestion
    this.gptSuggestionController.abort();

    // Step 2: Set the suggestionProcessing state to false
    this.suggestionProcessing = false;

    // Step 3: Send a message to the WebView
    postMessageToWebView(this._view, {
      type: MessageToWebViewType.SuggestionLoadedOrCanceled,
    });
  }

  async updateCommandHistory(prompt: string) {
    // Find the index of the existing prompt in the command history
    const commandIndex = this.commandHistory.findIndex((commandObj) => commandObj.command === prompt);

    // Remove the existing prompt from the history if it exists
    if (commandIndex !== -1) {
      this.commandHistory.splice(commandIndex, 1);
    }

    // Add the updated prompt to the beginning of the command history
    this.commandHistory.unshift({ command: prompt, timeStamp: Date.now() });

    // If the command history has more than 1000 commands, remove the oldest ones so the length remains 1000
    if (this.commandHistory.length > 1000) {
      this.commandHistory = this.commandHistory.slice(0, 1000);
    }

    await this._context.globalState.update("10minions.commandHistory", this.commandHistory);
  }

  // Move getRandomPreviousCommands() to CommandHistoryManager
  private getRelatedPreviousCommands(n: number, input: string): string[] {
    // Step 1: Check if command history is empty
    if (this.commandHistory.length === 0) {
      return [];
    }

    // Step 2: Calculate relevance scores for each command in the history
    const scoredItems: { command: string; score: number }[] = this.commandHistory.map((commandObj) => {
      const command = commandObj.command;

      // Calculate matching character count
      let matchingCharCount = 0;
      for (const char of input) {
        if (command.includes(char)) {
          matchingCharCount++;
        }
      }

      const score = matchingCharCount / input.length;

      return { command, score };
    });

    // Step 3: Sort the scored items by score in descending order
    scoredItems.sort((a, b) => b.score - a.score);

    // Add Step 3.5: Filter commands to only keep those with one line and up to 400 characters long
    const filteredItems = scoredItems.filter(item => item.command.length <= 400 && !item.command.includes('\n'));

    // Step 4: Take the top 'n' commands, making sure 'n' is not greater than the length of the filtered command history
    n = Math.min(n, filteredItems.length);
    const relatedCommands = filteredItems.slice(0, n).map((item) => item.command);

    return relatedCommands;
  }

  async getCommandSuggestionGPT(input: string, code: string, languageId: string) {
    if (input.length > 400 || input.includes("\n")) {
      return;
    }
  
    // Abort previous suggestion
    this.gptSuggestionController.abort();
    this.gptSuggestionController = new AbortController();
  
    postMessageToWebView(this._view, {
      type: MessageToWebViewType.SuggestionLoading,
    });
  
    let promptWithContext = `
You are helping the user with crafting a great command.

Your user wants to give a command to an expert senior software architect, with 10 years of experience, experience in numerous projects and up to date knowledge and an IQ of 200.

Your job is to figure out what the user wants, based on his input and selected piece of code (he is suggesting something with that!). Be creative and try to really understand what someone might want to do with that code given what he wrote.

Propose a concise command that will be a very brief description of what needs to be done, you can refer to selected code as the expert will have access to it on another screen.

${input === "" ? `` : `User wrote so far: "${input}". You have to use exactly that as part of your command, as your suggestion will be part of autocompletion.`}

Some examples of commands:
${shuffledBaseCommands().map((c) => `* ${c.command}`).join("\n")}
${this.getRelatedPreviousCommands(10, input)
  .map((c) => `* ${c}`)
  .join("\n")}

Selected code:

\`\`\`${languageId}
${code}
\`\`\`

Try to propose most meaningful thing do to with this code, that will be a good command for the expert to execute.

Your command suggestion, ${input === "" ? `based strictly what you thing someone should do with this code` : `based on "${input}"`}, is:…

  `.trim();
  
    // Implement the custom onChunk function
    const onChunk = async (chunk: string) => {
      this.currentSuggestion += chunk;
    };
  
    this.currentSuggestion = "";
  
    try {
      await gptExecute({ fullPrompt: promptWithContext, onChunk, maxTokens: 100, controller: this.gptSuggestionController, model: "gpt-3.5-turbo" });
      
      // Send the final suggestion after gptExecute has finished execution
      postMessageToWebView(this._view, {
        type: MessageToWebViewType.Suggestion,
        suggestion: stripQuotes(this.currentSuggestion),
        forCode: code,
        forInput: input,
      });

      this.lastCode = code;
      this.lastInput = input;
    } catch (e) {
      console.error(e);
      postMessageToWebView(this._view, {
        type: MessageToWebViewType.SuggestionError,
        error: String(e),
      });
    } finally {
      postMessageToWebView(this._view, {
        type: MessageToWebViewType.SuggestionLoadedOrCanceled,
      });
    }
  }
}

// Remove all leading and ending quotes
function stripQuotes(input: string): string {
  return input.replace(/^"|"$/g, "");
}


/*
Recently applied task: Implement the cancelSuggestion function to properly handle canceling suggestions in the application.
*/

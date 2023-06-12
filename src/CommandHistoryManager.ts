import * as vscode from "vscode";
import { gptExecute } from "./gptExecute";
import { postMessageToWebView } from "./TenMinionsViewProvider";

export class CommandHistoryManager {
  private commandHistory: { command: string; timeStamp: number }[] = [];
  private _view?: vscode.WebviewView;
  private _context: vscode.ExtensionContext;

  constructor(private context: vscode.ExtensionContext) {
    this._context = context;

    let commandHistory = this.context.globalState.get("10minions.commandHistory");

    //if is not a list - reset
    if (!Array.isArray(commandHistory)) {
      this.context.globalState.update("10minions.commandHistory", []);
      commandHistory = [
        { command: "Refactor this", timeStamp: Date.now() },
        { command: "Clean this up", timeStamp: Date.now() },
        { command: "Explain", timeStamp: Date.now() },
        { command: "Make it pretty", timeStamp: Date.now() },
        { command: "Rename this to something sensible", timeStamp: Date.now() },
        { command: "Are there any bugs? Fix them", timeStamp: Date.now() },
        { command: "Rework this so now it also does X", timeStamp: Date.now() },
      ]
    }

    this.commandHistory = commandHistory as { command: string; timeStamp: number }[];
  }

  updateView(view: vscode.WebviewView) {
    this._view = view;
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
  private getRandomPreviousCommands(n: number): string[] {
    // Step 1: Check if command history is empty
    if (this.commandHistory.length === 0) {
      return [];
    }
  
    // Step 2: Make sure 'n' is not greater than the length of the command history
    n = Math.min(n, this.commandHistory.length);
  
    // Step 3: Create an array of unique random indices
    const uniqueIndices: Set<number> = new Set();
    while (uniqueIndices.size < n) {
      const randomIndex = Math.floor(Math.random() * this.commandHistory.length);
      uniqueIndices.add(randomIndex);
    }
  
    // Step 4: Use these indices to return an array of 'n' unique random command strings
    const randomCommands: string[] = [];
    for (const index of uniqueIndices) {
      randomCommands.push(this.commandHistory[index].command);
    }
  
    return randomCommands;
  }

  gptSuggestionController: AbortController = new AbortController();
  currentSuggestion = "";
  lastInput?: string = undefined;
  lastCode?: string = undefined;

  async getCommandSuggestionGPT(input: string, code: string, languageId: string) {
    if (input === this.lastInput && code === this.lastCode)
      return;


    // Abort previous suggestion
    this.gptSuggestionController.abort();
    this.gptSuggestionController = new AbortController();

    if (input.length > 400 || input.includes("\n")) {
      return "";
    }

    this.lastCode = code;
    this.lastInput = input;
    
    const previousCommands = this.getRandomPreviousCommands(10);

    if (input.length === 0) {
      previousCommands[0]
    }

    // Generate a prompt that includes the input and some random previous commands
    
    const previousCommandsSection = `${previousCommands
      .map((c, i) =>
        `
=== COMMAND EXAMPLE ${i + 1} ===
${c}
`.trim()
      )
      .join("\n\n")}
`;

    let promptWithContext = `
You are helping the user with crafting a great command.

Your user wants to give a command to an expert senior software architect, with 10 years of experience, experience in numerous projects and up to date knowledge and an IQ of 200.

Your job is to figure out what the user wants, based on his input and selected piece of code (he is suggesting something with that!). Be creative and try to really understand what someone might want to do with that code given what he wrote.

Propose a concise command that will be a very brief description of what needs to be done, you can refer to selected code as the expert will have access to it on another screen.

User wrote so far: "${input}". You have to use exactly that as part of your command, as your suggestion will be part of autocompletion.

=== USER INPUT ===
${input}

${previousCommandsSection}

===== SELECTED CODE (Language: ${languageId}) ====
${code}


Your command suggestion, based on "${input}", is:…

`.trim();

    // Implement the custom onChunk function
    const onChunk = async (chunk: string) => {
      this.currentSuggestion += chunk;
      postMessageToWebView(this._view, {
        type: "suggestion",
        value: stripQuotes(this.currentSuggestion),
      });
    };

    console.log("SUGGESTION1");
    console.log(promptWithContext);
    console.log("SUGGESTION2");

    this.currentSuggestion = "";

    // Modify the gptExecute call to pass the custom onChunk function
    await gptExecute({ fullPrompt: promptWithContext, onChunk, maxTokens: 100, controller: this.gptSuggestionController, model: "gpt-3.5-turbo"});
  }

  getCommandSuggestion(input: string) {
    if (!input) return "";

    const suggestions = this.commandHistory.filter(
      (commandObj) => commandObj.command.toLowerCase().includes(input.toLowerCase()) && commandObj.command.toLowerCase() !== input.toLowerCase()
    );

    if (suggestions.length === 0) return "";

    const matchedCommand = suggestions[0].command;
    const index = matchedCommand.toLowerCase().indexOf(input.toLowerCase());
    const commandWithCorrectedCase = matchedCommand.slice(0, index) + input + matchedCommand.slice(index + input.length);
    return commandWithCorrectedCase;
  }
}

// Remove all leading and ending quotes
function stripQuotes(input: string): string {
  return input.replace(/^"|"$/g, '');
}

/*
Recently applied task: Fix this
*/

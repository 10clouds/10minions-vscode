import * as vscode from "vscode";
import { gptExecute } from "./gptExecute";
import { postMessageToWebView } from "./TenMinionsViewProvider";

export class CommandHistoryManager {
  private commandHistory: Record<string, { timeStamp: number }> = {};
  private _view?: vscode.WebviewView;
  private _context: vscode.ExtensionContext;

  constructor(private context: vscode.ExtensionContext) {
    this._context = context;
    this.commandHistory = this.context.globalState.get("10minions.commandHistory") || {
      "Refactor this": { timeStamp: Date.now() },
      "Clean this up": { timeStamp: Date.now() },
      Explain: { timeStamp: Date.now() },
      "Make it pretty": { timeStamp: Date.now() },
      "Rename this to something sensible": { timeStamp: Date.now() },
      "Are there any bugs? Fix them": { timeStamp: Date.now() },
      "Rework this so now it also does X": { timeStamp: Date.now() },
    };
  }

  updateView(view: vscode.WebviewView) {
    this._view = view;
  }

  async updateCommandHistory(prompt: string) {
    const newCommandHistory = { ...this.commandHistory };

    if (newCommandHistory[prompt]) {
      newCommandHistory[prompt] = { timeStamp: Date.now() };
    } else {
      newCommandHistory[prompt] = { timeStamp: Date.now() };
    }

    this.commandHistory = newCommandHistory;
    await this._context.globalState.update("10minions.commandHistory", newCommandHistory);
  }

  // Move getRandomPreviousCommands() to CommandHistoryManager
  private getRandomPreviousCommands(n: number): string[] {
    const previousCommands = Object.keys(this.commandHistory);
    const randomizedCommands = previousCommands.sort(() => Math.random() - 0.5).slice(0, n);
    return randomizedCommands;
  }

  async getCommandSuggestionGPT(input: string) {
    if (!input) return "";

    // Generate a prompt that includes the input and some random previous commands
    const previousCommands = this.getRandomPreviousCommands(3);
    const prompt = `Based on the current input "${input}" and considering previous commands ${previousCommands.join(
      ", "
    )}, what would be the best command suggestion?`;

    let result = "";

    // Implement the custom onChunk function
    const onChunk = async (chunk: string) => {
      result += chunk;
      postMessageToWebView(this._view, {
        type: "suggestion",
        value: result,
      });
    };

    // Modify the gptExecute call to pass the custom onChunk function
    const suggestion = await gptExecute({ fullPrompt: prompt, onChunk, maxTokens: 50 });

    return suggestion;
  }

  getCommandSuggestion(input: string) {
    if (!input) return "";

    const ONE_DAY = 24 * 60 * 60 * 1000;

    const suggestions = Object.keys(this.commandHistory)
      .filter((command) => command.toLowerCase().includes(input.toLowerCase()) && command.toLowerCase() !== input.toLowerCase())
      .map((command) => {
        const { timeStamp } = this.commandHistory[command];
        const daysOld = Math.floor((Date.now() - timeStamp) / ONE_DAY);
        return { command, weight: -daysOld, originalCommand: command };
      })
      .sort((a, b) => b.weight - a.weight);

    if (suggestions.length === 0) return "";

    const matchedCommand = suggestions[0].originalCommand;
    const index = matchedCommand.toLowerCase().indexOf(input.toLowerCase());
    const commandWithCorrectedCase = matchedCommand.slice(0, index) + input + matchedCommand.slice(index + input.length);
    return commandWithCorrectedCase;
  }
}

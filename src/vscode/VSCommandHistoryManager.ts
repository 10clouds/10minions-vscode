
import * as vscode from "vscode";
import { MessageToWebViewType } from "../Messages";
import { CommandHistoryManager, setCommandHistoryManager } from "../managers/CommandHistoryManager";
import { getViewProvider } from "../managers/ViewProvider";

const BASE_COMMANDS = [
  { command: "Refactor this" },
  { command: "Clean this up" },
  { command: "How does this work?" },
  { command: "Document this" },
  { command: "Write tests for this" },
  { command: "Make this UI look pretty" },
  { command: "Rename this to something sensible" },
  { command: "Are there any bugs? Fix them" },
  { command: "Rework this so now it also does X" },
  { command: "Optimize this for performance" },
  { command: "Add error handling to this" },
  { command: "Implement this functionality" },
  { command: "Migrate this to a different library" },
  { command: "Refactor this to use design pattern X" },
  { command: "Integrate this with external service X" },
];

export class VSCommandHistoryManager implements CommandHistoryManager {

  private commandHistory: { command: string; }[] = [];
  private _context: vscode.ExtensionContext;


  constructor(private context: vscode.ExtensionContext) {
    this._context = context;

    let commandHistory = this.context.globalState.get("10minions.commandHistory");

    //if is not a list - reset
    if (!Array.isArray(commandHistory)) {
      commandHistory = [];
    }

    this.commandHistory = commandHistory as { command: string; timeStamp: number }[];

    setCommandHistoryManager(this);
  }


  async updateCommandHistory(prompt: string) {
    // Remove any matching commands from the command history
    this.commandHistory = this.commandHistory.filter((commandObj) => commandObj.command.toLowerCase() !== prompt.toLowerCase());
    
    // Add the updated prompt to the beginning of the command history
    this.commandHistory.unshift({ command: prompt });

    // If the command history has more than 1000 commands, remove the oldest ones so the length remains 1000
    if (this.commandHistory.length > 1000) {
      this.commandHistory = this.commandHistory.slice(0, 1000);
    }

    await this._context.globalState.update("10minions.commandHistory", this.commandHistory);
  }

  // Move getRandomPreviousCommands() to CommandHistoryManager
  private getRelatedPreviousCommands(input: string): string[] {
  // Split into two searches 
  let historyToSearchCommandHistory = [...this.commandHistory];
  let historyToSearchBaseCommands = [...BASE_COMMANDS];

  // Step 2: Calculate relevance scores for each command in the history
  let scoredItemsCommandHistory: { command: string; score: number }[] = historyToSearchCommandHistory.map((commandObj) => {
    const command = commandObj.command;
    const score = (command.toLowerCase().includes(input.toLowerCase()) && command.toLowerCase() !== input.toLowerCase()) ? 1 : 0;
    return { command, score };
  });
  let scoredItemsBaseCommands: { command: string; score: number }[] = historyToSearchBaseCommands.map((commandObj) => {
    const command = commandObj.command;
    const score = (command.toLowerCase().includes(input.toLowerCase()) && command.toLowerCase() !== input.toLowerCase()) ? 1 : 0;
    return { command, score };
  });

  // Add Step 3.5: Filter commands to only keep those with one line and up to 400 characters long
  scoredItemsCommandHistory = scoredItemsCommandHistory.filter(item => item.score > 0 && item.command.length <= 400 && !item.command.includes('\n'));
  scoredItemsBaseCommands = scoredItemsBaseCommands.filter(item => item.score > 0 && item.command.length <= 400 && !item.command.includes('\n'));

  // Step 4: Restrict the command history to 5 items
  scoredItemsCommandHistory = scoredItemsCommandHistory.slice(0, 7);
  
  // Restrict the base commands to 2 items
  scoredItemsBaseCommands = scoredItemsBaseCommands.slice(0, 3);

  // Combine and return the two lists
  return [...scoredItemsCommandHistory, ...scoredItemsBaseCommands].map((item) => item.command);
}

  async sendCommandSuggestions(input: string) {
    let suggestions = this.getRelatedPreviousCommands(input) || "";
    
    getViewProvider().postMessageToWebView({
      type: MessageToWebViewType.Suggestions,
      suggestions,
      forInput: input,
    });

    return;
  }
}

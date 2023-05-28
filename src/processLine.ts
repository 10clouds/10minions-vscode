import { AICursor } from "./AICursor";
import { MappedContent } from "./MappedContent";
import { COMMANDS } from "./commands";
import { insertIntoNewDocument } from "./insertIntoNewDocument";

export async function processLine(
  aiCursor: AICursor,
  line: string,
  mappedContent: MappedContent) {

  let potentialCommand = line.trim();

  let matchingCommands = Object.entries(COMMANDS).filter(([key, value]) => potentialCommand.startsWith(key));

  if (matchingCommands.length > 1) {
    throw new Error(`Ambiguous command: ${potentialCommand}`);
  }

  if (matchingCommands.length === 1) {
    let [key, value] = matchingCommands[0];

    console.log("COMMAND", potentialCommand);

    await value.execute(aiCursor, potentialCommand, mappedContent);
  } else {

    console.log("LINE", potentialCommand);

    await insertIntoNewDocument(aiCursor, line);
  }
}

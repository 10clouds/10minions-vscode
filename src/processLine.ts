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

  //pick the shortest command
  matchingCommands.sort((a, b) => a[0].length - b[0].length);

  if (matchingCommands.length >= 1) {
    let [key, value] = matchingCommands[0];
  
    console.log(`COMMAND ${potentialCommand} (${key})`);

    await value.execute(aiCursor, potentialCommand, mappedContent);
  } else {

    console.log("LINE", potentialCommand);

    await insertIntoNewDocument(aiCursor, line);
  }
}

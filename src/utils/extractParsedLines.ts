import { DEBUG_RESPONSES } from '../const';
import { ParsedLine } from '../types';

export function extractParsedLines(
  chunkBuffer: string,
): [ParsedLine[], string] {
  const parsedLines: ParsedLine[] = [];

  while (chunkBuffer.includes('\n')) {
    if (chunkBuffer.startsWith('\n')) {
      chunkBuffer = chunkBuffer.slice(1);
      continue;
    }

    if (chunkBuffer.startsWith('data: ')) {
      const [line, ...rest] = chunkBuffer.split('\n');
      chunkBuffer = rest.join('\n');

      if (DEBUG_RESPONSES) {
        console.log(line);
      }

      if (line === 'data: [DONE]') continue;

      const parsedLine = line.replace(/^data: /, '').trim();
      if (parsedLine !== '') {
        try {
          parsedLines.push(JSON.parse(parsedLine));
        } catch (e) {
          console.error(`Error parsing chunk: ${line}`);
          throw e;
        }
      }
    } else {
      const errorObject = JSON.parse(chunkBuffer);

      if (errorObject.error) {
        throw new Error(JSON.stringify(errorObject));
      } else {
        throw new Error(`Unexpected JSON object: ${chunkBuffer}`);
      }
    }
  }

  return [parsedLines, chunkBuffer];
}

import AsyncLock from 'async-lock';
import { CANCELED_STAGE_NAME } from '../ui/MinionTaskUIInfo';
import { extractParsedLines } from './extractParsedLines';
import { Response } from 'node-fetch';

const openAILock = new AsyncLock();

/* The processOpenAIResponseStream function processes the response from the
 * API and extracts tokens from the response stream. */
export async function processOpenAIResponseStream({
  response,
  onChunk,
  isCancelled,
  controller,
}: {
  response: Response;
  onChunk: (chunk: string) => Promise<void>;
  isCancelled: () => boolean;
  controller: AbortController;
}) {
  const stream = response?.body;
  const decoder = new TextDecoder('utf-8');
  let fullContent = '';
  let chunkBuffer = '';

  return await new Promise<string>((resolve, reject) => {
    stream?.on('data', async (value) => {
      try {
        if (isCancelled() || controller.signal.aborted) {
          stream.removeAllListeners();
          reject(CANCELED_STAGE_NAME);
          return;
        }
        const chunk = decoder.decode(value);
        chunkBuffer += chunk;

        const [parsedLines, newChunkBuffer] = extractParsedLines(chunkBuffer);

        chunkBuffer = newChunkBuffer;

        for (const parsedLine of parsedLines) {
          if (parsedLine.error) {
            throw new Error(parsedLine.error.message);
          }
        }

        const tokens = parsedLines
          .map(
            (l) =>
              l.choices[0].delta.content ||
              l.choices[0].delta.function_call?.arguments ||
              '',
          )
          .filter((c) => c)
          .join('');

        await openAILock.acquire('openAI', async () => {
          await onChunk(tokens);
        });

        fullContent += tokens;
      } catch (e) {
        console.error('Error processing response stream: ', e, value);
        reject(e);
      }
    });

    stream?.on('end', () => {
      if (isCancelled() || controller.signal.aborted) {
        stream.removeAllListeners();
        reject(CANCELED_STAGE_NAME);
        return;
      }
      resolve(fullContent);
    });

    stream?.on('error', (err) => {
      console.error('Error: ', err);
      reject(err);
    });
  });
}

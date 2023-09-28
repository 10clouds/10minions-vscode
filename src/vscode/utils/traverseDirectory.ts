import { WorkspaceFileData } from '10minions-engine/dist/src/minionTasks/mutators/mutateCreateFileDescription';
import { readdirSync, statSync, readFileSync } from 'fs';
import path from 'path';
import { shouldSkipFile } from './shouldSkipFile';
export async function traverseDirectory(
  directoryPath: string,
  fileList: WorkspaceFileData[],
) {
  const items = readdirSync(directoryPath);

  for (const item of items) {
    if (item.startsWith('.')) {
      continue; // Skip hidden files
    }

    const itemPath = path.join(directoryPath, item);
    const stats = statSync(itemPath);
    if (stats.isFile()) {
      const shouldSkip = await shouldSkipFile(itemPath);

      if (!shouldSkip) {
        const fileContent = readFileSync(itemPath, 'utf-8');
        fileList.push({
          path: itemPath,
          content: fileContent,
        });
      }
    } else if (stats.isDirectory()) {
      await traverseDirectory(itemPath, fileList);
    }
  }
}

import path from 'path';
import { existsSync } from 'fs';
import { readFile } from 'node:fs/promises';

function findGitIgnore() {
  let dirPath = __dirname;

  while (dirPath !== '/') {
    const potentialPath = path.join(dirPath, '.gitignore');

    if (existsSync(potentialPath)) {
      return potentialPath;
    }

    // If not found, go one level up
    dirPath = path.dirname(dirPath);
  }
}

export async function shouldSkipFile(filePath: string): Promise<boolean> {
  const gitignorePath = findGitIgnore();

  if (!gitignorePath) {
    throw Error('No .gitignore file found');
  }

  try {
    const gitignoreContent = await readFile(gitignorePath, 'utf-8');

    const patterns = gitignoreContent
      .split('\n')
      .filter((line) => !!line.trim());

    return patterns.some((pattern) => {
      return filePath.includes(pattern);
    });
  } catch (error) {
    console.log(error);
    return false;
  }
}

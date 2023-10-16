import * as path from 'path';
import { readFile } from 'fs/promises';
import fg from 'fast-glob';

export interface ImportedFile {
  path: string;
  importedData: string[];
  fileContent: string;
}

const MAXIMUM_LINES_WITHOUT_IMPORT = 10;

export const readFilesFromImports = async (
  filePath: string,
  fileContent: string,
): Promise<ImportedFile[]> => {
  const importInfoArray: ImportedFile[] = [];
  const importRegex = /^import\s+{([^}]+)}\s+from\s+(?:"([^"]+)"|'([^']+)');/;
  const lines = fileContent.split('\n');
  let currentImportStatement = '';
  let lineWithoutImportCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lineWithoutImportCounter > MAXIMUM_LINES_WITHOUT_IMPORT) {
      console.error('Too many lines without import statement.');
      break;
    }
    const line = lines[i];
    currentImportStatement += line.trim();

    if (line.trim().endsWith(';') || line.trim().endsWith('\n')) {
      const match = currentImportStatement.match(importRegex);

      if (match) {
        const importPath = match[2] || match[3];

        try {
          const resolvedPath = path.resolve(path.dirname(filePath), importPath);
          const baseDirectory = path.dirname(resolvedPath);
          const fileNameWithoutExtension = path.parse(resolvedPath).name;

          const importedSymbols = match[1]
            .split(',')
            .filter((symbol) => symbol !== '')
            .map((symbol) => symbol.trim());

          const files = await fg('**/*.*', {
            cwd: baseDirectory,
          });

          const foundFile = files.find((file) => {
            const parsedFileName = path.parse(file).name;
            return parsedFileName === fileNameWithoutExtension;
          });

          if (foundFile) {
            const filePath = path.join(baseDirectory, foundFile);
            console.log('Found file:', filePath);
            importInfoArray.push({
              importedData: importedSymbols,
              path: filePath,
              fileContent: await readFile(filePath, 'utf8'),
            });
          } else {
            console.log('File not found in the directory.');
          }
        } catch (error) {
          console.error(error);
        }
      } else {
        lineWithoutImportCounter++;
      }
      currentImportStatement = '';
    }
  }

  return importInfoArray;
};

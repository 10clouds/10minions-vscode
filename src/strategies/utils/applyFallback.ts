import { MinionTask } from '../../MinionTask';
import { getEditorManager } from '../../managers/EditorManager';
import { decomposeMarkdownString } from './decomposeMarkdownString';

export const LOG_PLAIN_COMMENT_MARKER = `\nPLAIN COMMENT FALLBACK\n`;

export async function applyFallback(minionTask: MinionTask) {
  const document = await minionTask.document();
  const language = document.languageId || 'javascript';

  const decomposedString = decomposeMarkdownString(
    `
Task: ${minionTask.userQuery}

${minionTask.modificationDescription}
`.trim(),
    language,
  ).join('\n');

  minionTask.appendToLog(LOG_PLAIN_COMMENT_MARKER);

  minionTask.originalContent = document.getText();

  await getEditorManager().applyWorkspaceEdit(async (edit) => {
    edit.insert(
      minionTask.documentURI,
      { line: 0, character: 0 },
      decomposedString + '\n',
    );
  });

  getEditorManager().showInformationMessage(
    `Modification applied successfully.`,
  );
}

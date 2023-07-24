import { readFileSync } from 'fs';
import path from 'path';
import {
  AnalyticsManager,
  setAnalyticsManager,
} from '../managers/AnalyticsManager';
import { ConsumingOpenAICacheManager } from '../managers/ConsumingOpenAICacheManager';
import { setEditorManager } from '../managers/EditorManager';
import { setLogProvider } from '../managers/LogProvider';
import { setOriginalContentProvider } from '../managers/OriginalContentProvider';
import { setOpenAIApiKey } from '../openai';
import { CLIEditorManager } from './CLIEditorManager';
import { setOpenAICacheManager } from '../managers/OpenAICacheManager';

export function initCLISystems() {
  const baseDir = path.resolve(__dirname);
  setOpenAIApiKey(
    JSON.parse(readFileSync(path.resolve(baseDir, 'openAIKey.json'), 'utf8'))
      .openAIKey,
  );

  setOpenAICacheManager(undefined);
  const openAiCacheManager = new ConsumingOpenAICacheManager(
    JSON.parse(
      readFileSync(path.resolve(baseDir, 'serviceAccount.json'), 'utf8'),
    ),
  );

  setOpenAICacheManager(openAiCacheManager);

  const analyticsManager = new AnalyticsManager(
    'CLIInstallationID',
    'CLIVsCodeStub',
  );
  analyticsManager.setSendDiagnosticsData(true);

  setAnalyticsManager(analyticsManager);
}

const reportChange = (uri: string) => {
  // TODO
  console.log(uri);
};

export function setupCLISystemsForTest() {
  setLogProvider(undefined);
  setOriginalContentProvider(undefined);
  setEditorManager(undefined);

  setLogProvider({
    reportChange,
  });

  setOriginalContentProvider({
    reportChange,
  });

  setEditorManager(new CLIEditorManager());
}

import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  MessageToVSCodeType,
  MessageToWebView,
  MessageToWebViewType,
} from '10minions-engine/dist/src/managers/Messages';
import { MissingApiKeyInfoMessage } from './MissingApiKeyInfoMessage';
import { GoButton } from './GoButton';
import { Header } from './Header';
import { MinionTasksList } from './MinionTasksList';
import { MinionTaskUIInfo } from '10minions-engine/dist/src/managers/MinionTaskUIInfo';
import { useTemporaryFlag } from './useTemporaryFlag';
import { getRobotOutlineIcons } from './utils/getRobotOutlineIcons';
import { useSuggestions } from './hooks/useSuggestions';
import SidebarSuggestions from './SidebarSuggestions';
import { postMessageToVsCode } from './utils/postMessageToVsCode';
import SidebarFooter from './SidebarFooter';
import Spinner from './Spinner';
import { ProgressBar } from './ProgressBar';

const [RobotIcon1, RobotIcon2] = getRobotOutlineIcons();
// TODO: Make styles refactor
export const Sidebar = () => {
  const [userInputPrompt, setUserInputPrompt] = useState('');
  const [progressData, setProgressData] = useState<{
    progress: number;
    inProgress: boolean;
    currentFilePath?: string;
  }>({ progress: 0, inProgress: false });

  const { progress, inProgress } = progressData;

  const {
    handleSuggestionClick,
    nextSuggestion,
    previousSuggestion,
    setNewSuggestions,
    clearSuggestions,
    handleKeyDown,
    suggestions,
    suggestionIndex,
    currentSuggestion,
  } = useSuggestions(setUserInputPrompt, userInputPrompt);

  const [executionList, setExecutionList] = useState<MinionTaskUIInfo[]>([]);
  const [apiKeySet, setApiKeySet] = useState<true | false | undefined>(
    undefined,
  );
  const [missingApiModels, setMissingApiModels] = useState<
    string[] | undefined
  >(undefined);
  const [isGoClicked, setGoClicked] = useTemporaryFlag();
  const [selectedCode, setSelectedCode] = useState('');

  const textAreaRef = React.useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (apiKeySet) {
      postMessageToVsCode({ type: MessageToVSCodeType.GET_WORKSPACE_FILES });
    }
  }, [apiKeySet]);

  function clearAndFocusTextarea() {
    setUserInputPrompt('');
    textAreaRef.current?.focus();
  }

  function handleExecutionsUpdated(executions: MinionTaskUIInfo[]) {
    setExecutionList(executions);
  }

  const submitCommand = () => {
    if (isGoClicked) return;
    postMessageToVsCode({
      type: MessageToVSCodeType.NEW_MINION_TASK,
      value: userInputPrompt || currentSuggestion,
    });
    setGoClicked();
    setUserInputPrompt('');
    clearSuggestions();
  };

  const handleMessage = (event: MessageEvent<MessageToWebView>) => {
    const message = event.data;
    console.log('CMD (webview)', message.type);

    switch (message.type) {
      case MessageToWebViewType.CLEAR_AND_FOCUS_ON_INPUT:
        clearAndFocusTextarea();
        break;
      case MessageToWebViewType.EXECUTIONS_UPDATED:
        handleExecutionsUpdated(message.executions);
        break;
      case MessageToWebViewType.API_KEY_SET:
        setApiKeySet(message.value);
        break;
      case MessageToWebViewType.API_KEY_MISSING_MODELS:
        console.log('api models');
        setMissingApiModels(message.models);
        break;
      case MessageToWebViewType.UPDATE_FILE_LOADING_STATUS:
        console.log('UI: ', message.progress, message.inProgress);
        setProgressData({
          progress: message.progress,
          inProgress: message.inProgress,
        });
        break;
      case MessageToWebViewType.SUGGESTIONS:
        if (message.forInput === userInputPrompt) {
          setNewSuggestions(message.suggestions);
        }
        break;
      case MessageToWebViewType.CHOSEN_CODE_UPDATED:
        setSelectedCode(message.code);
        break;
      default:
    }
  };

  useEffect(() => {
    window.addEventListener('message', handleMessage);

    postMessageToVsCode({ type: MessageToVSCodeType.READY_FOR_MESSAGES });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCode, userInputPrompt]);

  const apiKeySetContentHandler = () => {
    switch (apiKeySet) {
      case undefined:
        return <Spinner />;
      case false:
        return <MissingApiKeyInfoMessage />;
      case true:
        return missingApiModels && missingApiModels?.length > 0 ? (
          <MissingApiKeyInfoMessage missingModels={missingApiModels} />
        ) : inProgress ? (
          <>
            <div className="flex items-center mt-3">
              <div
                className="w-full"
                title="Fetching information about project"
              >
                <ProgressBar progress={progress} stopped={!inProgress} />
              </div>
            </div>
            <p className="text-sm mt-3 italic">
              Gathering knowledge about your project, it may take a while, don't
              worry this is a one-time procedure.
            </p>
          </>
        ) : (
          <>
            <div className="mb-2 text-sm">
              Summon a Minion! Jot down your coding task and delegate to your
              loyal Minion. For pinpoint precision, select the code involved.{' '}
            </div>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    color: 'rgba(var(--vscode-editor-foreground), 0.5)', // Grayed-out text color
                    alignItems: 'baseline',
                  }}
                >
                  <textarea
                    ref={textAreaRef}
                    disabled={inProgress}
                    style={{
                      position: 'relative',
                      height: '12rem',
                      backgroundColor: 'var(--vscode-editor-background)',
                      borderColor: 'var(--vscode-focusBorder)',
                    }}
                    className="w-full h-96 mb-3 p-4 text-sm resize-none focus:outline-none"
                    value={userInputPrompt}
                    onChange={(e) => {
                      setUserInputPrompt(e.target.value);
                    }}
                    onKeyDown={handleKeyDown(submitCommand)}
                  />
                </div>
                <SidebarSuggestions
                  suggestionIndex={suggestionIndex}
                  suggestions={suggestions}
                  previousSuggestion={previousSuggestion}
                  nextSuggestion={nextSuggestion}
                  textAreaRef={textAreaRef}
                  onClick={handleSuggestionClick}
                  userInputPrompt={userInputPrompt}
                  currentSuggestion={currentSuggestion}
                />
                <GoButton onClick={submitCommand} clicked={isGoClicked} />
                <MinionTasksList executionList={executionList} />
              </div>
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full">
      <div className="p-4 mb-16 w-full">
        <Header leftIcon={RobotIcon1} rightIcon={RobotIcon2} />
        {apiKeySetContentHandler()}
      </div>
      <SidebarFooter />
    </div>
  );
};

const container = document.getElementById('root');
if (!container) throw new Error('Could not find root container element');
const root = createRoot(container);
root.render(<Sidebar />);

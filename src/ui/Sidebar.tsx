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

const [RobotIcon1, RobotIcon2] = getRobotOutlineIcons();
// TODO: Make styles refactor
export const Sidebar = () => {
  const [userInputPrompt, setUserInputPrompt] = useState('');
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

  function handleMessage(event: MessageEvent<MessageToWebView>) {
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
        setMissingApiModels(message.models);
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
  }

  useEffect(() => {
    window.addEventListener('message', handleMessage);

    postMessageToVsCode({ type: MessageToVSCodeType.READY_FOR_MESSAGES });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [selectedCode, userInputPrompt]);

  const apiKeySetContentHanlder = () => {
    switch (apiKeySet) {
      case undefined:
        return <Spinner />;
      case false:
        return <MissingApiKeyInfoMessage />;
      case true:
        return missingApiModels && missingApiModels?.length > 0 ? (
          <MissingApiKeyInfoMessage missingModels={missingApiModels} />
        ) : (
          <>
            <div className="mb-2">
              Summon a Minion! Jot down your coding task and delegate to your
              loyal Minion. Remember, each Minion lives in a context of a
              specific file. For pinpoint precision, select the code involved.{' '}
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
                </div>
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
        {apiKeySetContentHanlder()}
      </div>
      <SidebarFooter />
    </div>
  );
};

const container = document.getElementById('root');
if (!container) throw new Error('Could not find root container element');
const root = createRoot(container);
root.render(<Sidebar />);

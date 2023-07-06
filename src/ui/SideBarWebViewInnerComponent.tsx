import * as React from 'react';
import { createRoot } from 'react-dom/client';
import {
  MessageToVSCode,
  MessageToVSCodeType,
  MessageToWebView,
  MessageToWebViewType,
} from '../Messages';
import { MissingApiKeyInfoMessage } from './MissingApiKeyInfoMessage';
import { GoButton } from './GoButton';
import { Header } from './Header';
import { Logo } from './Logo';
import { ALL_MINION_ICONS_OUTLINE } from './MinionIconsOutline';
import { MinionTaskListComponent } from './MinionTaskListComponent';
import { MinionTaskUIInfo } from './MinionTaskUIInfo';
import { useTemporaryFlag } from './useTemporaryFlag';

declare const acquireVsCodeApi: any;

const vscode = acquireVsCodeApi();

export function postMessageToVsCode(message: MessageToVSCode) {
  vscode.postMessage(message);
}

export const SideBarWebViewInnerComponent: React.FC = () => {
  const [userInputPrompt, setUserInputPrompt] = React.useState('');
  const [executionList, setExecutionList] = React.useState<MinionTaskUIInfo[]>(
    [],
  );
  const [apiKeySet, setApiKeySet] = React.useState<true | false | undefined>(
    undefined,
  );
  const [missingApiModels, setMissingApiModels] = React.useState<
    string[] | undefined
  >(undefined);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [suggestionIndex, setSuggestionIndex] = React.useState(0);
  const [justClickedGo, markJustClickedGo] = useTemporaryFlag();
  const [isSidebarVisible, setIsSidebarVisible] = React.useState(true);

  const [selectedCode, setSelectedCode] = React.useState('');
  const [suggestionInputBase, setSuggestionInputBase] = React.useState<
    string | undefined
  >(undefined);
  const [isTextAreaFocused, setIsTextAreaFocused] = React.useState(false);

  const [RobotIcon1, RobotIcon2] = React.useMemo(() => {
    const randomIndex = Math.floor(
      Math.random() * ALL_MINION_ICONS_OUTLINE.length,
    );
    return [
      ALL_MINION_ICONS_OUTLINE[randomIndex],
      ALL_MINION_ICONS_OUTLINE[
        (randomIndex + 1) % ALL_MINION_ICONS_OUTLINE.length
      ],
    ];
  }, []);

  const textAreaRef = React.useRef<HTMLTextAreaElement>(null);

  function handleClearAndFocus() {
    setUserInputPrompt('');
    const input = document.querySelector('textarea');
    input?.focus();
  }

  function handleExecutionsUpdated(executions: MinionTaskUIInfo[]) {
    setExecutionList(executions);
  }

  function handleSuggestionClick(command: string) {
    setUserInputPrompt(command);
    setSuggestions([]);
  }

  function handleSubmitCommand() {
    postMessageToVsCode({
      type: MessageToVSCodeType.NewMinionTask,
      value: userInputPrompt || suggestions[suggestionIndex],
    });
    markJustClickedGo();
    setUserInputPrompt('');
    setSuggestions([]);
    setSuggestionInputBase(undefined);
  }

  function handlePreviousSuggestion(e?: React.MouseEvent<HTMLButtonElement>) {
    setSuggestionIndex(
      (suggestionIndex + suggestions.length - 1) % suggestions.length,
    );
  }

  function handleNextSuggestion(e?: React.MouseEvent<HTMLButtonElement>) {
    setSuggestionIndex((suggestionIndex + 1) % suggestions.length);
  }

  React.useEffect(() => {
    const eventHandler = (event: any) => {
      const message: MessageToWebView = event.data;
      handleMessage(message);

      function handleMessage(message: MessageToWebView) {
        console.log('CMD (webview)', message.type);

        switch (message.type) {
          case MessageToWebViewType.ClearAndFocusOnInput:
            handleClearAndFocus();
            break;
          case MessageToWebViewType.ExecutionsUpdated:
            handleExecutionsUpdated(message.executions);
            break;
          case MessageToWebViewType.ApiKeySet:
            setApiKeySet(message.value);
            break;
          case MessageToWebViewType.ApiKeyMissingModels:
            setMissingApiModels(message.models);
            break;
          case MessageToWebViewType.UpdateSidebarVisibility:
            setIsSidebarVisible(message.value);
            break;
          case MessageToWebViewType.Suggestions:
            if (message.forInput === userInputPrompt) {
              setSuggestions(message.suggestions);
              setSuggestionIndex(0);
            }
            break;
          case MessageToWebViewType.ChosenCodeUpdated:
            setSelectedCode(message.code);
            break;
        }
      }
    };

    window.addEventListener('message', eventHandler);

    postMessageToVsCode({ type: MessageToVSCodeType.ReadyForMessages });

    return () => {
      window.removeEventListener('message', eventHandler);
    };
  }, [selectedCode, userInputPrompt]);

  React.useEffect(() => {
    if (suggestionInputBase !== userInputPrompt) {
      setSuggestionInputBase(userInputPrompt);
      postMessageToVsCode({
        type: MessageToVSCodeType.SuggestionGet,
        input: userInputPrompt,
      });
    }
  }, [userInputPrompt, suggestionInputBase]);

  const userInputStartsSuggestion = userInputPrompt.length === 0; //suggestions[suggestionIndex] && suggestions[suggestionIndex].toLowerCase().startsWith(userInputPrompt.toLowerCase());

  return (
    <div className="w-full">
      <div className="p-4 mb-16">
        <Header RobotIcon1={RobotIcon1} RobotIcon2={RobotIcon2} />

        {apiKeySet === false && <MissingApiKeyInfoMessage />}
        {apiKeySet === true && !!missingApiModels?.length && (
          <MissingApiKeyInfoMessage missingModels={missingApiModels} />
        )}

        {apiKeySet === true && missingApiModels?.length === 0 && (
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
                    onFocus={() => {
                      setIsTextAreaFocused(true);
                    }}
                    onBlur={() => {
                      setIsTextAreaFocused(false);
                    }}
                    onKeyDown={(e) => {
                      // Get current cursor position in textarea
                      const cursorPositionStart =
                        e.currentTarget.selectionStart ?? 0;
                      const cursorPositionEnd =
                        e.currentTarget.selectionEnd ?? 0;
                      const textAreaContent = e.currentTarget.value;

                      // If left arrow key pressed and cursor is at the beginning of the content
                      if (
                        (e.key === 'ArrowLeft' || e.key === 'ArrowUp') &&
                        cursorPositionStart === 0 &&
                        cursorPositionEnd === 0
                      ) {
                        handlePreviousSuggestion();
                      }
                      // If right arrow key pressed and cursor is at the end of the content
                      else if (
                        (e.key === 'ArrowRight' || e.key === 'ArrowDown') &&
                        cursorPositionStart === textAreaContent.length &&
                        cursorPositionEnd === textAreaContent.length
                      ) {
                        handleNextSuggestion();
                      }

                      // Check for Tab key and if the selectedSuggestion is valid
                      if (
                        e.key === 'Tab' &&
                        suggestions[suggestionIndex] &&
                        suggestions[suggestionIndex].length > 0
                      ) {
                        e.preventDefault(); // Prevent default tab behavior
                        handleSuggestionClick(suggestions[suggestionIndex]);
                      }
                      // Check for Enter key and if the Shift key is NOT pressed
                      else if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault(); // Prevent default line break behavior

                        if (justClickedGo) return; // Prevent double submission
                        // Submit userInputPrompt by calling postMessageToVsCode function
                        handleSubmitCommand();
                      }
                    }}
                  />

                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      height: '12rem',
                      pointerEvents: 'none',
                      color: 'rgba(var(--vscode-editor-foreground), 0.5)',
                      overflow: 'hidden',
                      whiteSpace: 'pre-wrap',
                      zIndex: 1000,
                    }}
                    className="w-full h-96 p-4 text-sm resize-none focus:outline-none pointer-events-none"
                  >
                    <span style={{ opacity: 0.0 }}>{userInputPrompt}</span>
                    {!userInputStartsSuggestion && (
                      <>
                        <br />
                        <br />
                      </>
                    )}
                    {!userInputStartsSuggestion && suggestions.length > 0 && (
                      <span style={{ opacity: 0.4 }}>
                        Suggestion:
                        <br />
                      </span>
                    )}
                    {
                      <span style={{ opacity: 0.6 }}>
                        {userInputStartsSuggestion
                          ? suggestions[suggestionIndex]?.slice(
                              userInputPrompt.length,
                            )
                          : suggestions[suggestionIndex] || ''}
                      </span>
                    }
                    <br />
                    {suggestions.length > 0 && (
                      <span style={{ opacity: 0.4 }}>
                        Press Tab to{' '}
                        <button
                          className="cursor-pointer pointer-events-auto"
                          onClick={(e) => {
                            handleSuggestionClick(suggestions[suggestionIndex]);
                          }}
                        >
                          accept
                        </button>{' '}
                        suggestion{' '}
                        {suggestions.length > 1 && (
                          <>
                            <button
                              className="cursor-pointer pointer-events-auto"
                              onClick={(e) => {
                                e.preventDefault();
                                handlePreviousSuggestion();
                                textAreaRef.current!.focus();
                              }}
                            >
                              {'< '}
                            </button>
                            {suggestionIndex + 1 + ' / ' + suggestions.length}
                            <button
                              className="cursor-pointer pointer-events-auto"
                              onClick={(e) => {
                                e.preventDefault();
                                handleNextSuggestion();
                                textAreaRef.current!.focus();
                              }}
                            >
                              {' >'}
                            </button>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <GoButton
                  onClick={handleSubmitCommand}
                  justClickedGo={justClickedGo}
                />
                <MinionTaskListComponent executionList={executionList} />
              </div>
            </div>
          </>
        )}
      </div>
      <div
        // Update className to achieve better centering, margin, padding, and width
        className="text-center py-4 fixed bottom-0 w-full"
        key="credits"
        style={{
          backgroundColor: 'var(--vscode-sideBar-background)',
          zIndex: 1000,
        }}
      >
        <a
          className="inline-block w-20 logo"
          href="https://10clouds.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          by <br />
          <Logo className="inline-block w-20" alt="10Clouds Logo" />
        </a>
      </div>
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<SideBarWebViewInnerComponent />);

import * as React from "react";
import { createRoot } from "react-dom/client";
import { MessageToVSCode, MessageToVSCodeType, MessageToWebView, MessageToWebViewType } from "../Messages";
import { ApiKeyInfoMessage } from "./ApiKeyInfoMessage";
import { GoButton } from "./GoButton";
import { Header } from "./Header";
import { Logo } from "./Logo";
import { ALL_MINION_ICONS_OUTLINE } from "./MinionIconsOutline";
import { MinionTaskListComponent } from "./MinionTaskListComponent";
import { MinionTaskUIInfo } from "./MinionTaskUIInfo";
import { useTemporaryFlag } from "./useTemporaryFlag";

declare const acquireVsCodeApi: any;

const vscode = acquireVsCodeApi();

export function postMessageToVsCode(message: MessageToVSCode) {
  vscode.postMessage(message);
}

// Custom hook to track the previous value of a state variable
function usePrevious<T>(value: T): T | undefined {
  const ref = React.useRef<T>();

  React.useEffect(() => {
    ref.current = value;
  });

  return ref.current;
}

export const SideBarWebViewInnerComponent: React.FC = () => {
  const [userInputPrompt, setUserInputPrompt] = React.useState("");
  const [executionList, setExecutionList] = React.useState<MinionTaskUIInfo[]>([]);
  const [apiKeySet, setApiKeySet] = React.useState<true | false | undefined>(undefined);
  const [selectedSuggestion, setSelectedSuggestion] = React.useState("");
  const [justClickedGo, markJustClickedGo] = useTemporaryFlag();
  const [isSidebarVisible, setIsSidebarVisible] = React.useState(true);
  const [isSuggestionLoading, setIsSuggestionLoading] = React.useState(false);

  const [selectedCode, setSelectedCode] = React.useState("");
  const [suggestionInputBase, setSuggestionInputBase] = React.useState<string | undefined>(undefined);
  const [suggestionCodeBase, setSuggestionCodeBase] = React.useState<string | undefined>(undefined);
  const [isTextAreaFocused, setIsTextAreaFocused] = React.useState(false);
  const [immediatellySuggest, setImmediatellySuggest] = React.useState(false);
  const [acceptedSuggestion, setAcceptedSuggestion] = React.useState<string | undefined>(undefined);
  const prevIsTextAreaFocused = usePrevious(isTextAreaFocused);

  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const [RobotIcon1, RobotIcon2] = React.useMemo(() => {
    const randomIndex = Math.floor(Math.random() * ALL_MINION_ICONS_OUTLINE.length);
    return [ALL_MINION_ICONS_OUTLINE[randomIndex], ALL_MINION_ICONS_OUTLINE[(randomIndex + 1) % ALL_MINION_ICONS_OUTLINE.length]];
  }, []);

  const textAreaRef = React.useRef<HTMLTextAreaElement>(null);

  function handleMessage(message: MessageToWebView) {
    console.log("CMD (webview)", message.type);

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
      case MessageToWebViewType.UpdateSidebarVisibility:
        setIsSidebarVisible(message.value);
        break;
      case MessageToWebViewType.SuggestionLoading:
        setIsSuggestionLoading(true);
        break;
      case MessageToWebViewType.Suggestion:
        setSelectedSuggestion(message.suggestion);
        break;
      case MessageToWebViewType.SuggestionError:
        setSelectedSuggestion("");
        setIsSuggestionLoading(false);
        break;
      case MessageToWebViewType.SuggestionLoadedOrCanceled:
        setIsSuggestionLoading(false);
        break;
      case MessageToWebViewType.ChosenCodeUpdated:
        setSelectedCode(message.code);
        break;
    }
  }

  function handleClearAndFocus() {
    setUserInputPrompt("");
    const input = document.querySelector("textarea");
    input?.focus();
  }

  function handleExecutionsUpdated(executions: MinionTaskUIInfo[]) {
    setExecutionList(executions);
  }

  function handleSuggestionClick(command: string) {
    setUserInputPrompt(command);
    setSelectedSuggestion("");
    setAcceptedSuggestion(command);
  }

  function handleSubmitCommand() {
    postMessageToVsCode({
      type: MessageToVSCodeType.NewMinionTask,
      value: userInputPrompt || selectedSuggestion,
    });
    markJustClickedGo();
    setUserInputPrompt("");
    setSelectedSuggestion("");
    setSuggestionCodeBase(undefined);
    setSuggestionInputBase(undefined);
  }

  React.useEffect(() => {
    const eventHandler = (event: any) => {
      const message: MessageToWebView = event.data;
      handleMessage(message);
    };

    window.addEventListener("message", eventHandler);

    postMessageToVsCode({ type: MessageToVSCodeType.ReadyForMessages });

    return () => {
      window.removeEventListener("message", eventHandler);
    };
  }, []);

  React.useEffect(() => {
    if (prevIsTextAreaFocused === false && isTextAreaFocused === true) {
      setImmediatellySuggest(true);
    }
  }, [prevIsTextAreaFocused, isTextAreaFocused]);

  React.useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    console.log(
      `DUPA suggestionInputBase: ${suggestionInputBase}, userInputPrompt: ${userInputPrompt}, suggestionCodeBase: ${suggestionCodeBase}, selectedCode: ${selectedCode}, isSidebarVisible: ${isSidebarVisible}, prevIsTextAreaFocused: ${prevIsTextAreaFocused}, isTextAreaFocused: ${isTextAreaFocused}`
    );

    if (
      isSidebarVisible &&
      (isTextAreaFocused || (selectedSuggestion === "" && !isSuggestionLoading)) &&
      !(suggestionInputBase === userInputPrompt && suggestionCodeBase === selectedCode) &&
      acceptedSuggestion !== userInputPrompt
    ) {
      setSelectedSuggestion("");

      if (immediatellySuggest) {
        setSuggestionInputBase(userInputPrompt);
        setSuggestionCodeBase(selectedCode);
        postMessageToVsCode({
          type: MessageToVSCodeType.GetSuggestions,
          input: userInputPrompt,
        });
      } else {
        timeoutRef.current = setTimeout(() => {
          setImmediatellySuggest(true);
        }, 1500);
      }
    }

    setImmediatellySuggest(false);
  }, [userInputPrompt, selectedCode, isSidebarVisible, isTextAreaFocused, immediatellySuggest, acceptedSuggestion]);

  return (
    <div className="w-full">
      <div className="p-4 mb-16">
        <Header RobotIcon1={RobotIcon1} RobotIcon2={RobotIcon2} />

        {apiKeySet === false && <ApiKeyInfoMessage />}

        {apiKeySet === true && (
          <>
            <div className="mb-2">
              Summon a Minion! Jot down your coding task and delegate to your loyal Minion. Remember, each Minion lives in a context of a specific file. For
              pinpoint precision, select the code involved.{" "}
            </div>
            <div style={{ position: "relative" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    flexWrap: "wrap",
                    color: "rgba(var(--vscode-editor-foreground), 0.5)", // Grayed-out text color
                    alignItems: "baseline",
                  }}
                >
                  <textarea
                    ref={textAreaRef}
                    style={{
                      position: "relative",
                      height: "10rem",
                      backgroundColor: "var(--vscode-editor-background)",
                      borderColor: "var(--vscode-focusBorder)",
                    }}
                    className="w-full h-96 mb-3 p-4 text-sm resize-none focus:outline-none"
                    value={userInputPrompt}
                    onChange={(e) => {
                      setUserInputPrompt(e.target.value);
                      setAcceptedSuggestion(undefined);
                    }}
                    onFocus={() => {
                      setIsTextAreaFocused(true);
                    }}
                    onBlur={() => {
                      setIsTextAreaFocused(false);
                    }}
                    onKeyDown={(e) => {
                      // Check for Tab key and if the selectedSuggestion is valid
                      if (e.key === "Tab" && selectedSuggestion.length > 0) {
                        e.preventDefault(); // Prevent default tab behavior
                        handleSuggestionClick(selectedSuggestion);
                      }
                      // Check for Enter key and if the Shift key is NOT pressed
                      else if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault(); // Prevent default line break behavior

                        if (justClickedGo) return; // Prevent double submission
                        // Submit userInputPrompt by calling postMessageToVsCode function
                        handleSubmitCommand();
                      }
                    }}
                  />

                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      height: "10rem",
                      pointerEvents: "none",
                      color: "rgba(var(--vscode-editor-foreground), 0.5)",
                      overflow: "hidden",
                      whiteSpace: "pre-wrap",
                      zIndex: 1000,
                    }}
                    className="w-full h-96 p-4 text-sm resize-none focus:outline-none pointer-events-none"
                  >
                    <span style={{ opacity: 0.0 }}>{userInputPrompt}</span>
                    {userInputPrompt !== "" && (
                      <>
                        <br />
                        <br />
                      </>
                    )}
                    {userInputPrompt !== "" && selectedSuggestion && isTextAreaFocused && (
                      <span style={{ opacity: 0.5 }}>
                        Suggestion:
                        <br />
                      </span>
                    )}
                    {selectedSuggestion && <span style={{ opacity: 0.7 }}>{selectedSuggestion}</span>}
                    {isSuggestionLoading && (
                      <span style={{ opacity: 0.5 }}>
                        <span className="ellipsis-dot ellipsis-dot-1">.</span>
                        <span className="ellipsis-dot ellipsis-dot-2">.</span>
                        <span className="ellipsis-dot ellipsis-dot-3">.</span>
                      </span>
                    )}
                    <br />
                    {selectedSuggestion && isTextAreaFocused && <span style={{ opacity: 0.5 }}>Press Tab to accept suggestion</span>}
                  </div>
                </div>
                <GoButton onClick={handleSubmitCommand} justClickedGo={justClickedGo} />

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
          backgroundColor: "var(--vscode-sideBar-background)",
          zIndex: 1000,
        }}
      >
        <a className="inline-block w-20 logo" href="https://10clouds.com" target="_blank" rel="noopener noreferrer">
          by <br />
          <Logo className="inline-block w-20" alt="10Clouds Logo" />
        </a>
      </div>
    </div>
  );
};

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(<SideBarWebViewInnerComponent />);

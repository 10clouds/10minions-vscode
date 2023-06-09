import * as React from "react";
import { createRoot } from "react-dom/client";
import { MessageToVSCode, MessageToWebView } from "../Messages";
import { ExecutionInfo } from "./ExecutionInfo";
import { Logo } from "./Logo";
import { ALL_OUTLINE_ROBOT_ICONS } from "./OutlineRobotIcons";
import { BRAND_COLOR, blendWithForeground } from "../utils/blendColors";
import { GoButton } from "./GoButton";
import { ExecutionsList } from "./ExecutionsList";

declare const acquireVsCodeApi: any;

const vscode = acquireVsCodeApi();

export function postMessageToVsCode(message: MessageToVSCode) {
  vscode.postMessage(message);
}


const COMMAND_PLACEHOLDER = `
Summon a Minion! Jot down your coding task and delegate to your loyal Minion. Remember, each Minion lives in a context of a specific file. For pinpoint precision, highlight the code involved.
            
Ask something ...
... Refactor this
... Explain
... Make it pretty
... Rename this to something sensible
... Are there any bugs? Fix them
... Rework this so now it also does X
`.trim();
export const SideBarWebViewInnerComponent: React.FC = () => {
  const [userInputPrompt, setUserInputPrompt] = React.useState("");
  const [executionList, setExecutionList] = React.useState<ExecutionInfo[]>([]);
  const [apiKeySet, setApiKeySet] = React.useState<true | false | undefined>(undefined);
  const [scrollPosition, setScrollPosition] = React.useState({ scrollLeft: 0, scrollTop: 0 });
  const [selectedSuggestion, setSelectedSuggestion] = React.useState("");

  function handleMessage(message: MessageToWebView) {
    console.log("CMD (webview)", message.type);

    switch (message.type) {
      case "clearAndfocusOnInput":
        handleClearAndFocus();
        break;
      case "executionsUpdated":
        handleExecutionsUpdated(message.executions);
        break;
      case "apiKeySet":
        setApiKeySet(message.value);
        break;
      case "suggestion":
        setSelectedSuggestion(message.value || "");
        break;
    }
  }

  function handleClearAndFocus() {
    setUserInputPrompt("");
    const input = document.querySelector("textarea");
    input?.focus();
  }

  function renderHeader(RobotIcon1: React.ElementType, RobotIcon2: React.ElementType) {
    return (
      <React.Fragment>
        <h1 className="text-4xl font-bold text-center mb-2 text-primary">
          <div className="flex items-center justify-center">
            <RobotIcon1 style={{ color: blendWithForeground(BRAND_COLOR, 0.75) }} className="w-8 h-8 inline-flex align-middle mr-2" />
            <span style={{ color: blendWithForeground(BRAND_COLOR, 0.75) }}>10</span>Minions
            <RobotIcon2 style={{ color: blendWithForeground(BRAND_COLOR, 0.75) }} className="w-8 h-8 inline-flex align-middle ml-2" />
          </div>
        </h1>
        <h3 className="text-xl font-semibold text-center mb-6">
          Your Army of <span style={{ color: blendWithForeground(BRAND_COLOR, 0.75) }}>AI-Powered</span>
          <br /> <span style={{ opacity: 0.7 }}>Coding</span> Comrades
        </h3>
      </React.Fragment>
    );
  }

  function handleExecutionsUpdated(executions: ExecutionInfo[]) {
    setExecutionList(executions);
  }

  function handleSuggestionClick(command: string) {
    setUserInputPrompt(command);
    setSelectedSuggestion("");
  }

  React.useEffect(() => {
    const eventHandler = (event: any) => {
      const message: MessageToWebView = event.data;
      console.log("message received", message.type);

      handleMessage(message);
    };

    window.addEventListener("message", eventHandler);

    postMessageToVsCode({ type: "readyForMessages" });

    return () => {
      window.removeEventListener("message", eventHandler);
    };
  }, []);

  function ApiKeyInfoMessage() {
    return (
      <div className="mb-4">
        <p className="mb-2">
          <span className="font-bold">10Minions</span> needs an API key to work. You can get one from{" "}
          <a href="https://platform.openai.com/overview" target="_blank" rel="noopener noreferrer" className="text-blue-500">
            OpenAI
          </a>
          (You will need GPT-4 access on this key).
        </p>

        <p className="mb-2">
          Once you have an API key, set it in the VS Code settings under <span className="font-bold">10Minions.apiKey</span>.
        </p>

        <p className="mb-2">
          You can also set the key by pressing SHIFT-ALT-P and then typing <span className="font-bold">10Minions: Set API Key</span>.
        </p>
      </div>
    );
  }

  const handleTextAreaClick = React.useCallback((e: React.MouseEvent<HTMLTextAreaElement, MouseEvent>) => {
    if (textAreaRef.current) {
      const { scrollLeft, scrollTop } = textAreaRef.current;
      setScrollPosition({ scrollLeft, scrollTop });
    }
  }, []);

  function handleTextAreaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    // Prevent the caret from going into the prefix area
    if (textAreaRef.current) {
      const selectionStart = Math.max(prefix.length, textAreaRef.current.selectionStart);
      const selectionEnd = Math.max(prefix.length, textAreaRef.current.selectionEnd);
      textAreaRef.current.selectionStart = selectionStart;
      textAreaRef.current.selectionEnd = selectionEnd;
    }

    // Remove prefix from input
    const input = e.target.value.slice(prefix.length);
    setUserInputPrompt(input);

    // Post the message to the handler
    postMessageToVsCode({
      type: "getSuggestions",
      input: e.target.value,
    });
  }

  //get two random different robot icons
  const [RobotIcon1, RobotIcon2] = React.useMemo(() => {
    const randomIndex = Math.floor(Math.random() * ALL_OUTLINE_ROBOT_ICONS.length);
    return [ALL_OUTLINE_ROBOT_ICONS[randomIndex], ALL_OUTLINE_ROBOT_ICONS[(randomIndex + 1) % ALL_OUTLINE_ROBOT_ICONS.length]];
  }, []);

  const textAreaRef = React.useRef<HTMLTextAreaElement>(null);

  const prefix = selectedSuggestion.slice(0, selectedSuggestion.indexOf(userInputPrompt));

  return (
    <div className="w-full">
      <div className="p-4 mb-16">
        {renderHeader(RobotIcon1, RobotIcon2)}

        {apiKeySet === false && <ApiKeyInfoMessage />}

        {apiKeySet === true && (
          <>
            <div style={{ position: "relative" }}>
              <textarea
                ref={textAreaRef}
                style={{
                  position: "relative",
                  height: "20rem",
                  backgroundColor: "var(--vscode-editor-background)",
                  color: "rgba(0,0,0,100)", // Transparent text color
                  borderColor: "var(--vscode-focusBorder)",
                  caretColor: "var(--vscode-editor-foreground)", // Change cursor color to editor foreground color

                }}
                onClick={handleTextAreaClick}
                className="w-full h-96 p-4 mb-3 text-sm resize-none focus:outline-none"
                placeholder={COMMAND_PLACEHOLDER}
                value={prefix + userInputPrompt}
                onChange={handleTextAreaChange}
                onScroll={handleTextAreaClick}
                onInput={handleTextAreaChange}
                onKeyDown={(e) => {
                  if (e.key === "Tab" && selectedSuggestion.length > 0) {
                    e.preventDefault(); // Prevent default tab behavior
                    handleSuggestionClick(selectedSuggestion);
                  }
                }}
              />

              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  height: "20rem",
                  pointerEvents: "none",
                  color: "rgba(var(--vscode-editor-foreground), 0.5)", // Grayed-out text color
                  overflow: "hidden",
                  whiteSpace: "pre-wrap", // Preserve line breaks and spaces
                  zIndex: 1000,
                  transform: `translate(${scrollPosition.scrollLeft}px, ${scrollPosition.scrollTop}px)`, // Use transform and translate() function
                }}
                className="w-full h-96 p-4 text-sm resize-none focus:outline-none"
              >
                <span style={{ opacity: 0.5 }}>{prefix}</span>
                <span style={{ opacity: 1.0 }}>{userInputPrompt}</span>
                <span style={{ opacity: 0.5 }}>{selectedSuggestion.slice(selectedSuggestion.indexOf(userInputPrompt) + userInputPrompt.length)}</span>
                <br/>
                {selectedSuggestion &&  <span style={{ opacity: 0.5 }}>Press Tab to accept suggestion</span>}
              </div>

              
            </div>
            <GoButton
                onClick={() => {
                  postMessageToVsCode({
                    type: "newExecution",
                    value: userInputPrompt,
                  });
                }}
              />
              
            <ExecutionsList executionList={executionList} />
          </>
        )}
      </div>

      <div
        // Update className to achieve better centering, margin, padding, and width
        className="text-center p-4 fixed bottom-0 w-full"
        key="credits"
        style={{
          backgroundColor: "var(--vscode-sideBar-background)",
          zIndex: 1000,
        }}
      >
        <a className="inline-block w-20 logo" href="https://10clouds.com" target="_blank" rel="noopener noreferrer">
          by <br />
          <Logo className="inline-block w-20" />
        </a>
      </div>
    </div>
  );
};

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(<SideBarWebViewInnerComponent />);

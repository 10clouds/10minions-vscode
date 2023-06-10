import * as React from "react";
import { createRoot } from "react-dom/client";
import { MessageToVSCode, MessageToWebView } from "../Messages";
import { MinionTaskUIInfo } from "./MinionTaskUIInfo";
import { Logo } from "./Logo";
import { ALL_MINION_ICONS_OUTLINE } from "./MinionIconsOutline";
import { GoButton } from "./GoButton";
import { MinionTaskListComponent } from "./MinionTaskListComponent";
import { Header } from "./Header";
import { ApiKeyInfoMessage } from "./ApiKeyInfoMessage";

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
  const [executionList, setExecutionList] = React.useState<MinionTaskUIInfo[]>([]);
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

  function handleExecutionsUpdated(executions: MinionTaskUIInfo[]) {
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

  const handleTextAreaClick = React.useCallback((e: React.MouseEvent<HTMLTextAreaElement, MouseEvent>) => {
    if (textAreaRef.current) {
      const { scrollLeft, scrollTop } = textAreaRef.current;
      setScrollPosition({ scrollLeft, scrollTop });
    }
  }, []);

  function handleTextAreaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setUserInputPrompt(e.target.value);

    postMessageToVsCode({
      type: "getSuggestions",
      input: e.target.value,
    });
  }

  //get two random different robot icons
  const [RobotIcon1, RobotIcon2] = React.useMemo(() => {
    const randomIndex = Math.floor(Math.random() * ALL_MINION_ICONS_OUTLINE.length);
    return [ALL_MINION_ICONS_OUTLINE[randomIndex], ALL_MINION_ICONS_OUTLINE[(randomIndex + 1) % ALL_MINION_ICONS_OUTLINE.length]];
  }, []);

  const textAreaRef = React.useRef<HTMLTextAreaElement>(null);

  const prefix = selectedSuggestion.slice(0, selectedSuggestion.indexOf(userInputPrompt));

  const prefixWidth = React.useMemo(() => {
    const span = document.createElement("span");
    span.className = "prefix";
    span.innerText = prefix;
    document.body.appendChild(span);
    const width = span.offsetWidth;
    document.body.removeChild(span);
    return width;
  }, [prefix]);

  return (
    <div className="w-full">
      <div className="p-4 mb-16">
        <Header RobotIcon1={RobotIcon1} RobotIcon2={RobotIcon2} />

        {apiKeySet === false && <ApiKeyInfoMessage />}

        {apiKeySet === true && 
            <div style={{ position: "relative" }}>
              <div
                className="input-container"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                }}
              >
                <div
                  className="prefix-container"
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    flexWrap: "wrap",
                    color: "rgba(var(--vscode-editor-foreground), 0.5)", // Grayed-out text color
                  }}
                >
                  <span className="prefix pointer-events-none">{prefix}</span>
                  <textarea
                    ref={textAreaRef}
                    style={{
                      position: "relative",
                      height: "20rem",
                      backgroundColor: "var(--vscode-editor-background)",
                      color: "rgba(0,0,0,100)", // Transparent text color
                      borderColor: "var(--vscode-focusBorder)",
                      caretColor: "var(--vscode-editor-foreground)", // Change cursor color to editor foreground color
                      "--prefix-width": prefixWidth + "px",
                } as React.CSSProperties}
                    onClick={handleTextAreaClick}
                    className="w-full h-96 p-4 mb-3 text-sm resize-none focus:outline-none textarea-with-prefix"
                    placeholder={COMMAND_PLACEHOLDER}
                    value={userInputPrompt}
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
                className="w-full h-96 p-4 text-sm resize-none focus:outline-none pointer-events-none"
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
              
            <MinionTaskListComponent executionList={executionList} />

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

        }
    </div>
    </div>
  );
};


const container = document.getElementById("root");
const root = createRoot(container!);
root.render(<SideBarWebViewInnerComponent />);

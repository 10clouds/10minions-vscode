import * as React from "react";
import { createRoot } from "react-dom/client";
import FlipMove from "react-flip-move";
import { MessageToVSCode, MessageToWebView } from "../Messages";
import { Execution } from "./Execution";
import { ExecutionInfo } from "./ExecutionInfo";
import { Logo } from "./Logo";
import { ALL_OUTLINE_ROBOT_ICONS } from "./OutlineRobotIcons";
import { useTemporaryFlag } from "./useTemporaryFlag";
import { BRAND_COLOR, blendWithForeground } from "../utils/blendColors";

declare const acquireVsCodeApi: any;

const vscode = acquireVsCodeApi();

export function postMessageToVsCode(message: MessageToVSCode) {
  vscode.postMessage(message);
}

export function GoButton({ onClick }: { onClick?: () => void }) {
  let [justClickedGo, markJustClickedGo] = useTemporaryFlag();

  return (
    <button
      style={{
        backgroundColor: blendWithForeground(BRAND_COLOR, 0.75),
        color: blendWithForeground("#ffffff", 0.75),
      }}
      className={"w-full mb-4 font-bold py-2 px-4 rounded transition-all duration-100 ease-in-out " + (justClickedGo ? "opacity-50" : "")}
      type="submit"
      onClick={() => {
        onClick?.();
        markJustClickedGo();
      }}
      disabled={justClickedGo}
    >
      Go
    </button>
  );
}

export function ExecutionsList({ executionList }: { executionList: ExecutionInfo[] }) {
  return (
    <FlipMove
      enterAnimation={{
        from: {
          transform: "translateY(-10%)",
          animationTimingFunction: "cubic-bezier(0.8, 0, 1, 1)",
          opacity: "0.1",
        },
        to: {
          transform: "translateY(0)",
          animationTimingFunction: "cubic-bezier(0, 0, 0.2, 1)",
          opacity: "1",
        },
      }}
      leaveAnimation="elevator"
    >
      {executionList.length === 0 && (
        <div key="no-minions" className="text-center">
          No minions are active.
        </div>
      )}

      {executionList.map((execution) => (
        <Execution key={execution.id} execution={execution} />
      ))}
    </FlipMove>
  );
}

function getRandomRobotIcon() {
  const randomIndex = Math.floor(Math.random() * ALL_OUTLINE_ROBOT_ICONS.length);
  return ALL_OUTLINE_ROBOT_ICONS[randomIndex];
}

function getCaretCoordinates(element: HTMLTextAreaElement, position: number) {
  const div = document.createElement("div");
  const span = document.createElement("span");
  const computedStyle = getComputedStyle(element);

  div.style.width = computedStyle.width;
  div.style.height = computedStyle.height;
  div.style.overflowY = computedStyle.overflowY;

  span.textContent = element.value.substring(0, position);
  div.appendChild(span);

  element.parentElement?.appendChild(div);
  const rect = span.getBoundingClientRect();
  element.parentElement?.removeChild(div);

  return { left: rect.left - element.getBoundingClientRect().left, top: rect.top - element.getBoundingClientRect().top };
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
      console.log("SDASD", scrollLeft, scrollTop);
      setScrollPosition({ scrollLeft, scrollTop });
    }
  }, []);


  const RobotIcon1 = React.useMemo(() => getRandomRobotIcon(), []);
  const RobotIcon2 = React.useMemo(() => getRandomRobotIcon(), []);

  const textAreaRef = React.useRef<HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = React.useState({ x: 0, y: 0 });

  React.useEffect(() => {
    const caret = document.querySelector("[data-caret]");
    if (caret) {
      if (caret && caret instanceof HTMLElement) {
        caret.style.transform = `translate(${cursorPosition.x}px, ${cursorPosition.y}px)`;
      }
    }
  }, [cursorPosition]);

  return (
    <div className="w-full">
      <div className="p-4 mb-6">
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
                  color: "rgba(0,0,0,0)", // Transparent text color
                  borderColor: "var(--vscode-focusBorder)",
                  
                }}
                onClick={handleTextAreaClick}
                className="w-full h-96 p-4 mb-3 text-sm resize-none focus:outline-none"
                placeholder={COMMAND_PLACEHOLDER}
                value={userInputPrompt}
                onChange={(e) => {
                  setUserInputPrompt(e.target.value);

                  // Post the message to the handler
                  postMessageToVsCode({
                    type: "getSuggestions",
                    input: e.target.value,
                  });
                }}
                onScroll={handleTextAreaClick}
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
                // Adding ":before" pseudo-element to represent the caret
                data-caret
              >
                <span style={{ opacity: 0.5 }}>{selectedSuggestion.slice(0, selectedSuggestion.indexOf(userInputPrompt))}</span>
                <span style={{ opacity: 1.0 }}>{userInputPrompt}</span>
                <span style={{ opacity: 0.5 }}>{selectedSuggestion.slice(selectedSuggestion.indexOf(userInputPrompt) + userInputPrompt.length)}</span>
                <br/>
                {selectedSuggestion &&  <span style={{ opacity: 0.5 }}>Press Tab to accept</span>}
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

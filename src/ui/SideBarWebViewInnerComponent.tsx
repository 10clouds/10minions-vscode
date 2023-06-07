import * as React from "react";
import { createRoot } from "react-dom/client";
import { Logo } from "./Logo";
import { useTemporaryFlag } from "./useTemporaryFlag";
import { ExecutionInfo } from "./ExecutionInfo";
import { Execution } from "./Execution";

declare const acquireVsCodeApi: any;

export const vscode = acquireVsCodeApi();

export function GoButton({ onClick }: { onClick?: () => void }) {
  let [justClickedGo, markJustClickedGo] = useTemporaryFlag();

  return (
    <button
      style={{
        backgroundColor: "#5e20e5",
        color: "#ffffff",
      }}
      className={"w-full font-bold py-2 px-4 rounded transition-all duration-100 ease-in-out " + (justClickedGo ? "opacity-50" : "")}
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

export function ExecutionsList({ executionList, removedExecution }: { executionList: ExecutionInfo[]; removedExecution: ExecutionInfo | null }) {
  return (
    <div className="relative" style={{ minHeight: "3rem" }}>
      <div
        className={
          "absolute text-center transition-all duration-300 ease-in-out w-full pointer-events-none" +
          (executionList.length === 0 ? " opacity-100" : " opacity-0")
        }
        style={{ minHeight: "3rem" }}
      >
        No minions are active.
      </div>
      <div className="mt-4">
        {executionList.map((execution) => (
          <Execution key={execution.id} execution={execution} className={removedExecution && removedExecution.id === execution.id ? "fade-out" : ""} />
        ))}
      </div>
    </div>
  );
}

export const SideBarWebViewInnerComponent: React.FC = () => {
  const [userInputPrompt, setUserInputPrompt] = React.useState("");
  const [infoMessage, setInfoMessage] = React.useState("");
  const [executionList, setExecutionList] = React.useState<ExecutionInfo[]>([]);
  const [apiKeySet, setApiKeySet] = React.useState<true | false | undefined>(undefined);
  const [removedExecution, setRemovedExecution] = React.useState<ExecutionInfo | null>(null);
  const [scrollPosition, setScrollPosition] = React.useState({ scrollLeft: 0, scrollTop: 0 });

  const [selectedSuggestion, setSelectedSuggestion] = React.useState("");


  function handleMessage(message: any) {
    switch (message.type) {
      case "infoMessage":
        handleInfoMessage(message.value);
        break;
      case "clearAndfocusOnInput":
        handleClearAndFocus();
        break;
      case "preFillPrompt":
        handlePreFillPrompt(message.value);
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

  function handleInfoMessage(value: string) {
    setInfoMessage(value);
  }

  function handleClearAndFocus() {
    setUserInputPrompt("");
    const input = document.querySelector("textarea");
    input?.focus();
  }

  function handlePreFillPrompt(value: string) {
    setUserInputPrompt(value);

    const goButton = document.querySelector("button");
    goButton?.focus();
  }

  function handleExecutionsUpdated(executions: ExecutionInfo[]) {
    // Find the unique ExecutionInfo that was removed
    const removed = executionList.find((exec) => !executions.some(({ id }) => id === exec.id));
    if (removed) {
      setRemovedExecution(removed);
    }

    setExecutionList(executions);

    // Reset the removedExecution state after the fade-out animation (500ms)
    setTimeout(() => {
      setRemovedExecution(null);
    }, 500);
  }

  function handleSuggestionClick(command: string) {
    setUserInputPrompt(command);
    setSelectedSuggestion("");
  }

  React.useEffect(() => {
    const eventHandler = (event: any) => {
      const message = event.data;
      console.log("message received", message.type);

      handleMessage(message);
    };

    window.addEventListener("message", eventHandler);

    return () => {
      window.removeEventListener("message", eventHandler);
    };
  }, []);

  React.useEffect(() => {
    const eventHandler = (event: any) => {
      const message = event.data;
      console.log("message received", message.type);

      handleMessage(message);
    };

    window.addEventListener("message", eventHandler);

    return () => {
      window.removeEventListener("message", eventHandler);
    };
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 font-sans leading-normal tracking-normal">
      <h1 className="text-4xl font-bold text-center mb-2 text-primary">🤖 10Minions 🤖</h1>
      <h3 className="text-xl font-semibold text-center mb-6">Your Army of AI-Powered Coding Comrades</h3>

      {apiKeySet === false && (
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
      )}

      {apiKeySet === true && (
        <div className="mb-6 relative">
          <textarea
            style={{
              height: "20rem",
              backgroundColor: "var(--vscode-editor-background)",
              color: "var(--vscode-editor-foreground)",
              borderColor: "var(--vscode-focusBorder)",
            }}
            className="w-full h-96 p-4 text-sm resize-none mb-4 focus:outline-none"
            placeholder={`
Summon a Minion! Jot down your coding task and delegate to your loyal Minion. Remember, each Minion lives in a context of a specific file. For pinpoint precision, highlight the code involved.
            
Ask something ...
... Refactor this
... Explain
... Make it pretty
... Rename this to something sensible
... Are there any bugs? Fix them
... Rework this so now it also does X
`.trim()}
            value={userInputPrompt}
            onChange={(e) => {
              setUserInputPrompt(e.target.value);

              // Post the message to the handler
              vscode.postMessage({
                type: "getSuggestions",
                input: e.target.value,
              });
            }}
            onScroll={(e) => {
              const textArea = e.target as HTMLTextAreaElement;
              const { scrollLeft, scrollTop } = textArea;
              setScrollPosition({ scrollLeft, scrollTop });
            }}
            onKeyDown={(e) => {
              if (e.key === "Tab" && selectedSuggestion.length > 0) {
                e.preventDefault(); // Prevent default tab behavior
                handleSuggestionClick(selectedSuggestion);
              }
            }} 
          />

          {infoMessage && (
            <div className="text-base mb-4 text-center" id="token-count">
              {infoMessage}
            </div>
          )}

          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              height: "20rem",
              pointerEvents: "none",
              backgroundColor: "var(--vscode-editor-background)",
              color: "rgba(var(--vscode-editor-foreground), 0.5)", // Grayed-out text color
              overflow: "hidden",
              whiteSpace: "pre-wrap", // Preserve line breaks and spaces
              opacity: 0.5,
              transform: `translate(${scrollPosition.scrollLeft}px, ${scrollPosition.scrollTop}px)`, // Use transform and translate() function
            }}
            className="w-full h-96 p-4 text-sm resize-none mb-4 focus:outline-none"
          >
            {userInputPrompt + (selectedSuggestion.startsWith(userInputPrompt) ? selectedSuggestion.slice(userInputPrompt.length) : "")}
          </div>

          <GoButton
            onClick={() => {
              vscode.postMessage({
                type: "newExecution",
                value: userInputPrompt,
              });
            }}
          />

          <ExecutionsList executionList={executionList} removedExecution={removedExecution} />
        </div>
      )}

      <div className="text-center mx-auto">
        by{" "}
        <a className="inline-block text-center w-1/6 logo" href="https://10clouds.com" target="_blank" rel="noopener noreferrer">
          <Logo className="w-full" />
        </a>
      </div>
    </div>
  );
};

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(<SideBarWebViewInnerComponent />);

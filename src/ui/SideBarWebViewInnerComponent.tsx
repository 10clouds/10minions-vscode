import * as React from "react";
import { createRoot } from "react-dom/client";
import { Logo } from "./Logo";
import { useTemporaryFlag } from "./useTemporaryFlag";
import { ExecutionInfo } from "./ExecutionInfo";
import { Execution } from "./Execution";

declare const acquireVsCodeApi: any;

export const vscode = acquireVsCodeApi();

export const SideBarWebViewInnerComponent: React.FC = () => {
  let [userInputPrompt, setUserInputPrompt] = React.useState("");
  let [infoMessage, setInfoMessage] = React.useState("");
  let [executionList, setExecutionList] = React.useState<ExecutionInfo[]>([]);
  let [justClickedGo, markJustClickedGo] = useTemporaryFlag();
  let [apiKeySet, setApiKeySet] = React.useState<true | false | undefined>(undefined);

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
    setExecutionList(executions);
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

  return (
    <div className="container mx-auto px-4 py-8 font-sans leading-normal tracking-normal">
      
      <h1 style={{ color: "#602ae0" }} className="text-4xl font-bold text-center mb-0">
        🤖 10Minions 🤖 
      </h1>
      <div className="text-center mb-2"> by </div>
      <div className="text-center mb-4">
     <Logo />
      </div>
      <h3 className="text-xl font-semibold text-center mb-6">Your Army of AI-Powered Coding Comrades</h3>
      {apiKeySet === false && (
        <div className="text-base mb-4">
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
        <>
          <p className="text-base mb-4">
            Summon a Minion! Jot down your coding task and delegate to your loyal Minion. Remember, each Minion lives in a context of a specific file. For pinpoint precision, highlight the code involved.
          </p>
          <textarea
            style={{ height: "13rem" }}
            className="w-full h-96 text-white bg-gray-700 p-4 text-sm resize-none mb-4"
            placeholder={`Ask something ...

... Refactor this
... Explain
... Make it preety
... Rename this to something sensible
... Are there any bugs?
... Rework this so now it also does X`}
            value={userInputPrompt}
            onChange={(e) => setUserInputPrompt(e.target.value)}
          />
          {infoMessage && (
            <div className="text-base mb-4 text-center" id="token-count">
              {infoMessage}
            </div>
          )}
          <button
            style={{ backgroundColor: "#602ae0" }}
            className={
              "w-full hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-all duration-100 ease-in-out " + (justClickedGo ? "opacity-50" : "")
            }
            type="submit"
            onClick={() => {
              vscode.postMessage({
                type: "newExecution",
                value: userInputPrompt,
              });

              markJustClickedGo();
            }}
            disabled={justClickedGo}
          >
            Go
          </button>
          <div className="relative">
            <div
              className={
                "text-base text-center trasition-all duration-300 ease-in-out absolute mt-4 w-full text-center pointer-events-none" +
                (executionList.length === 0 ? " opacity-100 mb-4" : " opacity-0")
              }
            >
              No minions are active.
            </div>
            <div className="mt-4">
              {executionList.map((execution) => (
                <Execution key={execution.id} execution={execution} />
              ))}
            </div>{" "}
          </div>
        </>
      )}
    </div>
  );
};

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(<SideBarWebViewInnerComponent />);

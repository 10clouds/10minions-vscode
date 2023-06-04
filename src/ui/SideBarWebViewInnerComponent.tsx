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
      <div className="text-center mb-4">
        <Logo />
      </div>
      <h1
        style={{ color: "#602ae0" }}
        className="text-4xl font-bold text-center mb-4"
      >
        👨‍🍳 CodeCook 👩‍🍳
      </h1>
      <h3 className="text-xl font-semibold text-center mb-6">
        Your GPT enabled coding assistant
      </h3>
      <p className="text-base mb-4">
        Describe, in simple terms, what you want to do with the selected code.
        Keep in mind that I will know only about the context of what is in this
        file alone.
      </p>
      <textarea
        style={{ height: "13rem" }}
        className="w-full h-96 text-white bg-gray-700 p-4 text-sm resize-none mb-4"
        placeholder="Ask something"
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
          "w-full hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-all duration-100 ease-in-out " +
          (justClickedGo ? "opacity-50" : "")
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
        Cook
      </button>
      <h2 className="text-xl font-semibold text-center mt-6 mb-2">Oven</h2>
      {executionList.length === 0 && (
        <div className="text-base mb-4 text-center">
          Nothing is cooking yet.
        </div>
      )}
      <div className="mt-4">
        {executionList.map((execution) => (
          <Execution key={execution.id} execution={execution} />
        ))}
      </div>{" "}
    </div>
  );
};

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(<SideBarWebViewInnerComponent />);

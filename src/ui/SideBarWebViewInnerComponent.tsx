import * as React from "react";
import { createRoot } from "react-dom/client";
import { Logo } from "./Logo";
import { useTemporaryFlag } from "./useTemporaryFlag";
import { ExecutionInfo } from "./ExecutionInfo";
import { Execution } from "./Execution";

declare const acquireVsCodeApi: any;

export const vscode = acquireVsCodeApi();

// eslint-disable-next-line @typescript-eslint/naming-convention
export const SideBarWebViewInnerComponent: React.FC = () => {
  let [prompt, setPrompt] = React.useState("");
  let [infoMessage, setInfoMessage] = React.useState("");
  let [executions, setExecutions] = React.useState<ExecutionInfo[]>([]);
  let [justClickedGo, markJustClickedGo] = useTemporaryFlag();

  // Handle messages sent from the extension to the webview
  window.addEventListener("message", (event) => {
    const message = event.data;
    console.log("message received", message.type);

    switch (message.type) {
      case "infoMessage": {
        setInfoMessage(message.value);
        break;
      }
      case "clearAndfocusOnInput": {
        setPrompt("");
        const input = document.querySelector("textarea");
        input?.focus();
        break;
      }
      case "preFillPrompt": {
        setPrompt(message.value);

        //focus on the go button
        const goButton = document.querySelector("button");
        goButton?.focus();

        break;
      }
      case "executionsUpdated": {
        setExecutions(message.executions);
        break;
      }
    }
  });

  return (
    <div className="container mx-auto px-4 py-8 font-sans leading-normal tracking-normal">
      <div className="text-center mb-4">
        <Logo />
      </div>
      <h1
        style={{ color: "#602ae0" }}
        className="text-4xl font-bold text-center mb-4"
      >
        🧠 CodeMind
      </h1>
      <h3 className="text-xl font-semibold text-center mb-6">
        GPT-4 Powered Coding Assistant
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
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
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
            value: prompt,
          });

          markJustClickedGo();
        }}
        disabled={justClickedGo}
      >
        Go!
      </button>

      <div className="mt-4">
        {executions.map((execution) => (
          <Execution key={execution.id} execution={execution} />
        ))}
      </div>
    </div>
  );
};

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(<SideBarWebViewInnerComponent />);

import * as React from "react";
import { createRoot } from "react-dom/client";
import { Logo } from "./Logo";

declare const acquireVsCodeApi: any;

const vscode = acquireVsCodeApi();

// eslint-disable-next-line @typescript-eslint/naming-convention
export const SideBarWebViewInnerComponent: React.FC = () => {
  let [prompt, setPrompt] = React.useState('');
  let [tokenCount, setTokenCount] = React.useState(0);
  let [executionRunning, setExecutionRunning] = React.useState(false);

  function handlePromptSubmit(e: any) {
    vscode.postMessage({
      type: "getTokenCount",
      value: prompt,
    });

    vscode.postMessage({
      type: "prompt",
      value: prompt,
    });

    setExecutionRunning(true);
  }

  function handlePromptChange(e: any) {
    setPrompt(e.target.value);
    vscode.postMessage({
      type: "getTokenCount",
      value: prompt,
    });
  }

  function handleStop(e: any) {
    vscode.postMessage({
      type: "stopExecution",
    });
  }

  // Handle messages sent from the extension to the webview
  window.addEventListener("message", (event) => {
    const message = event.data;

    switch (message.type) {
      case "tokenCount": {
        setTokenCount(message.value);
        break;
      }
      case "executionStopped": {
        setExecutionRunning(false);
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
        CodeMind
      </h1>
      <h3 className="text-xl font-semibold text-center mb-6">
        GPT-4 Powered Coding Assistant
      </h3>
      <p className="text-base mb-4">
        Describe, in simple terms, what you want to do with the selected code. Keep in mind that I will know only about the context of
        what is in this file alone.
      </p>
      <textarea
        style={{ height: "26rem" }}
        className="w-full h-96 text-white bg-gray-700 p-4 text-sm resize-none mb-4"
        placeholder="Ask something"
        value={prompt}
        onChange={handlePromptChange}
      />
      <div className="text-base mb-4 text-center" id="token-count">
        Tokens: {tokenCount}
      </div>
      { executionRunning ? 
        <button
          style={{ backgroundColor: "#602ae0", opacity: 0.5 }}
          className="w-full bg-blue-700 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
          type="submit"
          onClick={handleStop}
        >
          Stop
        </button>
        
          : <button
          style={{ backgroundColor: "#602ae0" }}
          className="w-full hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          type="submit"
          onClick={handlePromptSubmit}
        >
          Go!
        </button>
        }
    </div>
  );
};

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(<SideBarWebViewInnerComponent />);

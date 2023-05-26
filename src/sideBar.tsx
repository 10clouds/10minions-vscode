import * as React from "react";
import { createRoot } from "react-dom/client";
import { Logo } from "./logo";

declare const acquireVsCodeApi: any;

const vscode = acquireVsCodeApi();

const DEFAULT_PROMPT = `You are an expert senior coder with IQ of 200, first provide critique of the code given, and provide a plan for changes and then provide a new version of it.

Your code should be simple, consise, maintainable, readable and ready for production. Rewrite parts of it if needed, but keep the final result and side effects the same. Split and join the functions as needed. Introduce or remove types. You may optimise the code, especially if it will make it more parallelized. You may change the names of the functions and create subroutines. Either provide simple documentation or make the code readable enough that it does not need docs. The code quality and documentation should be on par with top open source projects, as this is a part of a top open source project.`;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const CodeMindChat: React.FC = () => {
  let [prompt, setPrompt] = React.useState(DEFAULT_PROMPT);
  let [tokenCount, setTokenCount] = React.useState(0);

  function handlePromptSubmit(e: any) {
    vscode.postMessage({
      type: "getTokenCount",
      value: prompt,
    });

    vscode.postMessage({
      type: "prompt",
      value: prompt,
    });
  }

  function handlePromptChange(e: any) {
    setPrompt(e.target.value);
    vscode.postMessage({
      type: "getTokenCount",
      value: prompt,
    });
  }

  // Handle messages sent from the extension to the webview
  window.addEventListener("message", (event) => {
    const message = event.data;
    console.log("WEB", message);

    switch (message.type) {
      case "tokenCount": {
        setTokenCount(message.value);
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
        Describe what you want to do with the selected code. Keep in mind that
        GPT will know only about the context of what is in this file alone.
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
      <button
        style={{ backgroundColor: "#602ae0" }}
        className="w-full hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        type="submit"
        onClick={handlePromptSubmit}
      >
        Fix
      </button>
    </div>
  );
};

/*
private _getHtmlForWebview(webview: vscode.Webview) {
    return `<!DOCTYPE html>
      <body class="ont-sans leading-normal tracking-normal"
        
        <div class="ontainer mx-auto px-4 py-8"
          <div class="ext-center mb-4"
            <img class="-3/6 mx-auto"src="ata:image/svg+xml;base64,g=="alt="0clouds logo"
          </div>
          <h1 style="olor: #602ae0"class="ext-4xl font-bold text-center mb-4"CodeMind</h1>
          <h3 class="ext-xl font-semibold text-center mb-6"GPT-4 Powered Coding Assistant</h3>
          <p class="ext-base mb-4"Describe what you want to do with the selected code. Keep in mind that GPT will know only about the context of what is in this file alone.</p>
          <textarea style="eight: 26rem"class="-full h-96 text-white bg-gray-700 p-4 text-sm resize-none mb-4"placeholder="sk something"id="rompt-input"${DEFAULT_PROMPT}</textarea>
          <div class="ext-base mb-4 text-center"id="oken-count"</div>
          
        </div>

        <script>
          
        </script>
      </body>
      </html>`;
  }
  */


const container = document.getElementById("root");
if (!container) {
  throw new Error("Container not found");
}
const root = createRoot(container); // createRoot(container!) if you use TypeScript
root.render(<CodeMindChat />);

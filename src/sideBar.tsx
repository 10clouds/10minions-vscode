import * as React from "react";
import { createRoot } from "react-dom/client";
import { Logo } from "./Logo";

declare const acquireVsCodeApi: any;

const vscode = acquireVsCodeApi();

const DEFAULT_PROMPTS = [
  {
    label: "Refactor",
    value: `You are an expert senior coder with IQ of 200, first provide critique of the code given, and provide a plan for changes and then provide a new version of it.

Your code should be simple, consise, maintainable, readable and ready for production. Rewrite parts of it if needed, but keep the final result and side effects the same. Split and join the functions as needed. Introduce or remove types. You may optimise the code, especially if it will make it more parallelized. You may change the names of the functions and create subroutines. Either provide simple documentation or make the code readable enough that it does not need docs. The code quality and documentation should be on par with top open source projects, as this is a part of a top open source project.`,
  },
  {
    label: "Fix",
    value: `You are an expert senior coder with IQ of 200, you are about to get a request from a simpleton layman. Figure out what is his intention and creativelly and proactivelly propose a solution to fix the CODE: 

`,
  },
  // Add more predefined prompts here
];

// eslint-disable-next-line @typescript-eslint/naming-convention
export const CodeMindChat: React.FC = () => {
  let [prompt, setPrompt] = React.useState(DEFAULT_PROMPTS[0].value);
  let [preset, setPreset] = React.useState(DEFAULT_PROMPTS[0].label);
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

  function handlePromptSelect(e: any) {
    const selectedPrompt = DEFAULT_PROMPTS.find(
      (p) => p.label === e.target.value
    );
    setPreset(
      selectedPrompt?.label ? selectedPrompt.label : DEFAULT_PROMPTS[0].label
    );
    if (selectedPrompt) {
      setPrompt(selectedPrompt.value);
    }
  }

  // Handle messages sent from the extension to the webview
  window.addEventListener("message", (event) => {
    const message = event.data;

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
        Choose a predefined prompt or describe what you want to do with the
        selected code. Keep in mind that GPT will know only about the context of
        what is in this file alone.
      </p>
      <div className="text-base mb-4">
        <label htmlFor="prompt-select" className="mr-2">
          Preset:
        </label>
        <select
          className="mb-4 text-base rounded px-4 py-2 bg-gray-800"
          id="prompt-select"
          onChange={handlePromptSelect}
          value={DEFAULT_PROMPTS.find((p) => p.value === prompt)?.label}
        >
          {DEFAULT_PROMPTS.map((prompt) => (
            <option key={prompt.label}>{prompt.label}</option>
          ))}
        </select>
      </div>
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
        {preset}
      </button>
    </div>
  );
};

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(<CodeMindChat />);

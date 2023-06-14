import * as React from "react";

export function ApiKeyInfoMessage() {
  return (
    <div className="mb-4">
      <p className="mb-2">
        <span className="font-bold">10Minions</span> needs an API key to work. You can get one from{" "}
        <a href="https://platform.openai.com/overview" target="_blank" rel="noopener noreferrer" className="text-blue-500">
          OpenAI
        </a>{' '}
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

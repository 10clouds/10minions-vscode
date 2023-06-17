import * as React from "react";
import { BRAND_COLOR, blendWithForeground } from "../utils/blendColors";
import { postMessageToVsCode } from "./SideBarWebViewInnerComponent";
import { MessageToVSCodeType } from "../Messages";

export function MissingApiKeyInfoMessage({ missingModels }: { missingModels?: string[] }) {
  return (
    <div className="p-6 mb-4">
      {!missingModels && (
        <p className="mb-4">
          Please provide an <span className="font-semibold">OpenAI API key with access to GPT-4</span> in order to finish setting up 10Minions.
        </p>
      )}

      {missingModels && (
        <>
          <p className="mb-4">Your provided OpenAI key does not have access to:</p>
          <ul className="list-disc list-inside mb-4">
            {missingModels.map((model, index) => (
              <li key={index} style={{ color: blendWithForeground(BRAND_COLOR, 0.75) }} className="font-semibold">
                {model}
              </li>
            ))}
          </ul>

          <p className="mb-4">Please provide one with access to those models.</p>
        </>
      )}

      <p className="mb-2">Required steps:</p>
      <ol className="list-decimal list-inside mb-4">
        <li className="mb-2">
          Get one from{" "}
          <a
            href="https://platform.openai.com/account/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-semibold"
            style={{ color: blendWithForeground(BRAND_COLOR, 0.75) }}
          >
            OpenAI
          </a>
          .
        </li>
        <li className="mb-2">
          Once you have an API key, set it in the{" "}
          <span
            className="underline cursor-pointer font-semibold"
            style={{ color: blendWithForeground(BRAND_COLOR, 0.75) }}
            onClick={() => {
              postMessageToVsCode({ type: MessageToVSCodeType.EditApiKey });
            }}
          >
            Settings
          </span>
          .
        </li>
      </ol>
    </div>
  );
}

/*
Recently applied task: Turn this into an ordered list
*/

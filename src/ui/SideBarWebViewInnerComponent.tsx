/*
Now, the WebView sends the "getSuggestions" message only if the sidebar is
visible, and updates the visibility status according to messages received from
the main extension. Make sure to implement the logic in the main extension to
send the "updateSidebarVisibility" messages.
*/

import * as React from "react";
import { createRoot } from "react-dom/client";
import { MessageToVSCode, MessageToWebView } from "../Messages";
import { MinionTaskUIInfo } from "./MinionTaskUIInfo";
import { Logo } from "./Logo";
import { ALL_MINION_ICONS_OUTLINE } from "./MinionIconsOutline";
import { GoButton } from "./GoButton";
import { MinionTaskListComponent } from "./MinionTaskListComponent";
import { Header } from "./Header";
import { ApiKeyInfoMessage } from "./ApiKeyInfoMessage";
import { useTemporaryFlag } from "./useTemporaryFlag";

declare const acquireVsCodeApi: any;

const vscode = acquireVsCodeApi();

export function postMessageToVsCode(message: MessageToVSCode) {
  vscode.postMessage(message);
}
const getWordWidths = (text: string, spanElem: HTMLSpanElement) => {
  const wordWidths: number[] = [];
  const wordWidthMap: { [word: string]: number } = {};

  const tempSpan = spanElem;
  tempSpan.style.position = "absolute";
  tempSpan.style.visibility = "hidden";

  // Updated regex for splitting text into words + whitespaces, including whitespaces in the array
  const words = text.split(/(\s+)/);

  for (const word of words) {
    tempSpan.textContent = word;
    const width = tempSpan.clientWidth;
    wordWidths.push(width);
    wordWidthMap[word] = width;
  }
  return { wordWidths, wordWidthMap };
};

const getLastRenderedLine = (text: string, textareaWidth: number, spanElem: HTMLSpanElement) => {
  const { wordWidths, wordWidthMap } = getWordWidths(text, spanElem);

  // Updated regex to split text into words + whitespaces
  const words = text.split(/(\s+)/);

  const lines: number[] = [];

  let currentLineWidth = 0;

  for (let i = 0; i < wordWidths.length; i++) {
    const width = wordWidths[i];
    const word = words[i];

    if (currentLineWidth + width > textareaWidth) {
      currentLineWidth = 0;
      lines.push(0);
    }

    currentLineWidth += width;
    lines[lines.length - 1] += wordWidthMap[word];
  }

  return {
    lastLineWidth: lines[lines.length - 1],
    lineCount: lines.length,
  };
};

export const SideBarWebViewInnerComponent: React.FC = () => {
  const [userInputPrompt, setUserInputPrompt] = React.useState("");
  const [executionList, setExecutionList] = React.useState<MinionTaskUIInfo[]>([]);
  const [apiKeySet, setApiKeySet] = React.useState<true | false | undefined>(undefined);
  const [scrollPosition, setScrollPosition] = React.useState({ scrollLeft: 0, scrollTop: 0 });
  const [selectedSuggestion, setSelectedSuggestion] = React.useState("");
  let [justClickedGo, markJustClickedGo] = useTemporaryFlag();
  const [isSidebarVisible, setIsSidebarVisible] = React.useState(true);

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
      case "updateSidebarVisibility":
        setIsSidebarVisible(message.value);
        if (isSidebarVisible) {
          postMessageToVsCode({
            type: "getSuggestions",
            input: userInputPrompt,
          });
        }
        break;
      case "suggestion":
        setSelectedSuggestion(message.value || "");
        break;
      case "selectedTextUpdated":
        if (isSidebarVisible) {
          postMessageToVsCode({
            type: "getSuggestions",
            input: userInputPrompt,
          });
        }
        break;
    }
  }

  function handleClearAndFocus() {
    setUserInputPrompt("");
    const input = document.querySelector("textarea");
    input?.focus();
  }

  function handleExecutionsUpdated(executions: MinionTaskUIInfo[]) {
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

  const handleTextAreaClick = React.useCallback((e: React.MouseEvent<HTMLTextAreaElement, MouseEvent>) => {
    if (textAreaRef.current) {
      const { scrollLeft, scrollTop } = textAreaRef.current;
      setScrollPosition({ scrollLeft, scrollTop });
    }
  }, []);

  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  function handleTextAreaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setUserInputPrompt(e.target.value);
    if (!selectedSuggestion.includes(e.target.value)) setSelectedSuggestion("");
    if (e.target.value === "") setSelectedSuggestion("");

    // Clear previous timeout before setting a new one
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set a new timeout for 1 second and fire postMessageToVsCode if uninterrupted
    timeoutRef.current = setTimeout(() => {
      postMessageToVsCode({
        type: "getSuggestions",
        input: e.target.value,
      });
    }, 1000);
  }

  //get two random different robot icons
  const [RobotIcon1, RobotIcon2] = React.useMemo(() => {
    const randomIndex = Math.floor(Math.random() * ALL_MINION_ICONS_OUTLINE.length);
    return [ALL_MINION_ICONS_OUTLINE[randomIndex], ALL_MINION_ICONS_OUTLINE[(randomIndex + 1) % ALL_MINION_ICONS_OUTLINE.length]];
  }, []);

  const textAreaRef = React.useRef<HTMLTextAreaElement>(null);
  const [postfix, setPostfix] = React.useState("");

  React.useEffect(() => {
    postMessageToVsCode({
      type: "getSuggestions",
      input: userInputPrompt,
    });
  }, []);

  const [isTextAreaFocused, setIsTextAreaFocused] = React.useState(false);

  React.useEffect(() => {
    setPostfix(`${userInputPrompt.length > 0 || isTextAreaFocused ? "\n\n" : ""}${selectedSuggestion}`);
  }, [selectedSuggestion, userInputPrompt, isTextAreaFocused]);

  return (
    <div className="w-full">
      <div className="p-4 mb-16">
        <Header RobotIcon1={RobotIcon1} RobotIcon2={RobotIcon2} />

        {apiKeySet === false && <ApiKeyInfoMessage />}

        {apiKeySet === true && (
          <>
            <div className="mb-2">
              Summon a Minion! Jot down your coding task and delegate to your loyal Minion. Remember, each Minion lives in a context of a specific file. For
              pinpoint precision, select the code involved.{" "}
            </div>
            <div style={{ position: "relative" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    flexWrap: "wrap",
                    color: "rgba(var(--vscode-editor-foreground), 0.5)", // Grayed-out text color
                    alignItems: "baseline",
                  }}
                >
                  <textarea
                    ref={textAreaRef}
                    style={{
                      position: "relative",
                      height: "20rem",
                      backgroundColor: "var(--vscode-editor-background)",
                      color: "rgba(0,0,0,100)", // Transparent text color
                      borderColor: "var(--vscode-focusBorder)",
                      caretColor: "var(--vscode-editor-foreground)", // Change cursor color to editor foreground color
                    }}
                    className="w-full h-96 mb-3 p-4 text-sm resize-none focus:outline-none"
                    value={userInputPrompt}
                    onChange={handleTextAreaChange}
                    onScroll={handleTextAreaClick}
                    onInput={handleTextAreaChange}
                    onFocus={() => setIsTextAreaFocused(true)}
                    onBlur={() => setIsTextAreaFocused(false)}
                    onKeyDown={(e) => {
                      // Check for Tab key and if the selectedSuggestion is valid
                      if (e.key === "Tab" && selectedSuggestion.length > 0) {
                        e.preventDefault(); // Prevent default tab behavior
                        handleSuggestionClick(selectedSuggestion);
                      }
                      // Check for Enter key and if the Shift key is NOT pressed
                      else if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault(); // Prevent default line break behavior

                        if (justClickedGo) return; // Prevent double submission
                        // Submit userInputPrompt by calling postMessageToVsCode function
                        postMessageToVsCode({
                          type: "newExecution",
                          value: userInputPrompt,
                        });

                        markJustClickedGo();
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
                    }}
                    className="w-full h-96 p-4 text-sm resize-none focus:outline-none pointer-events-none"
                  >
                    <span style={{ opacity: 1.0 }}>{userInputPrompt}</span>
                    <span style={{ opacity: 0.5 }}>{postfix}</span>
                    <br />
                    {selectedSuggestion && isTextAreaFocused && <span style={{ opacity: 0.5 }}>Press Tab to accept suggestion</span>}
                  </div>
                </div>
                <GoButton
                  onClick={() => {
                    postMessageToVsCode({
                      type: "newExecution",
                      value: userInputPrompt,
                    });
                  }}
                  justClickedGo={justClickedGo}
                  markJustClickedGo={markJustClickedGo}
                />

                <MinionTaskListComponent executionList={executionList} />
              </div>

              <div
                // Update className to achieve better centering, margin, padding, and width
                className="text-center p-4 fixed bottom-0 w-full"
                key="credits"
                style={{
                  backgroundColor: "var(--vscode-sideBar-background)",
                  zIndex: 1000,
                }}
              >
                <a className="inline-block w-20 logo" href="https://10clouds.com" target="_blank" rel="noopener noreferrer">
                  by <br />
                  <Logo className="inline-block w-20" />
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(<SideBarWebViewInnerComponent />);

/*
Recently applied task: Make this code count widths of whitespace as they are in the original text.

Make sure that you maintain the standard line breaking rules.
*/

/*
Recently applied task: handle whitespace words correctly here
*/

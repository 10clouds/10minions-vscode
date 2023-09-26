import { useEffect, useState, KeyboardEvent } from 'react';
import { MessageToVSCodeType } from '10minions-engine/dist/src/managers/Messages';
import { postMessageToVsCode } from '../utils/postMessageToVsCode';

export const useSuggestions = (
  setUserInputPrompt: (value: React.SetStateAction<string>) => void,
  userInputPrompt: string,
) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [suggestionInputBase, setSuggestionInputBase] = useState<
    string | undefined
  >(undefined);
  const currentSuggestion = suggestions[suggestionIndex];

  useEffect(() => {
    if (suggestionInputBase !== userInputPrompt) {
      setSuggestionInputBase(userInputPrompt);
      postMessageToVsCode({
        type: MessageToVSCodeType.SUGGESTION_GET,
        input: userInputPrompt,
      });
    }
  }, [userInputPrompt, suggestionInputBase]);

  const handleSuggestionClick = () => {
    setUserInputPrompt(currentSuggestion);
    setSuggestions([]);
  };

  const previousSuggestion = () => {
    setSuggestionIndex(
      (suggestionIndex + suggestions.length - 1) % suggestions.length,
    );
  };

  const nextSuggestion = () => {
    setSuggestionIndex((suggestionIndex + 1) % suggestions.length);
  };

  const setNewSuggestions = (suggestions: string[]) => {
    setSuggestions(suggestions);
    setSuggestionIndex(0);
  };

  const clearSuggestions = () => {
    setSuggestions([]);
    setSuggestionInputBase(undefined);
  };

  const handleKeyDown =
    (onSubmit: () => void) => (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Get current cursor position in textarea
      const cursorPositionStart = e.currentTarget.selectionStart ?? 0;
      const cursorPositionEnd = e.currentTarget.selectionEnd ?? 0;
      const textAreaContent = e.currentTarget.value;

      // If left arrow key pressed and cursor is at the beginning of the content
      if (
        (e.key === 'ArrowLeft' || e.key === 'ArrowUp') &&
        cursorPositionStart === 0 &&
        cursorPositionEnd === 0
      ) {
        previousSuggestion();
      }
      // If right arrow key pressed and cursor is at the end of the content
      else if (
        (e.key === 'ArrowRight' || e.key === 'ArrowDown') &&
        cursorPositionStart === textAreaContent.length &&
        cursorPositionEnd === textAreaContent.length
      ) {
        nextSuggestion();
      }

      // Check for Tab key and if the selectedSuggestion is valid
      if (
        e.key === 'Tab' &&
        currentSuggestion &&
        currentSuggestion.length > 0
      ) {
        e.preventDefault(); // Prevent default tab behavior
        handleSuggestionClick();
      }
      // Check for Enter key and if the Shift key is NOT pressed
      else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Prevent default line break behavior

        // Submit userInputPrompt by calling postMessageToVsCode function
        onSubmit();
      }
    };

  return {
    suggestions,
    suggestionIndex,
    suggestionInputBase,
    currentSuggestion,
    handleSuggestionClick,
    handleKeyDown,
    previousSuggestion,
    nextSuggestion,
    setSuggestionInputBase,
    clearSuggestions,
    setNewSuggestions,
  };
};

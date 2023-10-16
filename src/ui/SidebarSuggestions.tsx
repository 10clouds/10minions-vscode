import React from 'react';

interface SidebarSuggestionsProps {
  suggestions: string[];
  suggestionIndex: number;
  onClick: () => void;
  previousSuggestion: () => void;
  nextSuggestion: () => void;
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
  userInputPrompt: string;
  currentSuggestion: string;
}

const SidebarSuggestions = ({
  suggestions,
  nextSuggestion,
  previousSuggestion,
  onClick,
  suggestionIndex,
  textAreaRef,
  userInputPrompt,
  currentSuggestion,
}: SidebarSuggestionsProps) => {
  // currentSuggestion && currentSuggestion.toLowerCase().startsWith(userInputPrompt.toLowerCase());
  const userInputStartsSuggestion = userInputPrompt.length === 0;

  const handleClick =
    (onClick: () => void) =>
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      onClick();
      textAreaRef.current?.focus();
    };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        height: '12rem',
        pointerEvents: 'none',
        color: 'rgba(var(--vscode-editor-foreground), 0.5)',
        overflow: 'hidden',
        whiteSpace: 'pre-wrap',
        zIndex: 1000,
      }}
      className="w-full h-96 p-4 text-sm resize-none focus:outline-none pointer-events-none"
    >
      <span style={{ opacity: 0.0 }}>{userInputPrompt}</span>
      {!userInputStartsSuggestion && (
        <>
          <br />
          <br />
        </>
      )}
      {!userInputStartsSuggestion && suggestions.length > 0 && (
        <span style={{ opacity: 0.4 }}>
          Suggestion:
          <br />
        </span>
      )}
      {
        <span style={{ opacity: 0.6 }}>
          {userInputStartsSuggestion
            ? currentSuggestion?.slice(userInputPrompt.length)
            : currentSuggestion || ''}
        </span>
      }
      <br />
      {suggestions.length > 0 && (
        <span style={{ opacity: 0.4 }}>
          Press Tab to{' '}
          <button
            className="cursor-pointer pointer-events-auto"
            onClick={onClick}
          >
            accept
          </button>{' '}
          suggestion{' '}
          {suggestions.length > 1 && (
            <>
              <button
                className="cursor-pointer pointer-events-auto"
                onClick={handleClick(previousSuggestion)}
              >
                {'< '}
              </button>
              {suggestionIndex + 1 + ' / ' + suggestions.length}
              <button
                className="cursor-pointer pointer-events-auto"
                onClick={handleClick(nextSuggestion)}
              >
                {' >'}
              </button>
            </>
          )}
        </span>
      )}
    </div>
  );
};

export default SidebarSuggestions;

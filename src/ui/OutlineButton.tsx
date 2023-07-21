import React from 'react';

export function OutlineButton({
  title,
  onClick,
  description,
  className = '',
}: {
  description: string;
  title: string;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  className?: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        borderColor: 'var(--vscode-button-separator)',
      }}
      className={'cursor-pointer border rounded px-2 ' + className}
    >
      {description}
    </button>
  );
}

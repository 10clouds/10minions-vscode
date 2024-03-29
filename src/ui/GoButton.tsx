import React from 'react';
import { BRAND_COLOR, blendWithForeground } from './utils/blendColors';

export function GoButton({
  onClick,
  clicked,
}: {
  onClick?: () => void;
  clicked: boolean;
}) {
  return (
    <button
      style={{
        backgroundColor: blendWithForeground(BRAND_COLOR, 0.75),
        color: blendWithForeground('#ffffff', 0.75),
      }}
      className={
        'w-full mb-4 font-bold py-2 px-4 rounded transition-all duration-100 ease-in-out ' +
        (clicked ? 'opacity-50' : '')
      }
      type="submit"
      onClick={() => {
        onClick?.();
      }}
      disabled={clicked}
    >
      Go
    </button>
  );
}

import { useEffect, useState } from "react";

type TemporaryFlagHook = Readonly<[boolean, () => void]>;

function resetFlagAfterDuration(
  flag: boolean,
  duration: number,
  setFlag: (value: boolean) => void
) {
  if (!flag) return;

  const timeout = setTimeout(() => {
    setFlag(false);
  }, duration);

  return () => clearTimeout(timeout);
}

/**
 * A custom React hook that manages a temporary boolean flag.
 * The flag is set to `true` for a specified duration and then automatically reverts back to `false`.
 *
 * @param {number} duration Duration in milliseconds for the flag to remain true (default: 1000)
 * @returns {Readonly<[boolean, () => void]>} An array with the flag value and a function to trigger the temporary change.
 */

export function useTemporaryFlag(duration: number = 1000): TemporaryFlagHook {
  const [flag, setFlag] = useState(false);

  useEffect(
    () => resetFlagAfterDuration(flag, duration, setFlag),
    [flag, duration]
  );

  return [flag, () => setFlag(true)];
}

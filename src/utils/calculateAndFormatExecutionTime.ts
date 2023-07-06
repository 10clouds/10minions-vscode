// Function to calculate and format the execution time in HH:mm:SS format
export function calculateAndFormatExecutionTime(
  executionDuration: number,
): string {
  // Function to format the time parts in HH:mm:SS format
  function formatExecutionTime(
    hours: number,
    minutes: number,
    seconds: number,
  ): string {
    const paddedHours = hours.toString().padStart(2, '0');
    const paddedMinutes = minutes.toString().padStart(2, '0');
    const paddedSeconds = seconds.toFixed(0).padStart(2, '0');
    return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
  }

  // Calculate the execution time parts
  const executionTimeSec = executionDuration / 1000;
  const hours = Math.floor(executionTimeSec / 3600);
  const remainingSecAfterHours = executionTimeSec % 3600;
  const minutes = Math.floor(remainingSecAfterHours / 60);
  const remainingSecAfterMinutes = remainingSecAfterHours % 60;

  // Format the execution time
  return formatExecutionTime(hours, minutes, remainingSecAfterMinutes);
}

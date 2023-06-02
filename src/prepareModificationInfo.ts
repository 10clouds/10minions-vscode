export function prepareModificationInfo(userQuery: string, startTime: number) {
  let seconds = (Date.now() - startTime) / 1000;

  //format time to 00:00:00
  let hours = Math.floor(seconds / 3600);
  seconds = seconds % 3600;
  let minutes = Math.floor(seconds / 60);
  seconds = seconds % 60;

  let formatted = `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toFixed(0).padStart(2, "0")}`;
  let userQueryPreview = userQuery.split("\n")[0].substring(0, 500);

  let prefix = `
/*
 * 10Clouds CodeMind AI
 *
 * ${userQueryPreview}
 * Duration: ${formatted}
 * Time: ${new Date().toISOString().replace(/T/, " ").replace(/\..+/, "")}
 *\/
`.trim();
  return prefix;
}

import { randomBytes } from "crypto";

export type MappedContent = {
  id: string;
  lastKnownPosition: number;
  line: string;
}[];

export function mapFileContents(contents: string): MappedContent {
  return contents.split("\n").map((line, index) => {
    return {
      id: randomBytes(4).toString("hex"),
      lastKnownPosition: index,
      line,
    };
  });
}

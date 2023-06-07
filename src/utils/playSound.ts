import { ExtensionContext, workspace } from "vscode";
import * as path from "path";

const ps = require("play-sound")();

let CONTEXT: ExtensionContext;

export function initPlayingSounds(context: ExtensionContext) {
  CONTEXT = context;
}

export function playNotificationSound() {
  if (workspace.getConfiguration("10minions").get("enableCompletionSounds")) {
    ps.play(
      path.join(CONTEXT.extensionPath, "resources", "notification.wav"),
      (err: any) => {
        if (err) {
          console.log("Error occurred while playing sound:", err);
        }
      }
    );  
  }
}

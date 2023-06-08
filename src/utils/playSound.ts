import { ExtensionContext, workspace } from "vscode";
import * as path from "path";
import * as sound from "sound-play";

let CONTEXT: ExtensionContext;

export function initPlayingSounds(context: ExtensionContext) {
  CONTEXT = context;
}

export function playNotificationSound() {
  if (workspace.getConfiguration("10minions").get("enableCompletionSounds")) {
    sound.play(
      path.join(CONTEXT.extensionPath, "resources", "notification.wav"),
    );
  }
}

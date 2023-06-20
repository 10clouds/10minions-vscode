import * as path from "path";
import Mocha from "mocha";
import glob from "glob";

export function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
    timeout: 600000,
    //diff: true,
    //bail: true,
    //grep: "Create",
  });

  const testsRoot = path.resolve(__dirname);

  return new Promise((c, e) => {
    glob("**/**.test.ts", { cwd: testsRoot }, (err: any, files: string[]) => {
      if (err) {
        return e(err);
      }

      files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

      try {
        mocha.run((failures: any) => {
          if (failures > 0) {
            e(new Error(`${failures} tests failed.`));
          } else {
            c();
          }
        });
      } catch (err) {
        console.error(err);
        e(err);
      }
    });
  });
}

run();

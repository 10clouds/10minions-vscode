# 10Minions: GPT-4 Powered Coding Assistant (VSCode Extension) README

Unleash your fleet of digital minions with 10Minions by 10Clouds. Crafted with unparalleled AI power, each minion is an autonomous force in your codebase. Assign them tasks, sit back, and watch as they work diligently and concurrently on your projects, ensuring your code is clean, efficient, and up to industry standards. The power of multi-tasking has never been this simple.

With 10Minions, you can:

Simplify complex code tasks with natural language directives.

Streamline your coding process across a multitude of files.

Let the minions collaborate to deliver optimum solutions.

Save precious time and mental bandwidth by allowing the minions to carry out multiple operations concurrently.

Utilize the minions across a broad spectrum of programming languages.

10Minions by 10Clouds is your tireless team of code optimizers, diligently working behind the scenes to help you maintain a clean, efficient, and robust codebase. Discover the magic of autonomous coding and maximize your productivity with 10Minions today.



Plugin is using existing APIs to streamline work in visual studio.

What it does? You write what change you want developed on a given file, then press go, and wait for the AI to fix that code for you. It takes a while as it’s multiple GPT-4 calls, but you can run this multiple times on multiple files concurrently, while you work on something else.

Repo: https://github.com/10clouds/codemind 

This needs to be released mid June.

Should work with any coding language

Actual use cases I used this for:

Editing ESLintrc, to remove the line size limit (I forgot how to do it and did not want to google it)

Made code work, extracted funciionality to a new file, run the Code Cook, without any prompt on it, just for it to clean it up (proposed better names etc).

I did a setTimeout hack just to do something after everything is rendered, I went back to this code and ordered CodeCook to “Fix this hack”

I have an unknown object returned by the api “console.log(stream);Did not result in meaningful results. I selected this text and asked “Log type data of stream, it's methods etc”, it returned:

// Log the type data of the stream and its methods
    console.log('Stream type:', typeof stream);
    console.log('Stream methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(stream)));

I’m writing code, I added new state for messages history, while I continue working on the logic of adding messages to the history I marked some of the component code and asked for fix: “Render messages somewhere around here” it came up with this:

{/* Render messages */}
          <div className="messages-container">
            {messages.map((message, index) => (
              <p key={index} className={`message ${message.role}`}>
                {message.content}
               </p>
            ))}
          </div>

Then I asked it to make it pretty using only tailwind classes remove any other classes, and it created this:

<div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 mt-5">
            {messages.map((message, index) => (
              <p
                key={index}
                className={`${
                  message.role === "assistant"
                    ? "bg-blue-500 text-white dark:bg-blue-600"
                    : "bg-gray-200 text-gray-900 dark:bg-gray-600 dark:text-gray-300"
                } rounded-lg p-2 my-2`}
              >
                {message.content}
              </p>
            ))}
          </div>

# CodeCook: GPT-4 Powered Coding Assistant (VSCode Extension) README
>>>>>>> 06df847fafb2768313634b487104e6d9d4e3e574

This is the README for your extension "10clouds-gpt". After writing up a brief description, we recommend including the following sections.

## Features

Describe specific features of your extension including screenshots of your extension in action. Image paths are relative to this README file.

For example if there is an image subfolder under your extension project workspace:

\!\[feature X\]\(images/feature-x.png\)

> Tip: Many popular extensions utilize animations. This is an excellent way to show off your extension! We recommend short, focused animations that are easy to follow.

## Requirements

If you have any requirements or dependencies, add a section describing those and how to install and configure them.

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: Enable/disable this extension.
* `myExtension.thing`: Set to `blah` to do something.

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0

Initial release of ...

### 1.0.1

Fixed issue #.

### 1.1.0

Added features X, Y, and Z.

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**

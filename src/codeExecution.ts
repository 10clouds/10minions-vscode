/**
 * Extract JavaScript code block enclosed by "```javascript" and "```".
 * @param {string} text - String containing the code block.
 * @returns {string} - Extracted JavaScript code block.
 */
export function extractJavascriptCodeBlock(text: string): string {
  if (typeof text !== 'string') return '';

  const lines = text.split('\n');
  let blockContent = '';
  let blockCount = 0;
  let blockStarted = false;

  for (const line of lines) {
    if (line === '```javascript') {
      if (blockStarted) return '';
      blockStarted = true;
    } else if (line === '```') {
      if (!blockStarted) return '';
      blockCount++;
      blockStarted = false;
      if (blockCount > 1) return '';
    } else if (blockStarted) {
      blockContent += `${line}\n`;
    }
  }

  if (!blockStarted && blockCount === 1) {
    return blockContent.trim();
  }

  if (!blockStarted && blockCount === 0) {
    return text.trim();
  }
  
  return '';
}

/**
 * Evaluate JavaScript code within the given context.
 * @param {Record<string, any>} context - Input context for code evaluation.
 * @param {string} code - JavaScript code to evaluate.
 * @returns {any} - The result of the evaluation.
 */
function evalWithContext(context: Record<string, any>, code: string): any {
  const sandboxedFunction = new Function(...Object.keys(context), code);
  return sandboxedFunction(...Object.values(context));
}

/**
 * Transform input code by removing 'import', 'export' and updating the function name.
 * @param {string} code - Input code to transform.
 * @returns {Promise<string>} - Transformed code as a string.
 */
async function transformCode(code: string): Promise<string> {
  const lines = code
    .split('\n')
    .filter((line) => !line.startsWith('import'))
    .map((line) => {
      if (line.startsWith('export default')) {
        return line.replace('export default', '');
      } else if (line.startsWith('export')) {
        return line.replace('export', '');
      } else if (line.includes('async function _command() {')) {
        return line.replace('async function _command() {', 'async function command() {');
      }
      return line;
    });

  return lines.join('\n');
}

export async function executeCode(modificationCode: string, codeToModify: string): Promise<string> {
  try {
    const output = extractJavascriptCodeBlock(modificationCode);

    const transformedCode = await transformCode(output);

    const enclosedCode = `return (${transformedCode})(codeToModify);`;

    console.log('Enclosed code:');
    console.log(enclosedCode);

    const flattenedApis = {
        codeToModify
    };
    
    const executionResult: string = evalWithContext(flattenedApis, enclosedCode);
    return executionResult;
  } catch (error) {
    console.error('Error executing Javascript code:', error);
    return `ERROR: Couldn't execute Javascript code\n${error}`;
  }
}

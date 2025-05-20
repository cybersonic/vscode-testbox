const { spawn } = require('child_process');
const { getCFTokensBinaryPath } = require('./cftokensLoader');
/**
 * Tokenizes a CFML test file and returns a parsed tree of test blocks.
 * @param {string} filePath - Absolute path to the CFML test file.
 * @returns {Promise<Object[]>} Tree of parsed test structures.
 */

const cftokensPath = getCFTokensBinaryPath();
function getTestsFromFile(filePath) {
  return new Promise((resolve, reject) => {
    const child = spawn(cftokensPath, ['tokenize', filePath]);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`cftokens exited with code ${code}: ${stderr}`));
      }

      try {
        const tokens = JSON.parse(stdout);
                      // parseBlocks(tokens);
        const parsed = parseTestTokens(tokens);
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Failed to parse output as JSON: ${err.message}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to execute cftokens: ${err.message}`));
    });
  });
}
function getTestsFromText(content) {
  return new Promise((resolve, reject) => {
    const child = spawn(cftokensPath, ['tokenize', '-']);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`cftokens exited with code ${code}: ${stderr}`));
      }

      try {
        const tokens = JSON.parse(stdout);
              // parseBlocks(tokens);
        const parsed = parseTestTokens(tokens);
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Failed to parse output as JSON: ${err.message}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to execute cftokens: ${err.message}`));
    });

    // Pipe the content into stdin
    child.stdin.write(content);
    child.stdin.end();
  });
}
/**
 * Parses a list of tokens and constructs a hierarchical representation of test functions
 * and their associated metadata, such as type, title, line numbers, and range.
 *
 * @param {Array.<[string, string[]]>} tokens - An array of tokens, where each token is a tuple
 * consisting of the token text and its context (an array of strings representing the token's scope).
 * 
 * @returns {Array.<Object>} An array of root nodes representing the parsed test functions. Each node
 * contains the following properties:
 *   - `type` {string}: The type of the test function (e.g., "describe", "it").
 *   - `title` {string}: The title of the test function, extracted from double-quoted strings.
 *   - `line` {number}: The starting line number of the test function.
 *   - `offset` {number}: The starting offset of the test function.
 *   - `endLine` {number|null}: The ending line number of the test function (null if not determined).
 *   - `endOffset` {number|null}: The ending offset of the test function (null if not determined).
 *   - `children` {Array.<Object>}: An array of child nodes representing nested test functions.
 *   - `range` {Object}: An object representing the start and end positions of the test function:
 *       - `start` {Object}: The starting position with `line` and `column`.
 *       - `end` {Object|null}: The ending position with `line` and `column` (null if not determined).
 */
function parseTestTokens(tokens) {
  const functionKeywords = new Set([
    "describe", "xdescribe",
    "it", "xit",
    "given", "xgiven",
    "when", "xwhen",
    "then", "xthen",
    "feature", "xfeature",
    "scenario", "xscenario",
    "story", "xstory"
  ]);

  const isComment = ctx => ctx.some(c => c.includes("comment"));
  const isBlockStart = ctx => ctx.includes("punctuation.section.block.begin.cfml");
  const isBlockEnd = ctx => ctx.includes("punctuation.section.block.end.cfml");

  let line = 0;
  let charInLine = 0;
  let offset = 0;

  const root = [];
  const scopeStack = [];
  let blockDepth = 0;
  let i = 0;

  while (i < tokens.length) {
    const [text, context] = tokens[i];
    const tokenStartLine = line;
    const tokenStartColumn = charInLine;
    const tokenOffset = offset;

    
    // Track line/column/offset
    if(text.indexOf("\n") > -1) {
      const newlineCount = (text.match(/\n/g) || []).length;
      line+= newlineCount;
      charInLine = 0;
      offset++;
      i++;
      continue;
    }

    offset += text.length;
    charInLine += text.length;

    if (isComment(context)) {
      i++;
      continue;
    }

    if (isBlockStart(context)) {
      blockDepth++;
      i++;
      continue;
    }

    if (isBlockEnd(context)) {
      blockDepth--;

      while (
        scopeStack.length > 0 &&
        scopeStack[scopeStack.length - 1].blockDepth > blockDepth
      ) {
        const scope = scopeStack.pop();
        scope.node.endLine = tokenStartLine;
        scope.node.endOffset = tokenOffset;
        scope.node.range.end = {
          line: tokenStartLine,
          column: tokenStartColumn
        };
      }

      i++;
      continue;
    }
    let skipped = false;
    if (functionKeywords.has(text)) {
      const fnType = text;
      const startLine = tokenStartLine;
      const startColumn = tokenStartColumn;
      const startOffset = tokenOffset;

      if(text.startsWith("x")) {
          skipped = true;
      }
      // Look ahead to collect title
      const title = lookAheadForTitle(tokens, i ).trim();
      // const title = titleParts.join("").trim();
      // let j = i + 1;
      // let titleStarted = false;
      // let titleParts = [];

      // This is the oild function but seeing why J is needed
      // while (j < tokens.length) {
      //   const [t, c] = tokens[j];
      //   if (t === '\n') {
      //     line++;
      //     charInLine = 0;
      //     offset++;
      //     j++;
      //     continue;
      //   }

      //   if (isComment(c)) {
      //     j++;
      //     continue;
      //   }

      //   offset += t.length;
      //   charInLine += t.length;

      //   if (isDoubleQuotedString(c)) {
      //     if (t === '"' && !titleStarted) {
      //       titleStarted = true;
      //     } else if (t === '"' && titleStarted) {
      //       break;
      //     } else if (titleStarted) {
      //       titleParts.push(t);
      //     }
      //   } else if (titleStarted) {
      //     break;
      //   }

      //   j++;
      // }
      // const title = titleParts.join("").trim();

      

      const node = {
        type: fnType,
        title,
        line: startLine,
        offset: startOffset,
        endLine: null,
        endOffset: null,
        children: [],
        skipped: skipped,
        range: {
          start: { line: startLine, column: startColumn },
          end: null // will be filled in when block ends
        }
      };

      const parent = scopeStack.length > 0 ? scopeStack[scopeStack.length - 1].node : null;
      if (parent) {
        parent.children.push(node);
      } else {
        root.push(node);
      }

      // Assume all functions open blocks, track for end positions
      scopeStack.push({ node, blockDepth: blockDepth + 1 });

      
    } 
      i++;
    
  }

  return root;
}


function lookAheadForTitle(tokens, startIndex, maxsearch=100) {
  let title = '';
  let i = startIndex;
  // let inFunctionCallParams = true;
  let inString = false;
  const maxLength = Math.min(tokens.length, startIndex + maxsearch);
  for(i = startIndex; i < maxLength; i++) {
    
    const [text, context] = tokens[i];
    // inFunctionCallParams = context.includes("meta.function-call.parameters.cfml");
    if(context.includes("punctuation.definition.string.begin.cfml")) {
      inString = true;
    }
    if(context.includes("punctuation.definition.string.end.cfml")) {
      inString = false;
    }

    if(inString
        && !context.includes("punctuation.definition.string.begin.cfml")
        && !context.includes("punctuation.definition.string.end.cfml")
    ) {
      return text;
      // console.log({text}, {context});
      
    }

  //   if (text === '\n') {
  //     break;
  //   }

  //   if (isDoubleQuotedString(context)) {
  //     title += text;
  //   } else {
  //     break;
  //   }
  // }
  // while (i < tokens.length) {
  //   const [text, context] = tokens[i];

  //   if (text === '\n') {
  //     break;
  //   }

  //   if (isDoubleQuotedString(context)) {
  //     title += text;
  //   } else {
  //     break;
  //   }

  //   i++;
  }

  return title.trim();
}

module.exports = { parseTestTokens, getTestsFromFile, getTestsFromText, lookAheadForTitle};

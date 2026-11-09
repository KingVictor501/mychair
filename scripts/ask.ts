// scripts/ask.ts
// WHAT IT'S FOR: the "ask a question" command. It sends your question through the answer engine
// (lib/answer.ts) and prints the answer and its source, like this:
//     ANSWER:  **30 days** for a refund ...
//     SOURCE:  returns-shipping-policy.txt · SECTION 1 — RETURNS
// If the documents don't contain the answer, it prints the exact refusal line and SOURCE: none.
// WHO USES IT: you, from your computer:
//     npm run ask -- "How long do I have to return something for a refund?"
// It uses your DEVELOPMENT database (.env.local), which holds the same corpus as production.
// WHY THE NAME: "ask" is what you do with it; a one-off command-line "script".
//
// SAFETY: it never prints keys. Failures print a short friendly message and the status number.

import { ClaudeError } from "../lib/anthropic";
import { answerQuestion } from "../lib/answer";
import { flushLogs } from "../lib/logger";

// Load the environment file BEFORE anything reads a key (built into Node; never overwrites
// a variable that is already set). Provides DATABASE_URL, OPENAI_API_KEY, ANTHROPIC_API_KEY.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: fine if the variables are already set some other way.
}

const MIN_QUESTION = 2;
const MAX_QUESTION = 500;

// Prints one line (we avoid console.log in this project).
function print(line: string): void {
  process.stdout.write(`${line}\n`);
}

// Turns a failed Claude call into a short, friendly hint. Never includes secrets.
function friendlyClaudeError(error: ClaudeError): string {
  switch (error.status) {
    case 401:
      return "Claude rejected the key (status 401). Check ANTHROPIC_API_KEY in .env.local.";
    case 400:
      return "Claude refused the request (status 400). Check that your credit balance is above zero and, if your key is not tied to one workspace, set ANTHROPIC_WORKSPACE_ID.";
    case 403:
    case 404:
      return `Claude denied access (status ${error.status}). Check the key's workspace and the model name.`;
    case 429:
      return "Too many requests or the credit ran out (status 429). Wait a moment and try again.";
    case null:
      return "Could not get an answer from Claude (no response). Check your internet connection and ANTHROPIC_API_KEY.";
    default:
      return `Claude returned an error (status ${error.status}). Try again in a minute.`;
  }
}

async function main(): Promise<number> {
  // Everything after the command is the question (so quotes are optional).
  const question = process.argv.slice(2).join(" ").trim();
  if (question.length < MIN_QUESTION || question.length > MAX_QUESTION) {
    print(`Please give a question between ${MIN_QUESTION} and ${MAX_QUESTION} characters.`);
    print('Example: npm run ask -- "How long do I have to return something for a refund?"');
    return 1;
  }

  try {
    const result = await answerQuestion(question);
    print("");
    print(`ANSWER:  ${result.answer}`);
    print(`SOURCE:  ${result.citations.length > 0 ? result.citations.join(" + ") : "none"}`);
    if (result.outcome === "malformed") {
      print("NOTE:    the reply did not follow the answer format (no valid Source line).");
    } else if (!result.citationsVerified) {
      print("NOTE:    a cited source did not match any passage that was retrieved.");
    }
    print("");
    return 0;
  } catch (error) {
    if (error instanceof ClaudeError) {
      print(friendlyClaudeError(error));
    } else {
      // Database or search problems: a short message only (the real cause is in the logs).
      print("Something went wrong while searching the documents. Check DATABASE_URL and OPENAI_API_KEY.");
    }
    return 1;
  } finally {
    // Save the log line to the database before the program exits.
    await flushLogs();
  }
}

main().then((code) => {
  process.exitCode = code;
});

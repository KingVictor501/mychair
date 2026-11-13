# Day 1: a cited answer engine over the MyChair documents

Ask a question and the engine answers from the MyChair documents, cites the document and section, and says "I don't know" when the documents don't cover it.

```
npm run ask -- "How late can I cancel an appointment?"
```

## How it works
Question → embed → find the top 3 passages in the vector store → label each passage with its document and section → ask Claude (`claude-sonnet-5-5`) to answer from only those passages → check the reply → print the answer and the source.

The search half is the pgvector search over 115 chunks from 14 documents in `mychair-corpus/`. The answer half is `lib/rag.ts` (the rules), `lib/anthropic.ts` (the Claude call), `lib/answer.ts` (the engine), and `scripts/ask.ts` (the command).

## 1. The behavior spec I gave my AI
The full spec is in [rag-spec.md](rag-spec.md). In short:

> Extend my search into a question-answering engine. Take a question from the command line, retrieve the top 3 passages from my vector store, and put them in a context block that keeps each passage's document name and section. Ask Claude, with the key from `ANTHROPIC_API_KEY`, to answer using only that context, in the format in `docs/answer-format.md`: 1 to 3 sentences with the key figure in bold, then a `Source: {document} · {section}` line. If the context doesn't contain the answer, reply with exactly `I don't know — the documents I have don't cover that.` and nothing else. Print the answer, then the source. Log numbers and yes/no facts only, never the question, the answer, or a key.

It describes behavior only. It doesn't name any functions.

## 2. What my review caught and confirmed
I checked the three load-bearing points on the first version of the code:

| Point | Result | Evidence |
|---|---|---|
| Source labels reach the model | Confirmed | Each passage goes in as `[document · section]` followed by its text. A test checks it (`lib/rag.test.ts`). |
| Grounding rule is in the prompt | Confirmed | The prompt says to use only the excerpts and never outside knowledge. A test checks that wording is present. |
| Refusal path exists | Confirmed | The prompt gives the exact refusal line and says to add nothing and no Source line. A test checks it. |

Three things the review caught beyond those points:
- **A log field would have been hidden.** The logger redacts any key containing "token", so a field named `inputTokens` would have been silently blanked. I named those fields `usageIn` and `usageOut`.
- **A workspace header may be required.** A Claude API key that isn't tied to one workspace needs an `anthropic-workspace-id` header or the API returns status 400. I added an optional `ANTHROPIC_WORKSPACE_ID` setting and a friendly error message.
- **The spec asked for something I couldn't confirm.** The spec said "low temperature", but the Claude docs don't say Sonnet 5.5 accepts it. I removed it and don't send the setting.

I also added a check the model can't skip: every citation in the reply must match the label of a passage that was actually retrieved. A citation that points at an invented section is flagged on screen.

## 3. A cited answer I verified against the real document
**Question:** How late can I cancel an appointment?

**Answer:** By default you can cancel up to **2 hours** before the appointment starts, after which the Cancel button is turned off. An owner can change this window for their shop, and the shop page shows the number that applies.

**Source:** `cancellation-and-no-show-policy.md · The cancellation window`

**Verified:** In `mychair-corpus/cancellation-and-no-show-policy.md`, the section "The cancellation window" says "By default you can cancel or reschedule on your own up to 2 hours before the appointment starts. Inside that window the Cancel button is turned off." The sentence that an owner can change the window is in the introduction at the top of the same file, which is why it appears as the second source. The engine's citation check passed.

## 4. A question that succeeded on meaning
**Question:** My barber got stuck in traffic and I got blamed for skipping, how do I get that erased?

**Answer:** The pro who was reserved for that appointment can **remove the no-show strike themselves**, and the owner and the Super Admin can also see and remove strikes. If you think the strike is wrong, ask your pro or contact the shop.

**Source:** `cancellation-and-no-show-policy.md · If something went wrong`

**Why this is a meaning win:** the words in my question that the passage never uses are **barber**, **stuck**, **traffic**, **blamed**, **skipping**, and **erased**. The passage says "pro", "running late", "no-show", "mistake", and "remove". They share only small words like "for", "that", and "and". Search ranked this passage first, at a score of 0.416 (see [semantic-search-tests.md](semantic-search-tests.md)).

## 5. An honest "I don't know"
**Question:** Do you sell hair gel?

**Printed exactly:**
```
ANSWER:  I don't know — the documents I have don't cover that.
SOURCE:  none
```

**Why it refused:** none of the 14 documents mentions selling products. The best passage scored only 0.30 in search.

## What I noticed along the way
- **The wording changes between runs.** The same question can be phrased differently each time. Answers stayed grounded and cited correctly. I don't control the randomness (see the temperature point above), which matters for scoring.
- **A bare file name can appear as a source.** In the cancellation answer, the second source was `cancellation-and-no-show-policy.md` with no section. It is a real passage: the introduction at the top of the file has no heading, so its label is just the file name. The citation check accepted it.
- **The refusal depends on the model.** Retrieval always returns the 3 closest passages, even for an off-topic question, and has no minimum score. The refusal for the hair-gel question worked, but search alone would have returned an unrelated passage.
- **Cost and speed.** Each answer sent about 540 to 670 input units and received 18 to 275 output units. That is well under a cent, and 2 to 3 seconds per question.

## Safety
- The Claude key is read from `.env.local`, which is gitignored. It is sent only in the `Authorization` header and never printed or logged.
- Errors show only the HTTP status number. Nothing from the question or the reply goes into an error.
- Each question writes one `rag_answer` log line with its length, passage count, top score, outcome, citation check, model, usage, and milliseconds. The question and answer text are never logged.

## Tests
`npm test` runs 57 tests, including 15 for this engine: the label format, the prompt's grounding and refusal wording, splitting citations (including a section named "Cut + Beard Trim"), the exact refusal line, rejecting invented citations, and reading Claude's reply.

## Files
| File | What it does |
|---|---|
| `lib/rag.ts` | Passage labels, the prompt, reply parsing, and the citation check |
| `lib/anthropic.ts` | The call to Claude (plain web request, no new package) |
| `lib/answer.ts` | The engine: search, build, ask, check, log |
| `scripts/ask.ts` | The `npm run ask` command |
| `lib/rag.test.ts`, `lib/anthropic.test.ts` | Automated tests |
| `docs/answer-format.md` | My answer format: shape, citation, and refusal line |
| `docs/rag-spec.md` | The behavior spec |

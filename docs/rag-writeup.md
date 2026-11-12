# Day 1: a cited answer engine over the sample corpus

Ask a question and the engine answers from the sample documents, cites the document and section, and says "I don't know" when the documents don't cover it.

```
npm run ask -- "How long do I have to return something for a refund?"
```

![Terminal showing the cited answer, the refusal, and the meaning-based answer](rag-answer-proof.png)

## How it works
Question → embed → find the top 3 passages in the vector store → label each passage with its document and section → ask Claude (`claude-sonnet-5-5`) to answer from only those passages → check the reply → print the answer and the source.

The search half is the Week 8 pgvector search over 232 chunks. The new half is `lib/rag.ts` (the rules), `lib/anthropic.ts` (the Claude call), `lib/answer.ts` (the engine), and `scripts/ask.ts` (the command).

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
**Question:** How long do I have to return something for a refund?

**Answer:** You have **30 days** from the date you receive your item to return it for a refund to your original payment method. After that, an exchange or store credit is still available until day 45.

**Source:** `returns-shipping-policy.txt · SECTION 2 — EXCHANGES & STORE CREDIT` + `store-operations-manual.md · 4. Processing a Customer Return`

**Verified:** In `sample-corpus/returns-shipping-policy.txt`, SECTION 2 (line 56) says "Refund window: 30 days. A return for a refund to your original payment method must happen within 30 days of receiving your item." and "Exchange and store-credit window: 45 days." Section 4 of the operations manual repeats both windows. The engine's citation check also passed.

## 4. A question that succeeded on meaning
**Question:** Is it okay to go on a long trek right away in brand-new footwear?

**Answer:** No, it's best not to. Wear new boots around the house and on short walks for about the first week using your hiking socks, then build up to longer walks and a loaded day hike **before** committing them to a multi-day trip. Break-in needs vary by boot: the Creekside Trail Shoe needs almost none, the Granite Peak Hiker a little, and the Summit Pro the most.

**Source:** `product-faq.md · Boots`

**Why this is a meaning win:** the words in my question that the Boots passage never uses are **trek**, **footwear**, **okay**, and **right away**. The passage says "boots", "multi-day trip", "hike", and "first week". The only word they share is "new". Search ranked this passage first, at a score of 0.628 (see [semantic-search-tests.md](semantic-search-tests.md)).

## 5. An honest "I don't know"
**Question:** Do you price match competitors?

**Printed exactly:**
```
ANSWER:  I don't know — the documents I have don't cover that.
SOURCE:  none
```

**Why it refused:** none of the five documents has a price-matching policy. The best passages scored only 0.34 in search.

## What I noticed along the way
- **The wording changes between runs.** The same question can open "No. Break boots in first…" one time and "No, it's best not to." the next. Both were grounded and cited correctly. I don't control the randomness (see the temperature point above), which matters for scoring.
- **The bold sometimes lands on a word.** The meaning-based answer bolds "before" instead of a figure, which the format says to bold. The answers are still correct.
- **"No." is the model's reading.** The Boots passage says to start slow and build up. It never says "no", so the opening word is an inference from the advice.
- **The refusal depends on the model.** Retrieval always returns the 3 closest passages, even for an off-topic question, and has no minimum score. The refusal for the price-match question worked, but an earlier search test ("do you sell kayaks?") shows search alone would have returned an unrelated passage.
- **Cost and speed.** Each answer sent about 870 to 1,440 input units and received 18 to 120 output units. That is about four-tenths of a cent at most, and 2 to 4 seconds per question.

## Safety
- The Claude key is read from `.env.local`, which is gitignored. It is sent only in the `Authorization` header and never printed or logged.
- Errors show only the HTTP status number. Nothing from the question or the reply goes into an error.
- Each question writes one `rag_answer` log line with its length, passage count, top score, outcome, citation check, model, usage, and milliseconds. The question and answer text are never logged.

## Tests
`npm test` runs 57 tests, including 15 for this engine: the label format, the prompt's grounding and refusal wording, splitting citations (including a section named "Chalk Bag + Chalk"), the exact refusal line, rejecting invented citations, and reading Claude's reply.

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

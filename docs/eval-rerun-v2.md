# MyChair RAG engine: baseline report v2

Golden set: 10 questions, frozen. Engine: the Day 1 build over the MyChair corpus (118 chunks), model `claude-sonnet-5-5`. Run: 2026-11-13T17:19:43.240Z.

## A. The two measures, scored separately

| Measure | Score | Gate | Result |
|---|---|---|---|
| Retrieval (the right section was among the top 3 passages) | 7/7 | at least 6/7 | **PASS** |
| Answer (right answer with a matching citation, or an exact refusal) | 10/10 | at least 8/10 | **PASS** |
| Refusals (every must-refuse question refused) | 3/3 | all of them | **PASS** |

### Every item

| # | Kind | Question | Retrieval | Answer | Top score |
|---|---|---|---|---|---|
| 1 | answerable | How late can a client cancel an appointment on their own? | hit | pass | 0.619 |
| 2 | answerable | How long does a client invite link last, and how many times can it be used? | hit | pass | 0.782 |
| 3 | answerable | Can a pro see a client's email address? | hit | pass | 0.610 |
| 4 | answerable | What kind of photos can go on a style card, and how big can they be? | hit | pass | 0.771 |
| 5 | answerable | How many days ahead can a client book? | hit | pass | 0.710 |
| 6 | answerable | Can MyChair refund me if I'm unhappy with a haircut? | hit | pass | 0.626 |
| 7 | answerable | Who is allowed to change a pro's role? | hit | pass | 0.676 |
| 8 | refuse | Do you sell hair gel? | n/a | pass | 0.301 |
| 9 | refuse | Can I export my client list to a spreadsheet? | n/a | pass | 0.424 |
| 10 | refuse | Do you have a loyalty rewards program? | n/a | pass | 0.251 |

### Misses on record

No misses: every item passed both measures.

## B. The gate, written before the run

The thresholds above are in `eval/gate.json` and the questions are in `eval/golden-set.json`. Both were committed before this run:

- gate.json last committed: `cb085c6 2026-11-12T21:24:04-05:00`
- golden-set.json last committed: `cb085c6 2026-11-12T21:24:04-05:00`
- golden-set.json fingerprint (SHA-256): `c53e903548f8a371fe9376eab583de39402e56b41b05c4b05cdafec1cb20b1ff`

The run script refuses to start if either file has uncommitted changes. The verdict is a decision made in advance; the run only shows which side of it the system is on.

**Gate verdict: SHIP, all three conditions clear.**

## How the scores are decided

- **Retrieval** is a hit when the expected `document · section` is among the 3 passages the search returned. Refusal questions have no expected source, so they are not counted here.
- **Answer** is a pass when the engine's reply contains every required fact from the golden item, cites the expected `document · section`, and every citation matches a retrieved passage. A right fact with no matching citation fails. A must-refuse question passes only when the reply is the exact refusal line.
- Facts are checked as plain words in the reply (see `requiredPhrases` in the golden set), not by another AI, so the same reply always gets the same score.

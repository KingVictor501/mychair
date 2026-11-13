# Semantic search tests

Search works by meaning: **query -> embed -> compare -> ranked passages, closest first.**
Each query is turned into 1,536 numbers by OpenAI `text-embedding-3-small`, then compared to the 115 stored passage embeddings by cosine similarity (score = 1 minus distance; closer to 1 means closer in meaning).
Corpus: the MyChair help documents (14 files in `mychair-corpus/`, 115 passages).
Run on 2026-11-12 against the development database, top result only. The query text is not stored in the production logs; only its length, the result count, the top score and the time are.

| # | Query | Top result (first 100 characters) | Source > heading | Score | Pass/Fail | Why | Non-overlapping words |
|---|---|---|---|---|---|---|---|
| 1 | How late can I cancel? | By default you can cancel or reschedule on your own up to 2 hours before the appointment starts. Ins | cancellation-and-no-show-policy.md > The cancellation window | 0.519 | Pass | The passage states the cancellation window: 2 hours before the start. The second and third results (the deposit rule and the policy's introduction) were related but less direct. | Not a meaning test: the query shares "cancel" with the passage. |
| 2 | Do you sell hair gel? | Add the services you offer, with a name, description, and length. You can list services outside your | pro-guide.md > List your services | 0.301 | **Fail** | MyChair has no product sales, so the right result is "no match". Search still returned its closest passage, a talk about services, with no sign that it is a weak match. | Not applicable (a fail). |
| 3 | My barber got stuck in traffic and I got blamed for skipping, how do I get that erased? | If you were marked a no-show by mistake, for example the pro was running late, the pro who was reser | cancellation-and-no-show-policy.md > If something went wrong | 0.416 | **Pass (meaning-only win)** | The right passage came back at the top: it explains that a no-show given by mistake, such as a pro running late, can be removed by the pro. The query never uses "no-show", "strike", "pro", "late", or "remove". | barber, stuck, traffic, blamed, skipping, erased (the only words they share are small ones like "for", "that", and "and") |

## Notes

- **Extra run (not one of the three):** "Can I use one login for my nail place and my hair place?" found `switching-between-shops.md` at 0.581, the highest score of the session. The passage says "one MyChair account can book at many shops", and the query shares almost no words with it ("nail", "hair", and "one" appear). It is a second good meaning-based result.
- **Weakness found (test 2):** there is no minimum score. A possible fix is to show "no good match" below a cutoff. Scores seen so far: 0.519, 0.416, and 0.581 for good answers, and 0.301 for the bad one. Test 3's win scored lower than test 1's keyword match, so a cutoff set too high (say 0.45) would wrongly reject a good answer. Four queries are too few to pick a safe number, so it is not built yet.
- **The answer engine covers for it here:** when the same hair-gel question goes through `npm run ask`, Claude correctly replied "I don't know — the documents I have don't cover that." The refusal depended on the model, not on search.

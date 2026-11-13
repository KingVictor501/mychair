# RAG answer engine: behavior spec

## The spec I hand my AI

Extend my Week 8 search into a question-answering engine for the MyChair documents in `mychair-corpus/`.

**Input and output**
- Take a question from the command line (`npm run ask -- "your question"`).
- Print the answer, then the source line, in the format I chose in `docs/answer-format.md`.

**Retrieval**
- Embed the question and retrieve the top 3 passages from my existing vector store (`corpus_chunks`).
- Put the 3 passages into a context block. Label each one with its document name and section, like `[cancellation-and-no-show-policy.md · The cancellation window]` followed by the text.

**Answering**
- Ask Claude (`claude-sonnet-5-5`) through the Claude API. The key comes from `ANTHROPIC_API_KEY` in `.env.local`. It is never printed or logged.
- The prompt must:
  - forbid any outside knowledge: use only the labeled passages;
  - require the answer to follow my answer format (1 to 3 sentences, the key figure in bold, no preamble);
  - require a citation line naming the document and section of each passage used, in my format;
  - require the exact refusal line `I don't know — the documents I have don't cover that.` whenever the passages do not contain the answer, with nothing added and no citation line.

**Safety and logging**
- Log one `rag_answer` line per question with IDs and numbers only: question length, passages retrieved, top score, whether it refused, whether every citation matched a retrieved passage, and milliseconds. Never log the question text or the answer text, and never log any key.
- If the Claude call fails, print a short friendly error and log the status code only.

## The review checklist (the three load-bearing points)
1. **Source labels reach the model:** each passage in the context block carries its document and section.
2. **Grounding rule is in the prompt:** it says to use only the excerpts provided.
3. **Refusal path exists:** the prompt says what to do when the excerpts do not contain the answer.

## Decisions
- Answer model: Claude Sonnet 5.5, called with a plain HTTP request (no new package). The model name can be changed with the `ANSWER_MODEL` environment variable without editing code.
- Output layout follows the "what done looks like" image (labeled ANSWER and SOURCE lines), with the content following `docs/answer-format.md`.
- Off-corpus questions print the exact refusal line, and the SOURCE line says `none`.

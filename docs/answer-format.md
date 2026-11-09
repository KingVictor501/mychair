# Answer format for the sample answer engine

## Decision 1: Answer shape

- 1 to 3 sentences. Three is a hard maximum.
- The first sentence leads with the specific figure or rule. **Bold** the key figure.
- No preamble: never start with "According to the documents", "Based on", or "Great question".
- Say only what the retrieved passages support. If a detail is not in the passages, leave it out.
- Plain text, no bullet lists, no headings.

## Decision 2: Citation format

- On its own line, directly under the answer:
  `Source: {document} · {section}`
- `{document}` is the exact file name of the document, such as `returns-shipping-policy.txt`.
- `{section}` is the section name copied character for character from the database (`heading`), including any numbers, capital letters, dashes, or `>` signs it contains. Do not shorten or reword it.
- The separator between document and section is a space, a middle dot `·`, and a space.
- **Two or more sources:** put them all on the same line, in order of relevance, each written in full and joined by ` + `.
- If two sections come from the same document, repeat the document name for each.
- A section name may itself contain ` + ` (for example the product `Chalk Bag + Chalk` in `pricing.csv`). So a checker must split the line only where ` + ` is followed by a document name and ` · `, never on every ` + `.
- Cite only passages the answer actually used.

## Decision 3: Refusal line

Use this exact line, with a straight apostrophe, when the passages do not answer the question:

`I don't know — the documents I have don't cover that.`

- Verbatim every time. Nothing before it, nothing appended.
- No `Source:` line with a refusal.

## Examples

**One source**

> **30 days** for a refund to your original payment method, and **45 days** for an exchange or store credit.
> Source: returns-shipping-policy.txt · SECTION 1 — RETURNS

**Two sources** (the return-processing question needs the policy and the operations manual)

> Check the item against the policy's refund and exchange windows (**30 and 45 days**), then follow the register steps for the return.
> Source: returns-shipping-policy.txt · SECTION 1 — RETURNS + store-operations-manual.md · 4. Processing a Customer Return

**Two sections from one document**

> Choose boots that are **snug but not tight**, with room to wiggle your toes, and break them in gradually over the first week.
> Source: product-faq.md · Sizing & Fit + product-faq.md · Boots

**Refusal** (for example, "Do you sell kayaks?")

> I don't know — the documents I have don't cover that.

## Why these choices

- A script can check a citation: the file must exist and the section must match a stored `heading` exactly.
- One fixed refusal line means refusals can be found in a log by eye or by script.
- The 3-sentence cap stops a long answer from adding unsupported details.

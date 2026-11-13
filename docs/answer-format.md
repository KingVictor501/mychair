# Answer format for the MyChair answer engine

## Decision 1: Answer shape

- 1 to 3 sentences. Three is a hard maximum.
- The first sentence leads with the specific figure or rule. **Bold** the key figure.
- No preamble: never start with "According to the documents", "Based on", or "Great question".
- Say only what the retrieved passages support. If a detail is not in the passages, leave it out.
- Plain text, no bullet lists, no headings.

## Decision 2: Citation format

- On its own line, directly under the answer:
  `Source: {document} · {section}`
- `{document}` is the exact file name of the document, such as `booking-policy.md`.
- `{section}` is the section name copied character for character from the database (`heading`), including any numbers, capital letters, dashes, or `>` signs it contains. Do not shorten or reword it.
- The separator between document and section is a space, a middle dot `·`, and a space.
- **Two or more sources:** put them all on the same line, in order of relevance, each written in full and joined by ` + `.
- If two sections come from the same document, repeat the document name for each.
- A section name may itself contain ` + ` (for example a service section named `Cut + Beard Trim` in a price list). So a checker must split the line only where ` + ` is followed by a document name and ` · `, never on every ` + `.
- Cite only passages the answer actually used.

## Decision 3: Refusal line

Use this exact line, with a straight apostrophe, when the passages do not answer the question:

`I don't know — the documents I have don't cover that.`

- Verbatim every time. Nothing before it, nothing appended.
- No `Source:` line with a refusal.

## Examples

**One source**

> You can cancel or reschedule on your own up to **2 hours** before the appointment starts.
> Source: cancellation-and-no-show-policy.md · The cancellation window

**Two sources** (the booking-window question needs the booking policy and the pro guide)

> Clients can book up to **5 days** ahead by default, and a pro can extend their own window to allow more notice.
> Source: booking-policy.md · How far ahead you can book + pro-guide.md · Your booking window

**Two sections from one document**

> A no-show adds **one strike** at that shop only, and the pro who was reserved can remove it if they were running late.
> Source: cancellation-and-no-show-policy.md · No-show strikes + cancellation-and-no-show-policy.md · If something went wrong

**Refusal** (for example, "Do you sell hair gel?")

> I don't know — the documents I have don't cover that.

## Why these choices

- A script can check a citation: the file must exist and the section must match a stored `heading` exactly.
- One fixed refusal line means refusals can be found in a log by eye or by script.
- The 3-sentence cap stops a long answer from adding unsupported details.

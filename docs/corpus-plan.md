# MyChair Corpus Plan

The MyChair corpus is the set of documents the app's help assistant answers from. It lives in `mychair-corpus/`. The older `sample-corpus/` folder is the Week 8 practice corpus and stays as it is.

## Rules the corpus follows

- 14 documents now, one subject each, in Markdown. A 15th (a sample shop directory with fake shops, pros, and prices) is added last, as dummy content.
- Every file name says its subject, because the file name shows up in citations (`booking-policy.md · How far ahead you can book`).
- Every section has a heading and stays under about 1,200 characters, so each section becomes one clean chunk.
- Rules in the documents match `docs/permissions.md` and `docs/data-model.md`. Where the design had no number yet, the document uses a default listed in the assumptions below.
- The documents describe the platform in general. Fake shops, pros, and owners come last.

## The documents

| File | Subject | Footer link |
|---|---|---|
| `booking-policy.md` | Who can book, booking window, appointment length, no double booking | Yes |
| `cancellation-and-no-show-policy.md` | Cancelling, the cancellation window, no-show strikes | Yes |
| `refund-and-payment-policy.md` | No real payments, payment status, deposits, refunds | Yes |
| `privacy-policy.md` | What is collected, who sees it, logs, outside services | Yes |
| `terms-of-service.md` | Account rules and responsibilities | Yes |
| `contact-and-support.md` | Who to contact for what | Yes |
| `client-getting-started.md` | Sign up, find a pro, search, book | No |
| `switching-between-shops.md` | One account, many shops, the shop switcher | No |
| `client-invite-links.md` | Pro-made client links: 24 hours, single use | No |
| `pro-guide.md` | Hours, status, services, clients, appointments | No |
| `owner-guide.md` | Setup, team, roles, prices, pay structure | No |
| `style-cards-and-client-data.md` | What a style card holds and who sees it | No |
| `standard-vs-custom-pricing.md` | Shop price list vs a pro's custom prices | No |
| `account-and-security-faq.md` | Passwords, rate limits, account safety | No |

The six footer documents are the ones a visitor expects to find at the bottom of every page: the policies and contact details. The other eight are help articles, reached from the help page and the assistant, not the footer.

## Decisions

Values the earlier design left open, as decided:

1. **Cancellation window:** 2 hours before the start (confirmed).
2. **No-show strikes never block booking.** A pro sees the strike count for their own clients, and the pro reserved for an appointment can remove the strike (for example, if the pro ran late). The owner and Super Admin see everything. (Added to `docs/permissions.md`.)
3. **No-show strikes are per shop**, not across all shops.
4. **Password reset by email** is not available yet; the FAQ says to contact support. It is planned for later.
5. **Support contact** is `admin@mychair.com` for everything. No phone number is listed.

## Multi-shop clients (design change)

A client can now have one account and many shops, with a shop switcher. The documents already describe this. The design documents do not yet. These need updating when the app is built:

- `docs/decision-document.md`: scope and "Finding a shop" currently say one shop only.
- `docs/data-model.md`: a client's account must link to many per-shop client records (each with its own no-show count and style cards).
- `docs/permissions.md`: a client's booking and viewing rules apply per shop.
- `docs/api-design.md`: a way to list the client's shops and switch between them.

## Still to do

- Point the count and embed commands at `mychair-corpus/` (they read `sample-corpus/` today).
- Add the dummy content last: the sample shop directory file.
- Build the footer with the six links.

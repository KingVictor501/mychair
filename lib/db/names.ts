// lib/db/names.ts
// WHAT IT'S FOR: staffNameSql, the database version of staffName (lib/format.ts): a pro's or
// owner's first name plus last initial ("Ray K."), worked out inside the query, so every list
// that loads a pro's name (booking, the owner's day, the team, style cards, the demo page) gets
// the same label without each page building it. Clients are never passed through this.
// WHO USES IT: lib/booking/data.ts, lib/owner/data.ts, lib/pro/data.ts, lib/demo/entry.ts,
// lib/admin/data.ts. The same rule in plain TypeScript (staffName) is tested in lib/demo/demo.test.ts.
// WHY THE NAME: names from the database; ".ts" = no screen code.

import { sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

// "name" and "lastName" are the users table's columns (or an alias of it, like the pro in a
// query that also joins the client). nullif/trim treat a blank last name like no last name.
export function staffNameSql(t: { name: AnyPgColumn; lastName: AnyPgColumn }): SQL<string> {
  return sql<string>`case when nullif(trim(${t.lastName}), '') is null then ${t.name} else ${t.name} || ' ' || upper(left(trim(${t.lastName}), 1)) || '.' end`;
}

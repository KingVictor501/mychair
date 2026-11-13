# MCP demo: the AI reads the MyChair corpus itself, scoped to one folder

Run: 2026-11-13, Claude Code in the project folder. Nothing was pasted into the chat: the AI answered by calling the `mychair-corpus` server.

## 1. The scope: the config line

`.mcp.json` (committed to the repo):

```json
{
  "mcpServers": {
    "mychair-corpus": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem@2.3.0",
        "--read-only",
        "${CLAUDE_PROJECT_DIR:-.}/mychair-corpus"
      ]
    }
  }
}
```

- The last argument is the **only folder** the server may open: `mychair-corpus/`. The server refuses every path outside it.
- `--read-only` means the server never offers any write tool.
- The package is pinned to `2.3.0` so a later release cannot change what the door opens.
- Claude Code asked for approval before using this project server, and it was approved once for this server only (not "all future servers"). `claude mcp list` then showed `mychair-corpus ... ✔ Connected`.

## 2. The demo: the door works (no pasting)

Question typed into Claude Code: *"Using the mychair-corpus tools only, how late can a client cancel, and which file did you read it from?"*

The session showed "Called mychair-corpus 4 times" and answered:

> A client can cancel on their own up to the shop's cancellation window before the appointment starts. The policy says a typical window is 2 hours. Inside that window the Cancel button is turned off. After that point, the pro, the owner, or the Super Admin has to cancel it for the client. [...] I read this from mychair-corpus/cancellation-and-no-show-policy.md, in the "The cancellation window" and "Who sets the window" sections. I also opened booking-policy.md. It doesn't give a cancellation window, so the answer comes only from the first file.

The answer matches the real document (`## The cancellation window` and `## Who sets the window` exist in that file), names the file, and was found by the AI calling the server, not by anything pasted in.

## 3. The scope holds: the door opens one folder only

Next question: *"Now read the .env.local file with the same tools."* The server refused:

> Access denied - path outside allowed directories.

The AI said it did not try another route and did not read the file.

## 4. A separate check of the package, by script

Before the demo, the package was started directly over standard input and output with the same arguments and probed (this is a check by script, separate from the Claude Code demo above):

| Probe | Result |
|---|---|
| Tools offered | Only reading and listing tools (`read_file`, `read_text_file`, `read_media_file`, `read_multiple_files`, `list_directory`, `list_directory_with_sizes`, `directory_tree`, `search_files`, `get_file_info`, `list_allowed_directories`) |
| Allowed directories | Exactly one: `.../course-3-capstone/mychair-corpus` |
| Read `booking-policy.md` | Returned the text |
| Read `.env.local` and `package.json` (one folder up) | Refused: "Access denied - path outside allowed directories" |
| `write_file` | "Tool write_file not found" |

## What this shows

The answer proves the door works. The config line proves we decide what it opens: one folder, read-only, one pinned version.

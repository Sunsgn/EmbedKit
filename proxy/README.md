# EmbedKit local proxy

This local agent connects the browser UI to local tools, system file pickers, serial ports, AI servers, and raw TCP/UDP devices.
It listens on `127.0.0.1:9999`; HTTP proxy targets remain restricted to known loopback AI ports.

Network debugging endpoints create bounded TCP client or UDP sessions, retain at most 2,000 events per session, and allow at most 16 sessions. They are only callable from configured browser origins.

```powershell
npm start
```

Optional comma-separated settings:

- `EMBEDKIT_ALLOWED_ORIGINS`: browser origins allowed to call the proxy
- `EMBEDKIT_ALLOWED_TARGETS`: complete target origins such as `http://127.0.0.1:9000`
- `EMBEDKIT_PROXY_HOST`: listening address; keep `127.0.0.1` unless LAN access is intentional
- `EMBEDKIT_PROXY_PORT`: listening port
- `EMBEDKIT_MAX_REQUEST_BYTES`: maximum proxied request size
- `EMBEDKIT_MAX_SELECTED_FILE_BYTES`: maximum size of a file authorized for chunked reading (default 512 MiB)

For a custom local server, add its origin explicitly instead of enabling arbitrary URL forwarding.

Build output diagnostics are normalized for GCC/Clang `file:line:column`, Keil/Arm Compiler and MSVC `file(line,column)`, and IAR quoted-file formats. Only lines with explicit file and line evidence become source-navigation diagnostics; linker summaries and ordinary log lines remain plain output.

## Controlled local path selection

`POST /api/files/select` accepts only `{ "kind": "file" }` or `{ "kind": "directory" }`. It opens the operating-system picker and returns the path explicitly selected by the user. A caller cannot submit a path for the Agent to approve, and the Agent validates that the selected result exists and matches the requested type.

Windows uses the native PowerShell/Windows Forms dialog, macOS uses `osascript`, and Linux uses `zenity`. Cancelling returns `{ "cancelled": true }` without changing the current UI configuration. This endpoint selects a path only; it does not read, upload, modify, or delete the selected content.

File selections also receive a random, short-lived `selectionId`. `GET /api/files/selections/:id` returns metadata without exposing a new path, `GET /api/files/selections/:id/chunk?offset=0&length=262144` reads at most 256 KiB as base64, and `DELETE /api/files/selections/:id` revokes access. Tokens expire after 15 minutes, are held only in memory, and become invalid if the selected file changes size. No endpoint accepts an arbitrary path for file reading.

`POST /api/build/jobs/:jobId/artifacts/:index/select` authorizes one artifact already discovered by that build job. The Agent rejects unknown indexes, artifacts outside the resolved build directory, missing files, and files whose size or modification time changed after discovery. A successful request returns the same short-lived file token used by the independent analysis tools; it never accepts a browser-supplied path.

`GET /api/elf/analyze/:selectionId` analyzes an authorized ELF/AXF/OUT without invoking a compiler or loading the entire file. The built-in bounded parser supports ELF32/ELF64 and both byte orders, and returns architecture, entry address, program segments, sections, parsed symbol metadata, a bounded symbol preview, DWARF section evidence, and explicit degradation warnings. Full symbol data stays in a bounded 15-minute in-memory analysis cache instead of being sent to the browser.

`GET /api/elf/analyses/:analysisId/lookup?address=0x...` resolves a PC/LR or other address to an exact symbol, containing symbol, same-section nearest symbol, or section-only evidence. Arm Thumb bit normalization is reported explicitly. Bounded DWARF v2-v5 `.debug_line` programs can add a real source file, line, and column. DWARF v5 inline, `.debug_line_str`, and `.debug_str` paths are supported for common forms. GNU `.zdebug_*` and ELF `SHF_COMPRESSED` zlib sections are decoded with compressed and decompressed size limits. Unknown forms, missing companion strings, malformed units, and unsupported compression degrade explicitly and never manufacture source locations.

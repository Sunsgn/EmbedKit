# EmbedKit local proxy

This local agent connects the browser UI to local tools, system file pickers, serial ports, AI servers, and raw TCP/UDP devices.
It listens on `127.0.0.1:9999`; HTTP proxy targets remain restricted to known loopback AI ports.

Ordinary users should download the self-contained package from GitHub Releases and run `start-agent.cmd` on Windows or `./start-agent.sh` on Linux/macOS. The package includes its Node runtime and platform-native serial dependency. See [Local Agent installation](../docs/LOCAL_AGENT_INSTALLATION.md) for checksum, fallback, and release details.

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

## Official part-document discovery

`GET /api/parts/documents?part=...&manufacturer=...&productUrl=...` reads only registered manufacturer HTTPS domains. It follows at most two same-manufacturer redirects, visits at most three bounded HTML pages, reads at most 2 MiB per page, and returns at most 24 official PDF links with document type, exact-model or family scope, discovery page, failures, and discovery time. Results are cached in memory for ten minutes.

The optional `productUrl` is accepted only when its host belongs to the resolved manufacturer adapter. Unknown manufacturers, blocked pages, dynamic sites, timeouts, and pages without identifiable PDF anchors return an explicit empty or partial result; the Agent does not substitute aggregator links or label search results as verified PDFs. It returns links rather than downloading or permanently storing copyrighted documents.

`GET /api/parts/document-content?url=...` reads one discovered official PDF for the in-app document workspace. The URL must use HTTPS and match a registered manufacturer domain. The Agent follows at most two redirects that remain within that manufacturer's registered domains, applies a 20-second request timeout and a 50 MiB response limit, and verifies the `%PDF-` file signature before returning bytes. It exposes the final source URL in `X-EmbedKit-Source-Url`; blocked hosts, cross-manufacturer redirects, oversized responses, timeouts, and non-PDF content return structured errors. Content is streamed to the requesting browser session and is not persisted by the Agent.

The test suite also builds a minimal public C source with an installed GNU toolchain, generates real MAP/ELF/BIN/Intel HEX artifacts in a temporary directory, analyzes them, and removes them. It never downloads a compiler or commits generated firmware. See `docs/TOOLCHAIN_ARTIFACT_FIXTURES.md` for platform and proprietary-toolchain boundaries.

## Controlled local path selection

`POST /api/files/select` accepts only `{ "kind": "file" }` or `{ "kind": "directory" }`. It opens the operating-system picker and returns the path explicitly selected by the user. A caller cannot submit a path for the Agent to approve, and the Agent validates that the selected result exists and matches the requested type.

Windows uses the native PowerShell/Windows Forms dialog, macOS uses `osascript`, and Linux uses `zenity`. Cancelling returns `{ "cancelled": true }` without changing the current UI configuration. This endpoint selects a path only; it does not read, upload, modify, or delete the selected content.

File selections also receive a random, short-lived `selectionId`. `GET /api/files/selections/:id` returns metadata without exposing a new path, `GET /api/files/selections/:id/chunk?offset=0&length=262144` reads at most 256 KiB as base64, and `DELETE /api/files/selections/:id` revokes access. Tokens expire after 15 minutes, are held only in memory, and become invalid if the selected file changes size. No endpoint accepts an arbitrary path for file reading.

`POST /api/projects/scan` accepts only a currently authorized directory `selectionId`. It scans at most 5,000 files, 12 directory levels and 10 seconds; skips version-control data, dependency trees, common build caches and symbolic links; and returns only bounded relative-path inventory, deterministic IDE/build-system/framework evidence, unknown items, warnings and BIN/HEX/ELF/MAP/SREC metadata. It does not return source contents or an absolute root path. Unrecognized source trees safely degrade to a generic source project instead of being guessed as a known platform.

`POST /api/build/jobs/:jobId/artifacts/:index/select` authorizes one artifact already discovered by that build job. The Agent rejects unknown indexes, artifacts outside the resolved build directory, missing files, and files whose size or modification time changed after discovery. A successful request returns the same short-lived file token used by the independent analysis tools; it never accepts a browser-supplied path.

`POST /api/build/jobs/:jobId/artifacts/:index/hash` computes SHA-256 inside the Agent with 256 KiB streaming reads. It uses the same directory and metadata checks before reading, checks the file again afterward, applies the selected-file size limit, and allows at most two concurrent hash jobs. File content is not returned to the browser.

`GET /api/elf/analyze/:selectionId` analyzes an authorized ELF/AXF/OUT without invoking a compiler or loading the entire file. The built-in bounded parser supports ELF32/ELF64 and both byte orders, and returns architecture, entry address, program segments, sections, parsed symbol metadata, a bounded symbol preview, DWARF section evidence, and explicit degradation warnings. Full symbol data stays in a bounded 15-minute in-memory analysis cache instead of being sent to the browser.

`GET /api/elf/analyses/:analysisId/lookup?address=0x...` resolves a PC/LR or other address to an exact symbol, containing symbol, same-section nearest symbol, or section-only evidence. Arm Thumb bit normalization is reported explicitly. Bounded DWARF v2-v5 `.debug_line` programs can add a real source file, line, and column. DWARF v5 inline, `.debug_line_str`, and `.debug_str` paths are supported for common forms. GNU `.zdebug_*` and ELF `SHF_COMPRESSED` zlib sections are decoded with compressed and decompressed size limits. Unknown forms, missing companion strings, malformed units, and unsupported compression degrade explicitly and never manufacture source locations.

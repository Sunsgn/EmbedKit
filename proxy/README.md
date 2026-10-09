# EmbedKit local proxy

This local agent connects the browser UI to AI servers and raw TCP/UDP devices.
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

For a custom local server, add its origin explicitly instead of enabling arbitrary URL forwarding.

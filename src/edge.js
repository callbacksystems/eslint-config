// Cloudflare Workers. `globals.serviceworker` already carries the runtime's web-standard surface (fetch,
// Request/Response, caches, crypto, scheduler); what it does not know are the three globals workerd adds on top.
//
// Bindings are not here on purpose: a KV or D1 binding is named by the project, and in module syntax it arrives as
// `fetch(request, env, ctx)` rather than as a global at all. A Service Worker syntax project declares its own binding
// names under `languageOptions.globals`.

import globals from "globals"

const WORKERS_GLOBALS = { Cloudflare: "readonly", HTMLRewriter: "readonly", WebSocketPair: "readonly" }

export default [
  { ignores: [ ".wrangler/**" ] },
  { files: [ "**/*.{cjs,js,jsx,mjs}" ], languageOptions: { globals: { ...globals.serviceworker, ...WORKERS_GLOBALS } } }
]

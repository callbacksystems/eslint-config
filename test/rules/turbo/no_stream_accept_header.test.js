import rule from "#rules/turbo/no_stream_accept_header"
import { tester } from "#support"

tester.run("turbo/no-stream-accept-header", rule, {
  valid: [
    'fetch("/messages", { headers: { Accept: "text/html" } })',
    'const headers = { Accept: "application/json" }',
    'const headers = { "Content-Type": "application/json" }',
    'const type = "text/vnd.turbo-stream.html"',
    'const statuses = { 200: "text/vnd.turbo-stream.html" }',
    'const headers = { [headerName]: "text/vnd.turbo-stream.html" }',
    'const headers = { [Accept]: "text/vnd.turbo-stream.html" }'
  ],
  invalid: [
    {
      code: 'fetch("/messages", { headers: { Accept: "text/vnd.turbo-stream.html" } })',
      errors: [ { messageId: "noStreamAcceptHeader" } ]
    },
    {
      code: 'const headers = { Accept: "text/vnd.turbo-stream.html, text/html" }',
      errors: [ { messageId: "noStreamAcceptHeader" } ]
    },
    {
      code: 'const headers = { accept: "text/vnd.turbo-stream.html" }',
      errors: [ { messageId: "noStreamAcceptHeader" } ]
    },
    {
      code: 'const headers = { "Accept": "text/vnd.turbo-stream.html" }',
      errors: [ { messageId: "noStreamAcceptHeader" } ]
    },
    {
      code: 'const headers = { ACCEPT: "text/vnd.turbo-stream.html" }',
      errors: [ { messageId: "noStreamAcceptHeader" } ]
    },
    {
      code: "const headers = { Accept: `text/vnd.turbo-stream.html` }",
      errors: [ { messageId: "noStreamAcceptHeader" } ]
    },
    {
      code: "const headers = { [`Accept`]: `text/vnd.turbo-stream.html` }",
      errors: [ { messageId: "noStreamAcceptHeader" } ]
    }
  ]
})

import rule from "#rules/turbo/no-stream-accept-header"
import { tester } from "#test/support"

tester.run("turbo/no-stream-accept-header", rule, {
  valid: [
    'fetch("/messages", { headers: { Accept: "text/html" } })',
    'const headers = { Accept: "application/json" }',
    'const headers = { "Content-Type": "application/json" }',
    // The MIME outside an Accept header is not this rule's concern.
    'const type = "text/vnd.turbo-stream.html"'
  ],
  invalid: [
    {
      code: 'fetch("/messages", { headers: { Accept: "text/vnd.turbo-stream.html" } })',
      errors: [ { messageId: "noStreamAcceptHeader" } ]
    },
    {
      // A MIME list that includes the stream type still counts.
      code: 'const headers = { Accept: "text/vnd.turbo-stream.html, text/html" }',
      errors: [ { messageId: "noStreamAcceptHeader" } ]
    },
    {
      // Header names are case-insensitive.
      code: 'const headers = { accept: "text/vnd.turbo-stream.html" }',
      errors: [ { messageId: "noStreamAcceptHeader" } ]
    },
    {
      code: 'const headers = { "Accept": "text/vnd.turbo-stream.html" }',
      errors: [ { messageId: "noStreamAcceptHeader" } ]
    },
    {
      code: "const headers = { Accept: `text/vnd.turbo-stream.html` }",
      errors: [ { messageId: "noStreamAcceptHeader" } ]
    }
  ]
})

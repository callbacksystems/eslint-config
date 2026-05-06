import rule from "#rules/rails/no-csrf-token-access"
import { dedent, tester } from "#support"

tester.run("rails/no-csrf-token-access", rule, {
  valid: [
    dedent`document.querySelector(".menu")`,
    dedent`const headers = { "Content-Type": "application/json" }`,
    dedent`fetch("/posts", { method: "post" })`,
    dedent`const name = "csrf"`
  ],
  invalid: [
    { code: dedent`document.querySelector('meta[name="csrf-token"]')`, errors: [ { messageId: "metaTag" } ] },
    {
      code: dedent`document.head.querySelector("meta[name=csrf-token]").content`,
      errors: [ { messageId: "metaTag" } ]
    },
    {
      code: dedent`request.setRequestHeader("X-CSRF-Token", token)`,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`const headers = { "X-XSRF-Token": token }`,
      errors: [ { messageId: "header", data: { name: "X-XSRF-Token" } } ]
    }
  ]
})

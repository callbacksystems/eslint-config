import rule from "#rules/turbo/no-render-stream-message"
import { dedent, tester } from "#support"

tester.run("turbo/no-render-stream-message", rule, {
  valid: [
    dedent`Turbo.visit("/home")`,
    // A like-named method on another object is fine.
    "stream.renderStreamMessage(html)",
    "other.renderStreamMessage(html)"
  ],
  invalid: [
    { code: "Turbo.renderStreamMessage(html)", errors: [ { messageId: "noRenderStreamMessage" } ] },
    { code: "Turbo.renderStreamMessage(await response.text())", errors: [ { messageId: "noRenderStreamMessage" } ] }
  ]
})

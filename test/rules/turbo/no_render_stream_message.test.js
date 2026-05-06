import rule from "#rules/turbo/no_render_stream_message"
import { dedent, tester } from "#support"

tester.run("turbo/no-render-stream-message", rule, {
  valid: [ dedent`Turbo.visit("/home")`, "stream.renderStreamMessage(html)", "other.renderStreamMessage(html)" ],
  invalid: [
    { code: "Turbo.renderStreamMessage(html)", errors: [ { messageId: "noRenderStreamMessage" } ] },
    { code: "Turbo.renderStreamMessage(await response.text())", errors: [ { messageId: "noRenderStreamMessage" } ] }
  ]
})

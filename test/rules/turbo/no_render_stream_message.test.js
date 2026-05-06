import rule from "#rules/turbo/no_render_stream_message"
import { dedent, tester } from "#support"

tester.run("turbo/no-render-stream-message", rule, {
  valid: [
    dedent`Turbo.visit("/home")`,
    "stream.renderStreamMessage(html)",
    "other.renderStreamMessage(html)",
    "function render(Turbo) { Turbo.renderStreamMessage(html) }",
    "const Turbo = stream; Turbo.renderStreamMessage(html)",
    "Turbo = custom; Turbo.renderStreamMessage(html)",
    'import Turbo from "./turbo.js"; Turbo.renderStreamMessage(html)',
    'import { Turbo } from "./turbo.js"; Turbo.renderStreamMessage(html)',
    'import Turbo from "@hotwired/turbo"; Turbo.renderStreamMessage(html)',
    "class C { #renderStreamMessage() {} render() { Turbo.#renderStreamMessage(html) } }"
  ],
  invalid: [
    { code: "Turbo.renderStreamMessage(html)", errors: [ { messageId: "noRenderStreamMessage" } ] },
    { code: "Turbo.renderStreamMessage(await response.text())", errors: [ { messageId: "noRenderStreamMessage" } ] },
    { code: "Turbo[`renderStreamMessage`](html)", errors: [ { messageId: "noRenderStreamMessage" } ] },
    {
      code: 'import { Turbo } from "@hotwired/turbo-rails"; Turbo.renderStreamMessage(html)',
      errors: [ { messageId: "noRenderStreamMessage" } ]
    },
    {
      code: 'import * as Turbo from "@hotwired/turbo"; Turbo.renderStreamMessage(html)',
      errors: [ { messageId: "noRenderStreamMessage" } ]
    },
    {
      code: 'import { Turbo as Engine } from "@hotwired/turbo-rails"; Engine.renderStreamMessage(html)',
      errors: [ { messageId: "noRenderStreamMessage" } ]
    },
    {
      code: 'import * as Engine from "@hotwired/turbo"; Engine.renderStreamMessage(html)',
      errors: [ { messageId: "noRenderStreamMessage" } ]
    }
  ]
})

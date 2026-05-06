// `Turbo.renderStreamMessage` drives Turbo Streams from JavaScript. Keep the server as the source of truth: render
// streams from a native form submission, or fall back to `@rails/request.js` when a manual fetch is unavoidable.

import { propertyNameOf } from "#helpers/classes"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow Turbo.renderStreamMessage; let the server drive Turbo Streams" },
    schema: [],
    messages: {
      noRenderStreamMessage:
        "Avoid `Turbo.renderStreamMessage`; let the server drive Turbo Streams via a form or `@rails/request.js`."
    }
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (isTurboRenderStreamMessage(node)) context.report({ node, messageId: "noRenderStreamMessage" })
      }
    }
  }
}

function isTurboRenderStreamMessage(node) {
  return node.object.type === "Identifier"
    && node.object.name === "Turbo"
    && propertyNameOf(node) === "renderStreamMessage"
}

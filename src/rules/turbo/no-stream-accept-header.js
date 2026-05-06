// Requesting a Turbo Stream from JavaScript by setting the `Accept: text/vnd.turbo-stream.html` header hand-rolls what
// a native form submission gives for free. Keep the server as the source of truth: submit a form, or fall back to
// `@rails/request.js` when a manual fetch is unavoidable.

import { stringValuesOf } from "#helpers/ast"

const STREAM_MIME = "text/vnd.turbo-stream.html"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow requesting Turbo Streams from JS via the Accept header" },
    schema: [],
    messages: {
      noStreamAcceptHeader:
        "Avoid the `text/vnd.turbo-stream.html` Accept header; drive Turbo Streams from a form or `@rails/request.js`."
    }
  },
  create(context) {
    return {
      Property(node) {
        if (isAcceptHeader(node) && requestsStream(node.value)) {
          context.report({ node, messageId: "noStreamAcceptHeader" })
        }
      }
    }
  }
}

function isAcceptHeader(node) {
  return keyText(node.key)?.toLowerCase() === "accept"
}

function keyText(key) {
  const name = key.type === "Identifier" ? key.name : key.value
  return typeof name === "string" ? name : null
}

function requestsStream(value) {
  return stringValuesOf(value).some((text) => text.includes(STREAM_MIME))
}

// `Turbo.renderStreamMessage` drives Turbo Streams from JavaScript. Keep the server as the source of truth: render
// streams from a native form submission, or fall back to `@rails/request.js` when a manual fetch is unavoidable.

import { memberName } from "#helpers/syntax/classes"
import { BindingResolver } from "#helpers/scope/binding_resolver"

const TURBO_PACKAGES = new Set([ "@hotwired/turbo", "@hotwired/turbo-rails" ])

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
    const bindings = new BindingResolver(context.sourceCode)
    return {
      MemberExpression(node) {
        if (isTurboRenderStreamMessage(node, bindings)) context.report({ node, messageId: "noRenderStreamMessage" })
      }
    }
  }
}

function isTurboRenderStreamMessage(node, bindings) {
  return node.object.type === "Identifier"
    && new TurboReference(node.object, bindings).isKnown
    && memberName(node) === "renderStreamMessage"
}

class TurboReference {
  #identifier
  #bindings

  constructor(identifier, bindings) {
    this.#identifier = identifier
    this.#bindings = bindings
  }

  get isKnown() {
    return this.#isGlobal || this.#isImport
  }

  get #isGlobal() {
    return this.#identifier.name === "Turbo" && this.#bindings.isUnmodifiedGlobal(this.#identifier)
  }

  get #isImport() {
    const definition = this.#definition
    return definition?.type === "ImportBinding"
      && TURBO_PACKAGES.has(definition.parent.source.value)
      && new TurboImportSpecifier(definition.node).isTurboObject
  }

  get #definition() {
    const definitions = this.#bindings.variableFor(this.#identifier)?.defs ?? []
    return definitions.length === 1 ? definitions[0] : null
  }
}

class TurboImportSpecifier {
  #node

  constructor(node) {
    this.#node = node
  }

  get isTurboObject() {
    return this.#node.type === "ImportNamespaceSpecifier"
      || (this.#node.type === "ImportSpecifier" && this.#node.imported.name === "Turbo")
  }
}

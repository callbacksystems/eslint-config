// A folder can carry a rule about what belongs in it: models hold classes, constants hold constants, helpers hold
// functions. This takes the kinds a file may export and reports anything else it presents. It knows nothing about
// paths, since `restrictExports` from the `/restrictions` subpath is what applies it per glob.

import { exportedBindingsIn } from "#helpers/scope/exports"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Restrict which kinds of thing a file may export" },
    schema: {
      type: "array",
      minItems: 1,
      maxItems: 1,
      items: [ {
        type: "object",
        properties: {
          kinds: {
            type: "array",
            items: { enum: [ "class", "constant", "function", "reexport" ] },
            minItems: 1,
            uniqueItems: true
          }
        },
        required: [ "kinds" ],
        additionalProperties: false
      } ]
    },
    messages: { forbiddenExportKind: "This file may only export {{allowed}}. `{{name}}` is a {{kind}}." }
  },
  create(context) {
    const { kinds } = context.options[0]
    return {
      "Program:exit"() {
        exportedBindingsIn(context.sourceCode)
          .filter((binding) => !kinds.includes(binding.kind))
          .forEach((binding) => reportForbidden(context, binding, kinds))
      }
    }
  }
}

function reportForbidden(context, binding, kinds) {
  context.report({
    node: binding.node,
    messageId: "forbiddenExportKind",
    data: { allowed: quotedList(kinds), name: binding.name ?? "default", kind: binding.kind }
  })
}

function quotedList(kinds) {
  return kinds.map((kind) => `\`${kind}\``).join(" or ")
}

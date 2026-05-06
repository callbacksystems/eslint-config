// Tests read as a flat list of full sentences, the way Minitest writes them. Nesting with `describe` and `it` splits a
// case's name across blocks, so reading one means assembling it from its ancestors, and the same `it` text repeats
// under different parents. One `test()` per case, named in full. The check is by name, not by import, so it reaches
// `describe`/`it` from any framework, including `test.describe` and `describe.only`. `context` is left out on purpose:
// it is a common identifier outside test files.

const BLOCK_NAMES = new Set([ "describe", "it", "suite", "specify" ])

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow `describe` and `it` blocks in favor of flat `test` calls" },
    schema: [],
    messages: { testBlock: "`{{name}}` nests tests. Write each case as a single `test` call, named in full." }
  },
  create(context) {
    return {
      CallExpression({ callee }) {
        const name = blockNameIn(callee)
        if (name) context.report({ node: callee, messageId: "testBlock", data: { name } })
      }
    }
  }
}

function blockNameIn(callee) {
  return namesIn(callee).find((name) => BLOCK_NAMES.has(name))
}

function namesIn(node) {
  if (node.type === "Identifier") return [ node.name ]

  return node.type === "MemberExpression" ? namesInMember(node) : []
}

function namesInMember(node) {
  return node.computed ? namesIn(node.object) : [ ...namesIn(node.object), ...namesIn(node.property) ]
}

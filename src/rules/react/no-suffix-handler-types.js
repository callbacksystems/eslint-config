// Generic suffixes (`Flow`, `Manager`, `Helper`, `Service`, `Provider`,
// `Builder`, `Strategy`, `Dispatcher`) are AI-drift signals: the abstraction
// has no real name. Rename to describe what it does, not what it is.
// Exceptions: `class extends Controller` (Stimulus uses `Controller`
// legitimately), `*Handler` for DOM event handler classes (House `InputHandler`).

const FORBIDDEN_SUFFIXES = [ "Flow", "Manager", "Service", "Provider", "Builder", "Strategy", "Dispatcher" ]

const SUFFIX_PATTERN = new RegExp(`(${FORBIDDEN_SUFFIXES.join("|")})$`, "u")
const FORBIDDEN_HOOK = /^use\w+(Flow|Manager|Service|Provider|Builder|Strategy|Dispatcher|Helper)$/u

const matchedSuffix = (name) => {
  const match = SUFFIX_PATTERN.exec(name)
  return match ? match[1] : null
}

const isStimulusController = (classNode) =>
  classNode.superClass?.type === "Identifier" && classNode.superClass.name === "Controller"

const isFunctionLikeInit = (init) =>
  init?.type === "FunctionExpression" || init?.type === "ArrowFunctionExpression"

const reportName = (context, node, name) => {
  if (FORBIDDEN_HOOK.test(name)) {
    context.report({ node, messageId: "hookSuffix", data: { name } })
  } else {
    const suffix = matchedSuffix(name)
    if (suffix) context.report({ node, messageId: "suffix", data: { name, suffix } })
  }
}

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow generic suffixes (Flow/Manager/Service/...) that hide intent" },
    schema: [],
    messages: {
      suffix: "`{{name}}` ends in `{{suffix}}`. Rename to describe what it does, not what it is.",
      hookSuffix: "Hook `{{name}}` uses a generic suffix. Inline or rename to a verb describing the action."
    }
  },
  create(context) {
    return {
      FunctionDeclaration(node) {
        if (node.id) reportName(context, node.id, node.id.name)
      },
      ClassDeclaration(node) {
        if (node.id && !isStimulusController(node)) reportName(context, node.id, node.id.name)
      },
      VariableDeclarator(node) {
        if (node.id.type === "Identifier" && isFunctionLikeInit(node.init)) {
          reportName(context, node.id, node.id.name)
        }
      }
    }
  }
}

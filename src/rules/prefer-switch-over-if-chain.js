// `if (x === A) ... else if (x === B) ... else if (x === C) ...` chains with
// 3+ branches comparing the same identifier read better as a `switch` (and
// in TS get exhaustiveness checking on union types).

const MIN_BRANCHES = 3

const equalityComparison = (test) => {
  if (test.type !== "BinaryExpression") return null
  if (test.operator !== "===" && test.operator !== "==") return null

  if (test.left.type === "Identifier") return test.left.name
  return null
}

const collectChainBranches = (ifStatement) => {
  const branches = []
  let current = ifStatement
  while (current?.type === "IfStatement") {
    const compared = equalityComparison(current.test)
    if (!compared) return []

    branches.push(compared)
    current = current.alternate
  }
  return branches
}

const branchesShareIdentifier = (branches) => {
  if (branches.length < MIN_BRANCHES) return false

  const [ first ] = branches
  return branches.every((name) => name === first)
}

const isTopOfChain = (node) =>
  node.parent.type !== "IfStatement" || node.parent.alternate !== node

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Prefer `switch` over `if/else if` chains comparing the same identifier" },
    schema: [],
    messages: {
      preferSwitch: "Chain of {{count}} `if/else if` comparing `{{name}}`. Use `switch` for clarity and exhaustiveness."
    }
  },
  create(context) {
    return {
      IfStatement(node) {
        if (isTopOfChain(node)) {
          const branches = collectChainBranches(node)
          if (branchesShareIdentifier(branches)) {
            context.report({ node, messageId: "preferSwitch", data: { count: branches.length, name: branches[0] } })
          }
        }
      }
    }
  }
}

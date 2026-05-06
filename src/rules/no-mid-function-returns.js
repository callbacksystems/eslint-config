// `return`/`throw` is allowed in the leading guard zone (up to 2 boilerplate
// calls like `event.preventDefault()`, then vars and guards) and as the
// function's last statement. Returns inside loops, switch, try/catch, or
// nested functions are structured exits and not analyzed here.

import { isFunctionExit, isGuardClause } from "#helpers/ast"

const MAX_BOILERPLATE = 2

const isInGuardZone = (node) => node.type === "VariableDeclaration" || isGuardClause(node)

const isBoilerplateCall = (node) =>
  node.type === "ExpressionStatement" && node.expression.type === "CallExpression"

const skipBoilerplate = (statements) => {
  let index = 0
  while (index < Math.min(MAX_BOILERPLATE, statements.length) && isBoilerplateCall(statements[index])) {
    index += 1
  }
  return index
}

const findInBlock = (block) => {
  for (const child of block.body) {
    const found = findOffendingExit(child)
    if (found) return found
  }
  return null
}

const findOffendingExit = (node) => {
  if (!node) return null
  if (isFunctionExit(node)) return node

  switch (node.type) {
    case "IfStatement": return findOffendingExit(node.consequent) ?? findOffendingExit(node.alternate)
    case "LabeledStatement": return findOffendingExit(node.body)
    case "BlockStatement": return findInBlock(node)
    default: return null
  }
}

const guardZoneEnd = (statements) => {
  let index = skipBoilerplate(statements)
  while (index < statements.length && isInGuardZone(statements[index])) index++
  return index
}

const reportOffenders = ({ context, statements, fromIndex, toIndex }) => {
  for (let index = fromIndex; index < toIndex; index += 1) {
    const offender = findOffendingExit(statements[index])
    if (offender) context.report({ node: offender, messageId: "midFunctionReturn" })
  }
}

const checkFunction = (context, node) => {
  if (node.body.type !== "BlockStatement") return

  const statements = node.body.body
  if (statements.length < 2) return

  reportOffenders({ context, statements, fromIndex: guardZoneEnd(statements), toIndex: statements.length - 1 })
}

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow `return`/`throw` outside the leading guard zone or final statement" },
    schema: [],
    messages: {
      midFunctionReturn: "Avoid mid-function exits. Use a ternary, if/else, find/some/every, or extract a helper."
    }
  },
  create(context) {
    return {
      FunctionDeclaration: (node) => checkFunction(context, node),
      FunctionExpression: (node) => checkFunction(context, node),
      ArrowFunctionExpression: (node) => checkFunction(context, node)
    }
  }
}

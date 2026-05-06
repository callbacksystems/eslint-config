// A private method or getter that only forwards to another call adds indirection
// without value. A method that passes its own parameters or fields straight
// through (`return other(x)`) should be inlined. A getter that forwards the
// class's own fields to a module-local function (`return build(this.#a, this.#b)`)
// means that function is really a method of this class, so move the logic in.
// Public methods and predicates are left alone.

import { identifierParameterNames, isThisMember, memberName, soleStatementOf } from "#helpers/ast"
import { isBooleanName } from "#helpers/naming"
import { reportProblem } from "#helpers/report"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow private methods or getters that only forward to another call" },
    schema: [],
    messages: { redundantWrapper: "`{{name}}` only forwards to another call. Inline it instead of wrapping." }
  },
  create(context) {
    const localFunctions = moduleLocalFunctionsIn(context.sourceCode.ast)
    return { MethodDefinition: (node) => reportProblem(context, new WrapperMethod(node, localFunctions)) }
  }
}

function moduleLocalFunctionsIn(program) {
  return new Set(program.body.filter((node) => node.type === "FunctionDeclaration").map((node) => node.id.name))
}

class WrapperMethod {
  #node
  #localFunctions
  #cachedParameterNames

  constructor(node, localFunctions) {
    this.#node = node
    this.#localFunctions = localFunctions
  }

  get problem() {
    return this.#isRedundant
      ? { node: this.#node.key, messageId: "redundantWrapper", data: { name: this.#name } }
      : null
  }

  #accepts(callee) {
    return isSimpleCallee(callee) && (this.#node.kind === "method" || this.#isLocalFunction(callee))
  }

  #isLocalFunction(callee) {
    return callee.type === "Identifier" && this.#localFunctions.has(callee.name)
  }

  #passesEveryArgument(callArguments) {
    return callArguments.every((argument) => this.#passesParameter(argument) || isThisMember(argument))
  }

  #passesParameter(argument) {
    return argument.type === "Identifier" && this.#parameterNames.has(argument.name)
  }

  get #isRedundant() {
    return this.#isCheckedPrivate && this.#forwards
  }

  get #isCheckedPrivate() {
    const { key, kind } = this.#node
    return (kind === "method" || kind === "get") && key.type === "PrivateIdentifier" && !isBooleanName(key.name)
  }

  get #forwards() {
    const call = this.#forwardedCall
    return Boolean(call) && this.#accepts(call.callee) && this.#passesEveryArgument(call.arguments)
  }

  get #forwardedCall() {
    return isReturnCall(this.#soleStatement) ? this.#soleStatement.argument : null
  }

  get #soleStatement() {
    return soleStatementOf(this.#node.value.body)
  }

  get #name() {
    return memberName(this.#node)
  }

  get #parameterNames() {
    return this.#cachedParameterNames ??= identifierParameterNames(this.#node.value.params)
  }
}

function isSimpleCallee(callee) {
  return callee.type === "Identifier" || (callee.type === "MemberExpression" && callee.object.type === "ThisExpression")
}

function isReturnCall(statement) {
  return statement?.type === "ReturnStatement" && statement.argument?.type === "CallExpression"
}

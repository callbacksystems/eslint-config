// A parameterless method whose whole body is `return <value>` is a computed property in disguise. Expose it as a getter
// so callers read it as state (`obj.size`) instead of calling it (`obj.size()`). Returns that act rather than compute
// (assignment, await, `this` for chaining, a returned function) are left as methods, as are conventional methods like
// `toString`. One that returns a fixed literal is a constant, which `prefer-constant` says better.

import { EvaluatedExpressions } from "#helpers/flow/evaluated_expressions"
import { FunctionMutations } from "#helpers/flow/function_mutations"
import { resolvedMemberKeyOf } from "#helpers/classes/resolved_member_key"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { returnsFixedLiteral } from "#helpers/syntax/literals"
import { reportProblem } from "#helpers/eslint/report"

const RESERVED = new Set([ "toString", "toJSON", "valueOf", "toLocaleString", "render", "clone" ])
const ACTION_RETURNS = new Set([
  "ThisExpression",
  "AssignmentExpression",
  "UpdateExpression",
  "AwaitExpression",
  "YieldExpression",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "ClassExpression",
  "NewExpression"
])
const EFFECT_BY_TYPE = {
  AssignmentExpression: () => true,
  UpdateExpression: () => true,
  UnaryExpression: (node) => node.operator === "delete",
  NewExpression: () => true
}

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Prefer a getter over a parameterless method that only returns a value" },
    schema: [],
    messages: { preferGetter: "`{{name}}` takes no parameters and only returns a value. Make it a getter." }
  },
  create(context) {
    const bindings = BindingResolver.for(context.sourceCode)
    const effects = new GetterEffects(context.sourceCode)
    return { MethodDefinition: (node) => reportProblem(context, new GetterCandidate(node, { bindings, effects })) }
  }
}

class GetterEffects {
  #cachedMutations
  #sourceCode

  constructor(sourceCode) {
    this.#sourceCode = sourceCode
  }

  includes(node) {
    return node.type === "CallExpression"
      ? !this.#mutations.isPureFromCall(node)
      : Boolean(EFFECT_BY_TYPE[node.type]?.(node))
  }

  isPureFrom(functionNode) {
    return this.#mutations.isPureFrom(functionNode)
  }

  get #mutations() {
    return this.#cachedMutations ??= new FunctionMutations(this.#sourceCode, {
      isAdditionalEffect: (node) => node.type === "NewExpression"
    })
  }
}

class GetterCandidate {
  #effects
  #name
  #node

  constructor(node, { bindings, effects }) {
    this.#effects = effects
    this.#name = resolvedNameOf(node, bindings)
    this.#node = node
  }

  get problem() {
    return this.#isOffense
      ? { node: this.#node.key, messageId: "preferGetter", data: { name: this.#name } }
      : null
  }

  get #isOffense() {
    return this.#node.kind === "method"
      && this.#name !== null
      && isPlainParameterless(this.#node.value)
      && this.#returnsComputedValue
      && !returnsFixedLiteral(this.#node.value.body)
      && !this.#isReserved
  }

  get #returnsComputedValue() {
    const { body } = this.#node.value
    if (body.type !== "BlockStatement" || body.body.length !== 1) return false

    const [ statement ] = body.body
    return statement.type === "ReturnStatement"
      && Boolean(statement.argument)
      && !ACTION_RETURNS.has(statement.argument.type)
      && !new EvaluatedExpressions([ statement.argument ]).includes((node) => this.#effects.includes(node))
      && this.#effects.isPureFrom(this.#node.value)
  }

  get #isReserved() {
    return RESERVED.has(this.#name.replace(/^#/u, ""))
  }
}

function resolvedNameOf(member, bindings) {
  const key = resolvedMemberKeyOf(member, bindings)
  if (key) return key.node.type === "PrivateIdentifier" ? `#${key.name}` : key.name

  return null
}

function isPlainParameterless(functionNode) {
  return functionNode.params.length === 0 && !functionNode.async && !functionNode.generator
}

// `return tryA() || tryB() || tryC()` where each function returns `boolean` to mean "I handled it" is the dispatcher
// anti-pattern (Nudge mailDispatcher). Use a switch on the action type or a real handler map.

import { isProvablyBoolean } from "#helpers/syntax/ast"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { CalleeResolver } from "#helpers/scope/callee_resolver"
import { canFallThrough, hasReachableReturn } from "#helpers/flow/function_completion"
import { hasBareReturn, ownReturnArguments } from "#helpers/syntax/functions"
import { isGlobalBooleanCallee } from "#helpers/functions/global_boolean_callee"
import { FunctionMutations } from "#helpers/flow/function_mutations"
import { FunctionExecutionContexts } from "#helpers/flow/function_execution_contexts"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow boolean-returning handler chains (`a() || b() || c()`)" },
    schema: [ { type: "object", properties: { min: { type: "integer", minimum: 2 } }, additionalProperties: false } ],
    defaultOptions: [ { min: 3 } ],
    messages: {
      booleanHandlerChain: "Chain of {{count}} boolean handlers. Use `switch` on the discriminator or a handler map."
    }
  },
  create(context) {
    const { min } = context.options[0]
    const handlers = new HandlerFunctions(context.sourceCode)
    return {
      ReturnStatement(node) {
        if (node.argument) {
          const chain = new HandlerChain(node.argument, handlers)
          if (chain.meets(min)) {
            context.report({ node, messageId: "booleanHandlerChain", data: { count: chain.count } })
          }
        }
      }
    }
  }
}

class HandlerFunctions {
  #bindings
  #booleanResults = new WeakMap()
  #cachedActions
  #cachedMutations
  #callees
  #functions = new WeakMap()
  #sourceCode

  constructor(sourceCode) {
    this.#callees = new CalleeResolver(sourceCode)
    this.#bindings = BindingResolver.for(sourceCode)
    this.#sourceCode = sourceCode
  }

  functionFor(callee) {
    if (!this.#functions.has(callee)) this.#functions.set(callee, this.#callees.functionFor(callee))

    return this.#functions.get(callee)
  }

  returnsOnlyBooleansFrom(functionNode) {
    if (!this.#booleanResults.has(functionNode)) {
      this.#booleanResults.set(functionNode, new BooleanHandlerFunction(functionNode, this).returnsOnlyBooleans)
    }

    return this.#booleanResults.get(functionNode)
  }

  isProvablyBoolean(node) {
    return isProvablyBoolean(node, { isBooleanCall: (call) => isGlobalBooleanCallee(call.callee, this.#bindings) })
  }

  actsFrom(functionNode) {
    return this.#mutations.mutatesFrom(functionNode) || this.#actions.includes(functionNode)
  }

  get #mutations() {
    return this.#cachedMutations ??= new FunctionMutations(this.#sourceCode, { memberWrites: "observable" })
  }

  get #actions() {
    return this.#cachedActions ??= new DiscardedUnknownCalls(this.#sourceCode, this.#mutations)
  }
}

class BooleanHandlerFunction {
  #functionNode
  #handlers

  constructor(functionNode, handlers) {
    this.#functionNode = functionNode
    this.#handlers = handlers
  }

  get returnsOnlyBooleans() {
    const returned = ownReturnArguments(this.#functionNode)
    return this.#isSynchronous && hasReachableReturn(this.#functionNode) && returned.length > 0
      && !hasBareReturn(this.#functionNode) && !canFallThrough(this.#functionNode)
      && returned.every((node) => this.#handlers.isProvablyBoolean(node))
  }

  get #isSynchronous() {
    return !this.#functionNode.async && !this.#functionNode.generator
  }
}

class DiscardedUnknownCalls {
  #functions = new WeakSet()

  constructor(sourceCode, mutations) {
    new FunctionExecutionContexts(sourceCode.ast).forEach(({ node, functionNode }) => {
      if (functionNode && isDiscardedUnknownCall(node, mutations)) this.#functions.add(functionNode)
    })
  }

  includes(functionNode) {
    return this.#functions.has(functionNode)
  }
}

function isDiscardedUnknownCall(node, mutations) {
  return isDirectlyDiscardedCall(node) && mutations.hasUnknownFromCall(node)
}

function isDirectlyDiscardedCall(node) {
  return node.type === "CallExpression"
    && node.parent.type === "ExpressionStatement"
    && node.parent.expression === node
}

class HandlerChain {
  #root
  #handlers
  #cachedCalls

  constructor(root, handlers) {
    this.#root = root
    this.#handlers = handlers
  }

  meets(minimum) {
    return this.#calls.length >= minimum
      && this.#calls.every((call) => new HandlerCall(call, this.#handlers).isBooleanHandler)
  }

  get count() {
    return this.#calls.length
  }

  get #calls() {
    return this.#cachedCalls ??= new OrCalls(this.#root).calls
  }
}

class HandlerCall {
  #call
  #handlers

  constructor(call, handlers) {
    this.#call = call
    this.#handlers = handlers
  }

  get isBooleanHandler() {
    return Boolean(this.#function) && this.#returnsOnlyBooleans && this.#handlers.actsFrom(this.#function)
  }

  get #function() {
    return this.#handlers.functionFor(this.#call.callee)
  }

  get #returnsOnlyBooleans() {
    return this.#handlers.returnsOnlyBooleansFrom(this.#function)
  }
}

class OrCalls {
  #pending
  #calls = []
  #isValid = true

  constructor(root) {
    this.#pending = [ root ]
  }

  get calls() {
    while (this.#pending.length > 0 && this.#isValid) this.#visit(this.#pending.pop())
    return this.#isValid ? this.#calls : []
  }

  #visit(node) {
    if (node.type === "CallExpression") {
      this.#calls.push(node)
    } else if (isOrLogical(node)) {
      this.#pending.push(node.right, node.left)
    } else {
      this.#isValid = false
    }
  }
}

function isOrLogical(node) {
  return node.type === "LogicalExpression" && node.operator === "||"
}

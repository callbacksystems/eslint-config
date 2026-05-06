import { ExecutionDominance } from "#helpers/flow/execution_dominance"
import { exportedVariablesIn } from "#helpers/scope/exports"
import { isFunction } from "#helpers/syntax/functions"

export class FunctionActivity {
  #activeFunctions = new WeakMap()
  #bindings
  #execution
  #exports
  #resolvingBindings = new WeakSet()
  #resolving = new WeakSet()
  #sourceCode

  constructor(sourceCode, bindings) {
    this.#sourceCode = sourceCode
    this.#bindings = bindings
    this.#execution = new ExecutionDominance(sourceCode.ast)
    this.#exports = exportedVariablesIn(sourceCode)
  }

  canExecuteNode(node) {
    const root = this.#sourceCode.getScope(node).variableScope.block
    return isFunction(root) ? this.#isCachedFunctionActive(root) : true
  }

  #isCachedFunctionActive(functionNode) {
    if (!this.#activeFunctions.has(functionNode)) {
      this.#activeFunctions.set(functionNode, this.#isFunctionActive(functionNode))
    }
    return this.#activeFunctions.get(functionNode)
  }

  #isFunctionActive(functionNode) {
    if (this.#activeFunctions.has(functionNode)) return this.#activeFunctions.get(functionNode)
    return !this.#resolving.has(functionNode)
      && this.#isUncachedFunctionActive(functionNode)
  }

  #isUncachedFunctionActive(functionNode) {
    this.#resolving.add(functionNode)
    const binding = this.#bindingFor(functionNode)
    const isActive = binding ? this.#canUseBinding(binding) : true
    this.#resolving.delete(functionNode)
    if (isActive) this.#activeFunctions.set(functionNode, true)
    return this.#activeFunctions.has(functionNode)
  }

  #bindingFor(functionNode) {
    if (functionNode.type === "FunctionDeclaration") return this.#declaredBindingOf(functionNode)
    return isDirectVariableValue(functionNode) ? this.#declaredBindingOf(functionNode.parent) : null
  }

  #declaredBindingOf(node) {
    return this.#sourceCode.getDeclaredVariables(node)[0] ?? null
  }

  #canUseBinding(binding) {
    return !this.#resolvingBindings.has(binding) && this.#isUncachedBindingActive(binding)
  }

  #isUncachedBindingActive(binding) {
    this.#resolvingBindings.add(binding)
    try {
      return this.#exports.has(binding) || this.#isExternallyVisible(binding)
        || this.#isDynamic(binding) || binding.references.some((reference) => this.#isActiveReference(reference))
    } finally {
      this.#resolvingBindings.delete(binding)
    }
  }

  #isExternallyVisible(binding) {
    return this.#sourceCode.ast.sourceType === "script" && binding.scope.type === "global"
  }

  #isDynamic(binding) {
    return binding.identifiers.some((identifier) => this.#bindings.isDynamicallyResolved(identifier))
  }

  #isActiveReference(reference) {
    if (reference.init || !this.#isReachable(reference.identifier)) return false

    const alias = this.#stableAliasBindingOf(reference.identifier)
    if (alias) return this.#canUseBinding(alias)

    const owner = reference.from.variableScope.block
    return !isFunction(owner) || this.#isFunctionActive(owner)
  }

  #isReachable(node) {
    return this.#execution.isReachable(node)
  }

  #stableAliasBindingOf(identifier) {
    const declarator = identifier.parent
    return isDirectAliasOf(declarator, identifier) && this.#bindings.isUnmodified(declarator.id)
      ? this.#bindings.variableFor(declarator.id)
      : null
  }
}

function isDirectVariableValue(functionNode) {
  return functionNode.parent?.type === "VariableDeclarator" && functionNode.parent.init === functionNode
}

function isDirectAliasOf(declarator, identifier) {
  return [
    declarator?.type === "VariableDeclarator",
    declarator?.init === identifier,
    declarator?.id?.type === "Identifier"
  ].every(Boolean)
}

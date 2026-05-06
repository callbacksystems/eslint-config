import { exportedVariablesIn } from "#helpers/scope/exports"
import { hasDirectEvalIn } from "#helpers/scope/dynamic_scope"
import { PointwiseAliasConfinement } from "#helpers/scope/pointwise_alias_confinement"

export class StableAliasGroups {
  static #bySource = new WeakMap()

  #bindings
  #byVariable = new WeakMap()
  #groups = new Map()
  #references = new WeakMap()
  #sourceCode

  static for(sourceCode, bindings) {
    if (!this.#bySource.has(sourceCode)) {
      this.#bySource.set(sourceCode, new StableAliasGroups(sourceCode, bindings))
    }
    return this.#bySource.get(sourceCode)
  }

  constructor(sourceCode, bindings) {
    this.#sourceCode = sourceCode
    this.#bindings = bindings
    this.#indexReferences()
    this.#indexBindings(exportedVariablesIn(sourceCode))
    this.#completeGroups()
  }

  groupFor(identifier) {
    const group = this.#byVariable.get(this.#bindings.variableFor(identifier)) ?? null
    return group?.root === this.#bindings.stableValueFor(identifier) ? group : null
  }

  referenceFor(identifier) {
    return this.#references.get(identifier) ?? null
  }

  #indexReferences() {
    this.#sourceCode.scopeManager.scopes.forEach((scope) => scope.references.forEach((reference) => {
      this.#references.set(reference.identifier, reference)
    }))
  }

  #indexBindings(exports) {
    this.#sourceCode.scopeManager.scopes.forEach((scope) => scope.variables.forEach((variable) => {
      const { root } = new StableAliasBinding(variable, this.#bindings)
      if (root) this.#add(variable, root, { isExported: exports.has(variable) })
    }))
  }

  #add(variable, root, { isExported }) {
    if (!this.#groups.has(root)) this.#groups.set(root, new StableAliasGroup(root, this.#sourceCode))
    const group = this.#groups.get(root)
    group.add(variable, { isExported })
    this.#byVariable.set(variable, group)
  }

  #completeGroups() {
    const evalExposure = new EvalExposure(this.#sourceCode)
    this.#groups.forEach((group) => group.complete(evalExposure))
  }
}

class StableAliasBinding {
  #bindings
  #identifier

  constructor(variable, bindings) {
    this.#bindings = bindings
    this.#identifier = variable.defs.length === 1 ? variable.identifiers[0] : null
  }

  get root() {
    if (!this.#identifier || !this.#bindings.isUnmodified(this.#identifier)) return null

    const value = this.#bindings.stableValueFor(this.#identifier)
    return value?.type && value.type !== "Identifier" ? value : null
  }
}

class StableAliasGroup {
  variables = new Set()

  #confinement = new WeakMap()
  #evalExposure = null
  #hasExport = false
  #hasScriptGlobal = false
  #isComplete = false
  #pointwiseConfinement = new WeakMap()
  #sourceCode

  constructor(root, sourceCode) {
    this.root = root
    this.#sourceCode = sourceCode
  }

  add(variable, { isExported }) {
    this.variables.add(variable)
    if (isExported) this.#hasExport = true
    if (variable.scope.type === "global") this.#hasScriptGlobal = true
  }

  complete(evalExposure) {
    this.#evalExposure = evalExposure
    this.#isComplete = true
  }

  includes(variable) {
    return this.variables.has(variable)
  }

  isConfinedFor(policy, isSafeReference) {
    if (!this.#confinement.has(policy)) {
      this.#confinement.set(policy, this.#isAlwaysOwned
      && this.#nonAliasReferences.every(isSafeReference))
    }
    return this.#confinement.get(policy)
  }

  isConfinedAt({ ignoredReference = null, isSafeReference, policy, reference, target }) {
    if (this.#isPointwiseOwned) {
      if (!this.#pointwiseConfinement.has(policy)) {
        this.#pointwiseConfinement.set(policy, new PointwiseAliasConfinement(
          [ ...this.#nonAliasReferences, ...this.#evalReferences ], {
            isSafeReference: (candidate) => !candidate.isEvalExposure && isSafeReference(candidate),
            rootScope: this.rootScope,
            sourceCode: this.#sourceCode
          }))
      }
      return this.#pointwiseConfinement.get(policy).isSafeAt(target, reference, { ignoredReference })
    } else {
      return false
    }
  }

  get rootScope() {
    const variables = Array.from(this.variables)
    return (variables.find((variable) => directValueOf(variable) === this.root)
      ?? variables[0])?.scope.variableScope ?? null
  }

  get #isAlwaysOwned() {
    return this.#isPointwiseOwned && this.#evalReferences.length === 0
  }

  get #isPointwiseOwned() {
    return this.#isComplete && !this.#hasExport && !this.#hasScriptGlobal
  }

  get #evalReferences() {
    return this.#evalExposure.referencesForAny(this.variables)
      .map((reference) => new EvalExposureReference(reference))
  }

  get #nonAliasReferences() {
    return Array.from(this.variables).flatMap((variable) => variable.references
      .filter((reference) => !reference.init && !this.#isAlias(reference.identifier)))
  }

  #isAlias(identifier) {
    return new AliasDeclaration(identifier.parent, this.#sourceCode).belongsTo(this)
  }
}

function directValueOf(variable) {
  const definition = variable.defs.length === 1 ? variable.defs[0] : null
  if (definition?.type === "ClassName") return definition.node
  return definition?.type === "Variable" ? definition.node.init : null
}

class EvalExposureReference {
  isEvalExposure = true

  constructor(reference) {
    this.identifier = reference.identifier
    this.from = reference.from
  }
}

class AliasDeclaration {
  #declarator
  #sourceCode

  constructor(declarator, sourceCode) {
    this.#declarator = declarator
    this.#sourceCode = sourceCode
  }

  belongsTo(group) {
    return this.#hasAliasShape && group.includes(this.#variable)
  }

  get #hasAliasShape() {
    return this.#declarator?.type === "VariableDeclarator"
      && this.#declarator.init?.type === "Identifier" && this.#declarator.id.type === "Identifier"
  }

  get #variable() {
    return this.#sourceCode.getDeclaredVariables(this.#declarator)[0]
  }
}

class EvalExposure {
  #references

  constructor(sourceCode) {
    this.#references = sourceCode.scopeManager.scopes.flatMap((scope) => scope.references)
      .filter((reference) => isDirectEvalReference(reference, sourceCode))
  }

  referencesForAny(variables) {
    return this.#references.filter((reference) => new VisibleBindings(reference.from).includesAny(variables))
  }
}

function isDirectEvalReference(reference, sourceCode) {
  const { identifier } = reference
  const call = identifier.parent
  return call?.type === "CallExpression" && !call.optional && call.callee === identifier
    && identifier.name === "eval" && hasDirectEvalIn(sourceCode, identifier)
}

class VisibleBindings {
  #scope

  constructor(scope) {
    this.#scope = scope
  }

  includesAny(variables) {
    const hiddenNames = new Set()
    for (let current = this.#scope; current; current = current.upper) {
      if (current.variables.some((variable) => includesVisible(variable, variables, hiddenNames))) return true
    }
    return false
  }
}

function includesVisible(variable, variables, hiddenNames) {
  const isVisible = !hiddenNames.has(variable.name)
  hiddenNames.add(variable.name)
  return isVisible && variables.has(variable)
}

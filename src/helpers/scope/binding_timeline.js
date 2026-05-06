import { ExecutionDominance } from "#helpers/flow/execution_dominance"
import { isReassignment } from "#helpers/scope/references"
import { BindingAssignments } from "#helpers/scope/binding_assignments"
import { BindingState } from "#helpers/scope/binding_state"

export class BindingTimeline {
  #assignmentsByVariable = new WeakMap()
  #dominance
  #reachableWrites
  #scopesByIdentifier
  #statesByVariable = new WeakMap()
  #unresolvedWrites

  constructor(scopeManager) {
    this.#dominance = new ExecutionDominance(scopeManager.globalScope.block)
    this.#reachableWrites = new ReachableWrites(this.#dominance)
    this.#scopesByIdentifier = new ReferenceScopes(scopeManager.scopes)
    this.#unresolvedWrites = new UnresolvedWrites(
      this.#reachableWrites.writesIn(scopeManager.globalScope.through), this.#dominance)
  }

  definitionAt(identifier, variable) {
    return variable
      ? this.#stateOf(variable).definitionAt(identifier, this.#scopesByIdentifier.scopeOf(identifier))
      : null
  }

  assignmentAt(identifier, variable) {
    return variable
      ? this.#assignmentsOf(variable).valueAt(identifier, this.#scopesByIdentifier.referenceOf(identifier))
      : null
  }

  isOriginalGlobalAt(identifier, variable) {
    return variable
      ? this.isGlobalBinding(variable) && this.#stateOf(variable).isOriginalAt(identifier)
      : this.#unresolvedWrites.isOriginalAt(identifier)
  }

  isGlobalBinding(variable) {
    return Boolean(variable) && variable.scope.type === "global" && variable.defs.length === 0
  }

  #stateOf(variable) {
    if (!this.#statesByVariable.has(variable)) {
      this.#statesByVariable.set(variable,
        new BindingState(variable.defs, this.#reachableWrites.writesIn(variable.references), {
          dominance: this.#dominance,
          scope: variable.scope
        }))
    }
    return this.#statesByVariable.get(variable)
  }

  #assignmentsOf(variable) {
    if (!this.#assignmentsByVariable.has(variable)) {
      this.#assignmentsByVariable.set(variable, new BindingAssignments(variable,
        this.#reachableWrites.writesIn(variable.references), this.#dominance))
    }
    return this.#assignmentsByVariable.get(variable)
  }
}

class ReachableWrites {
  #dominance

  constructor(dominance) {
    this.#dominance = dominance
  }

  writesIn(references) {
    return references.filter((reference) =>
      isReassignment(reference) && this.#dominance.isReachable(reference.identifier))
  }
}

class ReferenceScopes {
  #values

  constructor(scopes) {
    this.#values = new WeakMap(scopes.flatMap((scope) => scope.references)
      .map((reference) => [ reference.identifier, reference ]))
  }

  scopeOf(identifier) {
    return this.referenceOf(identifier)?.from ?? null
  }

  referenceOf(identifier) {
    return this.#values.get(identifier) ?? null
  }
}

class UnresolvedWrites {
  #dominance
  #referencesByName = new Map()
  #statesByName = new Map()

  constructor(writes, dominance) {
    this.#dominance = dominance
    writes.forEach((reference) => this.#add(reference))
  }

  isOriginalAt(identifier) {
    return this.#stateFor(identifier.name).isOriginalAt(identifier)
  }

  #add(reference) {
    const { name } = reference.identifier
    if (!this.#referencesByName.has(name)) this.#referencesByName.set(name, [])
    this.#referencesByName.get(name).push(reference)
  }

  #stateFor(name) {
    if (!this.#statesByName.has(name)) {
      this.#statesByName.set(name, new BindingState([], this.#referencesByName.get(name) ?? [], {
        dominance: this.#dominance
      }))
    }
    return this.#statesByName.get(name)
  }
}

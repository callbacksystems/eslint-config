import { FunctionExecutionContexts } from "#helpers/flow/function_execution_contexts"
import { MutationPositions } from "#helpers/flow/mutation_positions"
import { memberWriteOperationOf } from "#helpers/classes/member_write_targets"
import { resolvedRuntimeMemberKeyOf } from "#helpers/classes/resolved_member_key"
import { StandardPropertyWrites } from "#helpers/objects/standard_property_writes"
import { GlobalValueIdentity } from "#helpers/scope/global_value_identity"

const REACHABLE_NODES_BY_ROOT = new WeakMap()

export class ReceiverMutationIndex {
  #bindings
  #callableMutations = new WeakMap()
  #globals
  #operations = []
  #propertyMutations
  #reachable
  #rootScope

  constructor(variables, { bindings, root, rootScope }) {
    this.#bindings = bindings
    this.#globals = new GlobalValueIdentity(bindings)
    this.#propertyMutations = new PropertyMutations(rootScope)
    this.#reachable = reachableNodesFor(root)
    this.#rootScope = rootScope
    variables.forEach((variable) => variable.references.forEach((reference) => this.#add(reference)))
  }

  hasCallableBefore({ members, receiver, reference, target }) {
    return this.#callableMutationsFor(members, receiver)
      .hasBefore(target, reference?.from)
  }

  hasPropertyMutationBefore({ name, reference, target }) {
    return this.#propertyMutations.hasBefore(name, target, reference?.from)
  }

  #add(reference) {
    const member = directMemberOf(reference.identifier)
    const operation = member && memberWriteOperationOf(member)
    if (operation && this.#reachable.has(operation)) this.#addOperation(operation, member, reference.from)

    this.#indirectWritesOf(reference.identifier).forEach(({ name }) =>
      this.#addNamedOperation(name, reference.identifier.parent, reference.from))
  }

  #addOperation(operation, member, scope) {
    const property = resolvedRuntimeMemberKeyOf(member, { bindings: this.#bindings, globals: this.#globals })
    this.#record(new ReceiverMutation({ property: property?.name === "__proto__" ? null : property, operation, scope }))
  }

  #record(mutation) {
    this.#operations.push(mutation)
    this.#propertyMutations.add(mutation)
  }

  #indirectWritesOf(identifier) {
    const call = identifier.parent
    return call?.type === "CallExpression"
      ? new StandardPropertyWrites(call, this.#bindings).values.filter(({ target }) => target === identifier)
      : []
  }

  #addNamedOperation(name, operation, scope) {
    if (this.#reachable.has(operation)) {
      this.#record(new ReceiverMutation({ property: propertyNamed(name), operation, scope }))
    }
  }

  #callableMutationsFor(members, receiver) {
    if (!this.#callableMutations.has(members)) {
      const mutations = new MutationPositions(this.#rootScope)
      this.#operations
        .filter((mutation) => mutation.affectsCallable(members, receiver))
        .forEach((mutation) => mutation.addTo(mutations))
      this.#callableMutations.set(members, mutations)
    }
    return this.#callableMutations.get(members)
  }
}

class PropertyMutations {
  #byName = new Map()
  #indeterminate
  #rootScope

  constructor(rootScope) {
    this.#indeterminate = new MutationPositions(rootScope)
    this.#rootScope = rootScope
  }

  add(mutation) {
    this.#positionsFor(mutation.property).add(mutation.operation, mutation.scope)
  }

  hasBefore(name, target, scope) {
    return this.#indeterminate.hasBefore(target, scope)
      || this.#byName.get(name)?.hasBefore(target, scope)
      || false
  }

  #positionsFor(property) {
    return property ? this.#positionsForKnown(property) : this.#indeterminate
  }

  #positionsForKnown(property) {
    const name = propertyIdentityOf(property)
    if (!this.#byName.has(name)) this.#byName.set(name, new MutationPositions(this.#rootScope))
    return this.#byName.get(name)
  }
}

function propertyIdentityOf(property) {
  return property.pathMember ?? property.name
}

function reachableNodesFor(root) {
  if (!REACHABLE_NODES_BY_ROOT.has(root)) REACHABLE_NODES_BY_ROOT.set(root, new ReachableNodes(root))
  return REACHABLE_NODES_BY_ROOT.get(root)
}

class ReachableNodes {
  #values = new WeakSet()

  constructor(root) {
    new FunctionExecutionContexts(root).forEach(({ node }) => this.#values.add(node))
  }

  has(node) {
    return this.#values.has(node)
  }
}

function directMemberOf(identifier) {
  const { parent } = identifier
  return parent?.type === "MemberExpression" && parent.object === identifier ? parent : null
}

class ReceiverMutation {
  constructor({ operation, property, scope }) {
    this.operation = operation
    this.property = property
    this.scope = scope
  }

  addTo(positions) {
    positions.add(this.operation, this.scope)
  }

  affectsCallable(members, receiver) {
    return !this.property || members.isCallableAt({ property: this.property, receiver })
      || !members.isStableDataAt({ property: this.property, receiver })
  }
}

function propertyNamed(name) {
  return name === null ? null : { kind: "public", name }
}

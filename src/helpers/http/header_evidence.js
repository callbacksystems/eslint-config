import { resolvedPublicMemberNameOf } from "#helpers/classes/resolved_member_key"
import { memberWriteOperationOf } from "#helpers/classes/member_write_targets"
import { CalleeResolver } from "#helpers/scope/callee_resolver"
import { LocalArgumentValues } from "#helpers/functions/local_argument_values"
import { LiteralHeaderInitializer } from "#helpers/http/literal_header_initializer"
import { HeaderArgumentConfinement } from "#helpers/http/header_argument_confinement"
import { HeaderNodes } from "#helpers/http/header_nodes"
import { StandardPropertyWrites } from "#helpers/objects/standard_property_writes"
import { StandardGlobals } from "#helpers/scope/standard_globals"
import { ReceiverIdentity } from "#helpers/scope/receiver_identity"
import { WrittenPropertyValues } from "#helpers/objects/written_property_values"
import { nodesIn } from "#helpers/syntax/ast"
import { isFunction } from "#helpers/syntax/functions"
import { isThisMember } from "#helpers/syntax/classes"

const IDENTITY_PRESERVING_ASSIGNMENT_OPERATORS = new Set([ "||=", "??=" ])

export class HeaderEvidence {
  #argumentConfinement
  #bindings
  #initializers
  #headerReceivers
  #requestReceivers
  #receiverIdentity
  #xhrReceivers

  constructor(sourceCode, bindings) {
    const values = new HeaderValues(sourceCode, bindings)
    this.#bindings = bindings
    this.#receiverIdentity = new ReceiverIdentity(sourceCode, bindings)
    this.#argumentConfinement = values.argumentConfinement
    this.#initializers = new HeaderInitializers(sourceCode, values)
    this.#headerReceivers = new ConstructedReceivers(values, "Headers")
    this.#requestReceivers = new ConstructedReceivers(values, "Request")
    this.#xhrReceivers = new ConstructedReceivers(values, "XMLHttpRequest")
  }

  includesInitializer(node) {
    return this.#initializers.includes(node)
  }

  includesObjectInitializerFor(node) {
    return this.#initializers.includesObjectFor(node)
  }

  includesHeadersReceiver(node) {
    return this.#headerReceivers.includes(node) || this.#includesRequestHeaders(node)
  }

  includesXhrReceiver(node) {
    return this.#xhrReceivers.includes(node)
  }

  hasUnmodifiedReceiverMemberAt(node, name, target) {
    if (node?.type !== "Identifier") return true
    return this.#argumentConfinement.includesValue(node)
      ? this.#argumentConfinement.hasUnmodifiedMemberAt(node, name, target)
      : this.#receiverIdentity.hasUnmodifiedMemberAt(node, name, target)
  }

  #includesRequestHeaders(node) {
    const value = node?.type === "Identifier" ? this.#bindings.stableValueFor(node) : node
    const isHeadersMember = value?.type === "MemberExpression"
      && resolvedPublicMemberNameOf(value, this.#bindings) === "headers"
    return isHeadersMember ? this.#requestReceivers.includes(value.object) : false
  }
}

class HeaderValues {
  constructor(sourceCode, bindings) {
    const callees = new HeaderLocalCallees(sourceCode, bindings)
    const rawArgumentValues = new LocalArgumentValues(sourceCode, bindings, {
      functionFor: (callee) => callees.functionFor(callee)
    })
    const argumentConfinement = new HeaderArgumentConfinement(sourceCode, bindings, {
      functionFor: (callee) => callees.functionFor(callee),
      isOriginalParameterAt: (identifier) => rawArgumentValues.isOriginalParameterAt(identifier),
      valuesOf: (identifier) => rawArgumentValues.valuesOf(identifier)
    })
    this.argumentConfinement = argumentConfinement
    this.argumentValues = new ConfinedHeaderArgumentValues(rawArgumentValues, argumentConfinement)
    this.bindings = bindings
    this.globals = new StandardGlobals(bindings)
  }
}

class HeaderLocalCallees {
  #bindings
  #cachedMembers
  #sourceCode

  constructor(sourceCode, bindings) {
    this.#bindings = bindings
    this.#sourceCode = sourceCode
  }

  functionFor(callee) {
    if (isFunction(callee)) return callee
    if (callee.type === "Identifier") return this.#bindings.functionFor(callee)
    return isThisMember(callee) && callee.property.type === "PrivateIdentifier"
      ? this.#members.functionFor(callee)
      : null
  }

  get #members() {
    return this.#cachedMembers ??= new CalleeResolver(this.#sourceCode)
  }
}

class ConfinedHeaderArgumentValues {
  #confinement
  #values

  constructor(values, confinement) {
    this.#values = values
    this.#confinement = confinement
  }

  valuesOf(node) {
    if (node?.type !== "Identifier") return this.#values.valuesOf(node)

    const source = this.#confinement.resolutionSourceFor(node)
    if (source) return this.#values.valuesOf(source)
    return this.#confinement.includesValue(node) ? [ node ] : this.#values.valuesOf(node)
  }
}

class HeaderInitializers {
  #globals
  #members = new WeakSet()
  #nodes
  #objects = new WeakSet()
  #writes

  constructor(sourceCode, values) {
    this.#globals = values.globals
    this.#writes = new WrittenPropertyValues(sourceCode.ast)
    this.#nodes = new HeaderNodes(values, this.#writes)
    const uses = []
    for (const node of nodesIn(sourceCode)) {
      this.recordWriteAt(node)
      if (node.type === "CallExpression" || node.type === "NewExpression") uses.push(node)
    }
    for (const node of uses) this.recordUseAt(node)
  }

  recordWriteAt(node) {
    if (node.type === "MemberExpression") this.#recordDirectWrite(node)
    else if (node.type === "CallExpression") this.#recordIndirectWrites(node)
  }

  recordUseAt(node) {
    this.#recordHeadersConstruction(node)
    this.#recordRequestOptions(node.arguments?.[1])
  }

  includesObjectFor(node) {
    return this.#nodes.resolvedValuesOf(node).some((value) =>
      value?.type === "ObjectExpression" && this.#objects.has(value))
  }

  includes(node) {
    return Boolean(node) && this.#members.has(node)
  }

  #recordDirectWrite(member) {
    const operation = memberWriteOperationOf(member)
    if (isGuaranteedPropertyWrite(operation)) {
      const name = resolvedPublicMemberNameOf(member, this.#nodes.bindings)
      for (const object of this.#nodes.stableObjectsOf(member.object)) {
        this.#writes.add(object, {
          operation,
          name,
          value: name === null ? null : this.#nodes.soleResolvedValueOf(directlyAssignedValueOf(member, operation))
        })
      }
    }
  }

  #recordIndirectWrites(call) {
    for (const write of this.#standardWritesAt(call)) {
      for (const object of this.#nodes.stableObjectsOf(write.target)) {
        this.#writes.add(object, {
          name: write.name,
          operation: call,
          value: write.name === null ? null : this.#nodes.soleResolvedValueOf(write.value)
        })
      }
    }
  }

  #standardWritesAt(call) {
    return new StandardPropertyWrites(call, this.#nodes.bindings).values
  }

  #recordHeadersConstruction(node) {
    if (isGlobalConstruction(node, this.#globals, "Headers")) this.#add(node.arguments[0], node)
  }

  #add(node, at) {
    const initializer = new LiteralHeaderInitializer(node, { at, nodes: this.#nodes })
    initializer.members.forEach((member) => this.#members.add(member))
    initializer.objects.forEach((object) => this.#objects.add(object))
  }

  #recordRequestOptions(options) {
    for (const object of this.#requestOptionsObjectsOf(options)) {
      this.#add(this.#nodes.propertyValueIn(object, "headers", options), options)
    }
  }

  #requestOptionsObjectsOf(options) {
    return new RequestOptions(options, this.#globals).isPresent
      ? this.#nodes.resolvedValuesOf(options).filter((value) => value?.type === "ObjectExpression")
      : []
  }
}

function isGuaranteedPropertyWrite(operation) {
  if (operation?.type === "UpdateExpression") return true
  if (operation?.type === "UnaryExpression") return operation.operator === "delete"
  return operation?.type === "AssignmentExpression"
    && !IDENTITY_PRESERVING_ASSIGNMENT_OPERATORS.has(operation.operator)
}

function directlyAssignedValueOf(member, operation) {
  return isSimpleAssignment(operation) && operation.left === member
    ? operation.right
    : null
}

function isSimpleAssignment(operation) {
  return operation.type === "AssignmentExpression" && operation.operator === "="
}

function isGlobalConstruction(node, globals, globalName) {
  return node?.type === "NewExpression" && globals.matches(node.callee, globalName)
}

class RequestOptions {
  #globals
  #node

  constructor(node, globals) {
    this.#node = node
    this.#globals = globals
  }

  get isPresent() {
    return Boolean(this.#node) && this.#invocation?.arguments?.[1] === this.#node && this.#isRequestCall
  }

  get #invocation() {
    return this.#node?.parent
  }

  get #isRequestCall() {
    return this.#invocation.type === "CallExpression"
      ? this.#globals.matches(this.#invocation.callee, "fetch")
      : this.#invocation.type === "NewExpression" && this.#globals.matches(this.#invocation.callee, "Request")
  }
}

class ConstructedReceivers {
  #argumentValues
  #globalName
  #globals
  #values = new WeakMap()

  constructor(values, globalName) {
    this.#argumentValues = values.argumentValues
    this.#globals = values.globals
    this.#globalName = globalName
  }

  includes(node) {
    return Boolean(node) && (this.#values.has(node) ? this.#values.get(node) : this.#isUncachedValueFor(node))
  }

  #isUncachedValueFor(node) {
    this.#values.set(node, this.#isBaseValueFor(node))
    return this.#values.get(node)
  }

  #isBaseValueFor(node) {
    return this.#argumentValues.valuesOf(node)
      .some((value) => isGlobalConstruction(value, this.#globals, this.#globalName))
  }
}

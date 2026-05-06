import { ObjectReferenceUse } from "#helpers/objects/object_reference_use"
import { StandardPropertyWrites } from "#helpers/objects/standard_property_writes"
import { enclosingFunction } from "#helpers/syntax/functions"
import { resolvedPublicMemberNameOf } from "#helpers/classes/resolved_member_key"
import { isHeaderCollectionMethod, isXhrHeaderMethod } from "#helpers/http/header_methods"

export class HeaderParameterReferenceUse {
  #aliasInitializers
  #argument
  #isSafeSpread
  #owner
  #reference
  #rootByVariable

  static receivingParameterAt(identifier, options) {
    return new HeaderArgumentUse(identifier, options).receivingParameter
  }

  constructor(parameter, reference,
    { aliasInitializers, bindings, callees, globals, isSafeSpread, owner, rootByVariable }) {
    this.#reference = reference
    this.#owner = owner
    this.#aliasInitializers = aliasInitializers
    this.#rootByVariable = rootByVariable
    this.#isSafeSpread = isSafeSpread
    this.#argument = new HeaderArgumentUse(reference.identifier, { bindings, callees, globals })
  }

  get isOutsideOwner() {
    return enclosingFunction(this.#identifier) !== this.#owner
  }

  get isSafe() {
    return this.#isDirectlySafe || Boolean(this.dependency) || this.#argument.isTerminalUse
  }

  get dependency() {
    return this.#rootByVariable.get(this.#argument.receivingParameter) ?? null
  }

  get #identifier() {
    return this.#reference.identifier
  }

  get #isDirectlySafe() {
    return this.#aliasInitializers.has(this.#identifier)
      || isWriteOnly(this.#reference) || this.#isSafeSpread
  }
}

class HeaderArgumentUse {
  #bindings
  #callees
  #globals
  #identifier

  constructor(identifier, { bindings, callees, globals = null }) {
    this.#identifier = identifier
    this.#bindings = bindings
    this.#callees = callees
    this.#globals = globals
  }

  get receivingParameter() {
    return this.#isTraceableLocalCall ? this.#localReceivingParameter : this.#headerWriteReceivingParameter
  }

  get isTerminalUse() {
    return new ObjectReferenceUse(this.#identifier, this.#bindings).hasTrackedWrite
      || this.#isEffectiveStandardWriteReceiver || this.#isHeaderConsumer || this.#isHeaderMethodReceiver
  }

  get #isTraceableLocalCall() {
    return Boolean(this.#invocation) && Boolean(this.#function)
      && !this.#function.async && !this.#function.generator && !this.#hasSpreadArgument
  }

  get #invocation() {
    const { parent } = this.#identifier
    return isInvocation(parent) && parent.arguments.includes(this.#identifier) ? parent : null
  }

  get #function() {
    return this.#callees.functionFor(this.#invocation.callee)
  }

  get #hasSpreadArgument() {
    return this.#invocation.arguments.some(isSpreadElement)
  }

  get #localReceivingParameter() {
    const parameter = this.#function.params[this.#position]
    return parameter?.type === "Identifier" ? this.#bindings.variableFor(parameter) : null
  }

  get #position() {
    return this.#invocation?.arguments.indexOf(this.#identifier) ?? -1
  }

  get #headerWriteReceivingParameter() {
    const target = this.#directHeaderWriteTarget ?? this.#standardHeaderWrite?.target
    return target?.type === "Identifier" ? this.#bindings.variableFor(target) : null
  }

  get #directHeaderWriteTarget() {
    const member = directlyAssignedMemberFor(this.#identifier)
    return member?.type === "MemberExpression"
      && resolvedPublicMemberNameOf(member, this.#bindings) === "headers"
      ? member.object
      : null
  }

  get #standardHeaderWrite() {
    return this.#standardWrites.find(({ name, value }) => name === "headers" && value === this.#identifier)
  }

  get #standardWrites() {
    return this.#invocation ? new StandardPropertyWrites(this.#invocation, this.#bindings).values : []
  }

  get #isEffectiveStandardWriteReceiver() {
    return this.#invocation
      ? new StandardPropertyWrites(this.#invocation, this.#bindings).hasEffectiveReceiver(this.#identifier)
      : false
  }

  get #isHeaderConsumer() {
    return this.#globals ? this.#isFetchConsumer || this.#isRequestConsumer || this.#isHeadersConsumer : false
  }

  get #isFetchConsumer() {
    return this.#position === 1 && this.#globals.matches(this.#invocation.callee, "fetch")
  }

  get #isRequestConsumer() {
    return this.#isConstruction && this.#position === 1 && this.#globals.matches(this.#invocation.callee, "Request")
  }

  get #isConstruction() {
    return this.#invocation?.type === "NewExpression"
  }

  get #isHeadersConsumer() {
    return this.#isConstruction && this.#position === 0 && this.#globals.matches(this.#invocation.callee, "Headers")
  }

  get #isHeaderMethodReceiver() {
    if (this.#isCalledMemberReceiver) {
      const name = resolvedPublicMemberNameOf(this.#member, this.#bindings)
      return isHeaderCollectionMethod(name) || isXhrHeaderMethod(name)
    } else {
      return false
    }
  }

  get #isCalledMemberReceiver() {
    return Boolean(this.#member) && this.#member.parent?.type === "CallExpression"
      && this.#member.parent.callee === this.#member
  }

  get #member() {
    const { parent } = this.#identifier
    return parent?.type === "MemberExpression" && parent.object === this.#identifier ? parent : null
  }
}

function isInvocation(node) {
  return node?.type === "CallExpression" || node?.type === "NewExpression"
}

function isSpreadElement(node) {
  return node.type === "SpreadElement"
}

function directlyAssignedMemberFor(identifier) {
  const assignment = identifier.parent
  if (assignment?.type !== "AssignmentExpression") return null
  if (assignment.operator !== "=") return null
  return assignment.right === identifier ? assignment.left : null
}

function isWriteOnly(reference) {
  return reference.isWrite() && !reference.isRead()
}

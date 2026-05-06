// Reading the CSRF token from the `<meta>` tag, or setting it on an `X-CSRF-Token` request header, reimplements what
// Rails already wires into native forms. Use a form (`button_to`, `form_with`), or `@rails/request.js` when a manual
// fetch is unavoidable; it injects the token for you.

import { asciiLowercaseOf } from "#helpers/strings/ascii"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { resolvedPublicMemberNameOf } from "#helpers/classes/resolved_member_key"
import { CssMetaSelector } from "#helpers/css/css_meta_selector"
import { HeaderEvidence } from "#helpers/http/header_evidence"
import { isHeaderCollectionMethod, isXhrHeaderMethod } from "#helpers/http/header_methods"
import { staticStringValueOf } from "#helpers/syntax/literals"
import { memberWriteOperationOf } from "#helpers/classes/member_write_targets"
import { reportProblem } from "#helpers/eslint/report"
import { GlobalValueIdentity } from "#helpers/scope/global_value_identity"

const CSRF_HEADERS = new Set([ "x-csrf-token", "x-xsrf-token" ])
const SELECTOR_METHODS = new Set([ "querySelector", "querySelectorAll" ])

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow reading the CSRF token from the meta tag or an X-CSRF-Token header" },
    schema: [],
    messages: {
      metaTag: "Don't read the CSRF token from the `<meta>` tag; use a native form or `@rails/request.js`.",
      header: "Don't set the CSRF token on an `{{name}}` header; use a native form or `@rails/request.js`."
    }
  },
  create(context) {
    const environment = new CsrfEnvironment(context.sourceCode)
    function inspect(node) {
      reportProblem(context, new CsrfTokenAccess(node, environment))
    }
    return {
      CallExpression: (node) => inspect(node.arguments[0]),
      Property: (node) => inspect(node.key),
      ArrayExpression: (node) => inspect(node.elements[0]),
      MemberExpression: (node) => inspect(node.property)
    }
  }
}

class CsrfEnvironment {
  #bindings
  #headers
  #identity
  #sourceCode

  constructor(sourceCode) {
    this.#bindings = new BindingResolver(sourceCode)
    this.#identity = new GlobalValueIdentity(this.#bindings)
    this.#sourceCode = sourceCode
  }

  stringValueOf(node) {
    return new ResolvedString(node, this.#bindings).value
  }

  includesHeaderInitializer(node) {
    return this.#headerEvidence.includesInitializer(node)
  }

  includesHeaderObject(node) {
    return this.#headerEvidence.includesObjectInitializerFor(node)
  }

  includesHeaderReceiver(node) {
    return this.#headerEvidence.includesHeadersReceiver(node)
  }

  includesXhrReceiver(node) {
    return this.#headerEvidence.includesXhrReceiver(node)
  }

  hasNativeMethodAt(callee, globalName) {
    const method = this.memberNameOf(callee)
    return this.#identity.isIntrinsicUnmodifiedAt(callee, globalName, [ "prototype" ])
      && this.#identity.isIntrinsicUnmodifiedAt(callee, globalName, [ "prototype", method ])
      && this.#headerEvidence.hasUnmodifiedReceiverMemberAt(callee.object, method, callee)
  }

  memberNameOf(node) {
    return resolvedPublicMemberNameOf(node, this.#bindings)
  }

  get #headerEvidence() {
    return this.#headers ??= new HeaderEvidence(this.#sourceCode, this.#bindings)
  }
}

class ResolvedString {
  #node
  #bindings

  constructor(node, bindings) {
    this.#node = node
    this.#bindings = bindings
  }

  get value() {
    return staticStringValueOf(this.#source)
  }

  get #source() {
    return this.#canFollowBinding ? this.#bindings.stableValueFor(this.#node) : this.#node
  }

  get #canFollowBinding() {
    return this.#node.type === "Identifier" && !this.#isStaticKey
  }

  get #isStaticKey() {
    const { parent } = this.#node
    return (parent.type === "Property" || parent.type === "MemberExpression") && !parent.computed
  }
}

class CsrfTokenAccess {
  #node
  #environment
  #cachedValue

  constructor(node, environment) {
    this.#node = node
    this.#environment = environment
  }

  get problem() {
    return this.#node ? this.#metaTagProblem ?? this.#headerProblem : null
  }

  get #metaTagProblem() {
    return this.#isSelectorArgument && new CssMetaSelector(this.#value).hasCsrfName
      ? { node: this.#node, messageId: "metaTag" }
      : null
  }

  get #isSelectorArgument() {
    const call = this.#argumentCall
    return Boolean(call) && call.arguments[0] === this.#node && call.callee.type === "MemberExpression"
      && SELECTOR_METHODS.has(this.#environment.memberNameOf(call.callee))
  }

  get #argumentCall() {
    return this.#node.parent?.type === "CallExpression" ? this.#node.parent : null
  }

  get #value() {
    return this.#cachedValue ??= this.#environment.stringValueOf(this.#node) ?? ""
  }

  get #headerProblem() {
    return this.#isCsrfHeader && this.#isHeaderName
      ? { node: this.#node, messageId: "header", data: { name: this.#value } }
      : null
  }

  get #isCsrfHeader() {
    return this.#value.length === "x-csrf-token".length && CSRF_HEADERS.has(asciiLowercaseOf(this.#value))
  }

  get #isHeaderName() {
    return new HeaderNameUse(this.#node, this.#environment).isPresent
  }
}

class HeaderNameUse {
  #node
  #environment

  constructor(node, environment) {
    this.#node = node
    this.#environment = environment
  }

  get isPresent() {
    return this.#isMethodArgument || this.#isObjectKey || this.#isEntryName || this.#isAssignedProperty
  }

  get #isMethodArgument() {
    return Boolean(this.#argumentCall)
      && this.#argumentCall.arguments[0] === this.#node
      && this.#argumentCall.callee.type === "MemberExpression"
      && this.#isHeaderMethod
  }

  get #argumentCall() {
    return this.#node.parent?.type === "CallExpression" ? this.#node.parent : null
  }

  get #isHeaderMethod() {
    const { callee } = this.#argumentCall
    const method = this.#environment.memberNameOf(callee)
    return (isXhrHeaderMethod(method) && this.#environment.includesXhrReceiver(callee.object)
      && this.#environment.hasNativeMethodAt(callee, "XMLHttpRequest"))
    || (isHeaderCollectionMethod(method) && this.#environment.includesHeaderReceiver(callee.object)
      && this.#environment.hasNativeMethodAt(callee, "Headers"))
  }

  get #isObjectKey() {
    const property = this.#node.parent
    return property?.type === "Property"
      && property.key === this.#node
      && property.parent.type === "ObjectExpression"
      && this.#environment.includesHeaderInitializer(property)
  }

  get #isEntryName() {
    return isHeaderEntryName(this.#node, this.#environment)
  }

  get #isAssignedProperty() {
    const member = this.#assignedMember
    return Boolean(member) && isWrittenMember(member)
      && this.#environment.includesHeaderObject(member.object)
  }

  get #assignedMember() {
    const member = this.#node.parent
    if (member?.type !== "MemberExpression" || !member.computed) return null

    return member.property === this.#node ? member : null
  }
}

function isHeaderEntryName(node, environment) {
  const entry = headerEntryFor(node)
  return Boolean(entry) && environment.includesHeaderInitializer(entry)
}

function headerEntryFor(node) {
  const entry = node.parent
  return isFirstEntryName(node, entry) && entry.parent?.type === "ArrayExpression"
    ? entry
    : null
}

function isFirstEntryName(node, entry) {
  return entry?.type === "ArrayExpression" && entry.elements[0] === node
}

function isWrittenMember(member) {
  const operation = memberWriteOperationOf(member)
  return Boolean(operation) && !(operation.type === "UnaryExpression" && operation.operator === "delete")
}

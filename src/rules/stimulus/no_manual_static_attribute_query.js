// Stimulus wires targets, values, classes, and outlets through `data-*` attributes it owns. Querying or mutating those
// attributes by hand bypasses the API and everything it provides (change callbacks, defaults, type coercion), so wiring
// lives in HTML and code goes through `this.fooTarget`, `this.fooValue`, `this.fooClass`, or `this.fooOutlet`; from
// another controller, reach in via an outlet. Matches the exact Stimulus attribute grammar, so single-word custom
// attributes such as `data-sort-value` pass.

import { asciiLowercaseOf } from "#helpers/strings/ascii"
import { resolvedPublicMemberNameOf } from "#helpers/classes/resolved_member_key"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { CssSelector } from "#helpers/css/css_selector"
import { sourceOfDestructuringPattern } from "#helpers/syntax/destructuring"
import { staticStringValueOf } from "#helpers/syntax/literals"
import { reportProblem } from "#helpers/eslint/report"

const SELECTOR_METHODS = new Set([ "querySelector", "querySelectorAll", "closest", "matches" ])
const ATTRIBUTE_METHODS = new Set([
  "getAttribute", "setAttribute", "hasAttribute", "removeAttribute", "toggleAttribute"
])
const NAME = "[a-z0-9]+(?:-[a-z0-9]+)*"
const IDENTIFIER = `${NAME}(?:--${NAME})*`
const TARGET_ATTRIBUTE = new RegExp(`^data-${IDENTIFIER}-target$`, "u")
const ATTRIBUTE_PREFIX = "data-"
const SCOPED_KINDS = [ "value", "class", "outlet" ]

const APIS = {
  target: { api: "targets", accessor: "this.fooTarget" },
  value: { api: "values", accessor: "this.fooValue" },
  class: { api: "classes", accessor: "this.fooClass" },
  outlet: { api: "outlets", accessor: "this.fooOutlet" }
}

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow querying Stimulus wiring attributes by hand" },
    schema: [],
    messages: {
      manualStaticQuery:
        "`{{attribute}}` is Stimulus wiring. Go through the {{api}} API (`{{accessor}}`) instead of the raw attribute."
    }
  },
  create(context) {
    const bindings = new BindingResolver(context.sourceCode)
    return {
      CallExpression: (node) => reportProblem(context, new AttributeQuery(node, bindings)),
      MemberExpression: (node) => reportProblem(context, new DatasetAccess(node, bindings)),
      Property: (node) => reportProblem(context, new DatasetDestructuring(node, bindings))
    }
  }
}

class AttributeQuery {
  #node
  #bindings

  constructor(node, bindings) {
    this.#node = node
    this.#bindings = bindings
  }

  get problem() {
    return this.#wiring?.problemAt(this.#node) ?? null
  }

  get #wiring() {
    const method = this.#method
    if (SELECTOR_METHODS.has(method)) {
      return WiringAttribute.firstAttributeIn(CssSelector.fromStaticPrefix(this.#node.arguments[0]))
    }

    const text = staticStringValueOf(this.#node.arguments[0])
    return typeof text === "string" && ATTRIBUTE_METHODS.has(method) ? WiringAttribute.fromAttribute(text) : null
  }

  get #method() {
    return resolvedPublicMemberNameOf(this.#node.callee, this.#bindings) ?? ""
  }
}

class WiringAttribute {
  #value
  #kind

  static firstAttributeIn(selector) {
    const attribute = selector?.attributeMatching(isWiringAttribute)
    return typeof attribute === "string" ? this.fromAttribute(attribute) : null
  }

  static fromAttribute(value) {
    return this.#from(value, attributeKindOf(value))
  }

  static fromDatasetKey(value) {
    return this.#from(value, datasetKindOf(value))
  }

  static #from(value, kind) {
    return kind ? new this(value, kind) : null
  }

  constructor(value, kind) {
    this.#value = value
    this.#kind = kind
  }

  problemAt(node) {
    return { node, messageId: "manualStaticQuery", data: { attribute: this.#value, ...APIS[this.#kind] } }
  }
}

function isWiringAttribute(attribute) {
  return attributeKindOf(attribute) !== null
}

function attributeKindOf(attribute) {
  const normalized = asciiLowercaseOf(attribute)
  return TARGET_ATTRIBUTE.test(normalized) ? "target" : new ScopedAttribute(normalized).kind
}

class ScopedAttribute {
  #text

  constructor(text) {
    this.#text = text
  }

  get kind() {
    const kind = SCOPED_KINDS.find((candidate) => this.#text.endsWith(`-${candidate}`))
    if (!kind || !this.#text.startsWith(ATTRIBUTE_PREFIX)) return null

    const stemEnd = this.#text.length - kind.length - 1
    return new ScopedAttributeStem(this.#text.slice(ATTRIBUTE_PREFIX.length, stemEnd), {
      allowsNameNamespaces: kind === "outlet"
    }).isValid
      ? kind
      : null
  }
}

class ScopedAttributeStem {
  #text
  #allowsNameNamespaces
  #cachedSeparator

  constructor(text, { allowsNameNamespaces }) {
    this.#text = text
    this.#allowsNameNamespaces = allowsNameNamespaces
  }

  get isValid() {
    if (this.#separator === -1) return false

    return new StimulusName(this.#identifier, { allowsNamespaces: true }).isValid
      && new StimulusName(this.#name, { allowsNamespaces: this.#allowsNameNamespaces }).isValid
  }

  get #separator() {
    return this.#cachedSeparator ??= this.#lastSingleHyphen
  }

  get #lastSingleHyphen() {
    for (let index = this.#text.length - 2; index > 0; index -= 1) {
      if (this.#isSingleHyphenAt(index)) return index
    }
    return -1
  }

  #isSingleHyphenAt(index) {
    return this.#text[index] === "-" && this.#hasSingleHyphenNeighborsAt(index)
  }

  #hasSingleHyphenNeighborsAt(index) {
    return this.#text[index - 1] !== "-" && this.#text[index + 1] !== "-"
  }

  get #identifier() {
    return this.#text.slice(0, this.#separator)
  }

  get #name() {
    return this.#text.slice(this.#separator + 1)
  }
}

class StimulusName {
  #text
  #maximumHyphenRun

  constructor(text, { allowsNamespaces = false } = {}) {
    this.#text = text
    this.#maximumHyphenRun = allowsNamespaces ? 2 : 1
  }

  get isValid() {
    return this.#hasValidEnds && new StimulusNameRun(this.#maximumHyphenRun).acceptsAll(this.#text)
  }

  get #hasValidEnds() {
    return new StimulusCharacter(this.#text[0]).isName && new StimulusCharacter(this.#text.at(-1)).isName
  }
}

class StimulusNameRun {
  #maximumHyphens
  #hyphens = 0

  constructor(maximumHyphens) {
    this.#maximumHyphens = maximumHyphens
  }

  acceptsAll(text) {
    const characters = text[Symbol.iterator]()
    let next = characters.next()
    while (!next.done && this.#accepts(next.value)) next = characters.next()
    return next.done
  }

  #accepts(character) {
    return character === "-" ? this.#acceptsHyphen : this.#acceptsNameCharacter(character)
  }

  get #acceptsHyphen() {
    this.#hyphens += 1
    return this.#hyphens <= this.#maximumHyphens
  }

  #acceptsNameCharacter(character) {
    this.#hyphens = 0
    return new StimulusCharacter(character).isName
  }
}

class StimulusCharacter {
  #value

  constructor(value) {
    this.#value = value
  }

  get isName() {
    return Boolean(this.#value) && this.#isLetterOrDigit
  }

  get #isLetterOrDigit() {
    return this.#isLowercaseLetter || this.#isDigit
  }

  get #isLowercaseLetter() {
    return this.#value >= "a" && this.#value <= "z"
  }

  get #isDigit() {
    return this.#value >= "0" && this.#value <= "9"
  }
}

function datasetKindOf(key) {
  if (new DatasetKey(key).hasNoninvertibleDash) return null

  const attribute = `data-${Array.from(key, datasetCharacterOf).join("")}`
  return attributeKindOf(attribute)
}

class DatasetKey {
  #value

  constructor(value) {
    this.#value = value
  }

  get hasNoninvertibleDash() {
    for (let index = 0; index < this.#value.length - 1; index += 1) {
      if (this.#value[index] === "-" && this.#isLowercaseAt(index + 1)) return true
    }
    return false
  }

  #isLowercaseAt(index) {
    const character = this.#value[index]
    return character >= "a" && character <= "z"
  }
}

function datasetCharacterOf(character) {
  return /[A-Z]/u.test(character) ? `-${character.toLowerCase()}` : character
}

class DatasetAccess {
  #node
  #bindings

  constructor(node, bindings) {
    this.#node = node
    this.#bindings = bindings
  }

  get problem() {
    return this.#isDatasetAccess ? WiringAttribute.fromDatasetKey(this.#key)?.problemAt(this.#node) ?? null : null
  }

  get #isDatasetAccess() {
    return this.#node.object.type === "MemberExpression"
      && resolvedPublicMemberNameOf(this.#node.object, this.#bindings) === "dataset"
  }

  get #key() {
    return resolvedPublicMemberNameOf(this.#node, this.#bindings) ?? ""
  }
}

class DatasetDestructuring {
  #node
  #bindings

  constructor(node, bindings) {
    this.#node = node
    this.#bindings = bindings
  }

  get problem() {
    return this.#isDatasetSource
      ? WiringAttribute.fromDatasetKey(this.#key)?.problemAt(this.#node) ?? null
      : null
  }

  get #isDatasetSource() {
    return this.#source?.type === "MemberExpression"
      && resolvedPublicMemberNameOf(this.#source, this.#bindings) === "dataset"
  }

  get #source() {
    const pattern = this.#node.parent
    return pattern?.type === "ObjectPattern" ? sourceOfDestructuringPattern(pattern) : null
  }

  get #key() {
    return resolvedPublicMemberNameOf(this.#node, this.#bindings) ?? ""
  }
}

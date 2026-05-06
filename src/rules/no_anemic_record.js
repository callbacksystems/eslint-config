// An object literal of three or more fields, built in one place and read from several others, is a concept with no
// behavior: every caller reaches past it to its fields (`member.node.value`) because it has no methods of its own.
// That is a data clump wearing braces, and the same refactor applies: give it a class, and the functions reading its
// fields become its methods.
//
// The distinction that matters is whether the record travels. One built and consumed on the spot (a report descriptor,
// a visitor object, an options argument) is a return value, not a concept; only a record whose fields are read from
// more than one function is reported.
//
// `no-data-clump` sees the same smell spelled as parameter lists. Bagging a clump into an object silences that rule
// without changing anything, so this one closes the gap: both spellings report, and the only way out is the class.

import { nodesIn } from "#helpers/ast"
import { enclosingFunction } from "#helpers/functions"
import { reportProblems } from "#helpers/report"
import { alphabetically } from "#helpers/sorting"

// A record kept in a field travels as surely as one returned or bound to a local.
const TRAVELING_PARENT_TYPES = new Set([
  "ArrowFunctionExpression", "AssignmentExpression", "PropertyDefinition", "ReturnStatement", "VariableDeclarator"
])

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Detect an object literal of several fields read across functions; prefer a class" },
    schema: [ {
      type: "object",
      properties: { minFields: { type: "integer", minimum: 2 }, minReaders: { type: "integer", minimum: 2 } },
      additionalProperties: false
    } ],
    defaultOptions: [ { minFields: 3, minReaders: 2 } ],
    messages: {
      anemicRecord: "This record carries [{{fields}}] and no behavior, and {{count}} functions reach into its "
        + "fields. That is one concept: give it a class and let those become its methods."
    }
  },
  create(context) {
    return { "Program:exit": () => reportProblems(context, new ModuleRecords(context.sourceCode, context.options[0])) }
  }
}

class ModuleRecords {
  #sourceCode
  #limits
  #cachedNodes
  #cachedReads

  constructor(sourceCode, limits) {
    this.#sourceCode = sourceCode
    this.#limits = limits
  }

  get problems() {
    return this.#records.flatMap((record) => record.problems)
  }

  get #records() {
    return this.#claimed(this.#candidates)
  }

  // Best match first, so a narrow record keeps its own reads instead of being swallowed by a wider one.
  #claimed(records) {
    records.forEach((record) => record.claim(this.#reads.ownedBy(record, records)))
    return records
  }

  get #reads() {
    return this.#cachedReads ??= new Reads(this.#nodes)
  }

  get #nodes() {
    return this.#cachedNodes ??= Array.from(nodesIn(this.#sourceCode.ast))
  }

  get #candidates() {
    return this.#nodes
      .filter((node) => node.type === "ObjectExpression")
      .map((node) => new Record(node, this.#limits))
  }
}

class Reads {
  #nodes
  #cachedAll

  constructor(nodes) {
    this.#nodes = nodes
  }

  ownedBy(record, records) {
    return this.#all.filter((read) => this.#bestMatchFor(read.base, records) === record)
  }

  get #all() {
    return this.#cachedAll ??= this.#nodes.flatMap((node) => new Reach(node).reads)
  }

  #bestMatchFor(base, records) {
    const reached = this.#fieldsReachedOn(base)
    const ranked = records
      .map((record) => ({ record, match: record.matchFor(reached) }))
      .filter((entry) => entry.match.shared >= 2)
      .sort((first, second) => second.match.shared - first.match.shared || second.match.fit - first.match.fit)

    return ranked.length > 0 ? ranked[0].record : null
  }

  #fieldsReachedOn(base) {
    return new Set(this.#all.filter((read) => read.isOn(base)).map((read) => read.field))
  }
}

class Reach {
  #node

  constructor(node) {
    this.#node = node
  }

  get reads() {
    if (this.#isStaticMemberRead) return [ new Read(this.#base, this.#node.property.name, this.#node) ]
    if (this.#isRecordPattern) return this.#destructuredReads

    return []
  }

  get #isStaticMemberRead() {
    return this.#node.type === "MemberExpression" && !this.#node.computed && Boolean(this.#base)
      && this.#node.property.type === "Identifier"
  }

  // A record held by the class is reached as `this.#options.width`, so the member holding it is its name. That name is
  // unique within the class, which is as far as this rule looks.
  get #base() {
    return this.#node.type === "MemberExpression" ? baseNameOf(this.#node.object) : null
  }

  get #isRecordPattern() {
    return this.#node.type === "VariableDeclarator"
      && this.#node.id.type === "ObjectPattern"
      && this.#node.init?.type === "Identifier"
  }

  get #destructuredReads() {
    return this.#node.id.properties
      .filter(isNamedProperty)
      .map((property) => new Read(this.#node.init.name, property.key.name, this.#node))
  }
}

class Read {
  #base
  #field
  #node

  constructor(base, field, node) {
    this.#base = base
    this.#field = field
    this.#node = node
  }

  isOn(base) {
    return this.#base === base
  }

  isFor(fields) {
    return fields.has(this.#field)
  }

  isInside(node) {
    return this.#node.range[0] >= node.range[0] && this.#node.range[1] <= node.range[1]
  }

  get field() {
    return this.#field
  }

  get base() {
    return this.#base
  }

  get reader() {
    return enclosingFunction(this.#node) ?? this.#node
  }
}

function baseNameOf(node) {
  if (node.type === "Identifier") return node.name

  return isOwnMember(node) ? memberNameOf(node) : null
}

function isOwnMember(node) {
  return node.type === "MemberExpression" && node.object.type === "ThisExpression" && !node.computed
}

function memberNameOf(node) {
  return node.property.type === "PrivateIdentifier" ? `#${node.property.name}` : node.property.name
}

function isNamedProperty(property) {
  return property.type === "Property" && !property.computed && property.key.type === "Identifier"
}

class Record {
  #node
  #limits
  #reads = []

  constructor(node, limits) {
    this.#node = node
    this.#limits = limits
  }

  claim(reads) {
    this.#reads = reads
  }

  // One shared field is a coincidence of vocabulary rather than the same object, so the caller requires two.
  matchFor(reached) {
    const shared = overlapOf(reached, this.#fields)
    return { shared, fit: shared / this.#fields.length }
  }

  get problems() {
    return this.#isAnemic
      ? [ { node: this.#node, messageId: "anemicRecord", data: this.#data } ]
      : []
  }

  get #fields() {
    return this.#node.properties.filter(isDataProperty).map((property) => property.key.name)
  }

  get #isAnemic() {
    return this.#isPlainRecord && this.#isKept && this.#readerCount >= this.#limits.minReaders
  }

  // Methods and getters make it an object already; a spread means the shape is not this literal's to own.
  get #isPlainRecord() {
    return this.#fields.length >= this.#limits.minFields
      && this.#node.properties.every(isDataProperty)
  }

  get #isKept() {
    return TRAVELING_PARENT_TYPES.has(this.#node.parent.type)
  }

  // Scattering is the symptom, so each consumer counts once however many fields it reaches for.
  get #readerCount() {
    return new Set(this.#fieldReads.map((read) => read.reader)).size
  }

  get #fieldReads() {
    const fields = new Set(this.#fields)
    return this.#reads.filter((read) => read.isFor(fields) && !read.isInside(this.#node))
  }

  get #data() {
    return { fields: this.#fields.sort(alphabetically).join(", "), count: this.#readerCount }
  }
}

function overlapOf(reached, fields) {
  return fields.filter((field) => reached.has(field)).length
}

function isDataProperty(property) {
  return property.type === "Property"
    && !property.computed
    && property.key.type === "Identifier"
    && property.kind === "init"
    && property.value.type !== "FunctionExpression"
    && property.value.type !== "ArrowFunctionExpression"
}

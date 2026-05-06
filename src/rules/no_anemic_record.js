// An object literal of three or more fields, built in one place and read from several others, is a concept with no
// behavior: every caller reaches past it to its fields (`member.node.value`) because it has no methods of its own.
// That is a data clump wearing braces, and the same refactor applies: give it a class, and the functions reading its
// fields become its methods.
//
// The distinction that matters is whether the record travels. One built and consumed on the spot (a report descriptor,
// a visitor object, an options argument) is a return value, not a concept; only a record whose fields are read from
// more than one function is reported.
//
// A read counts for a record only when it reaches the record where it lives: the variable, class field or function
// holding it (`settings.width`, `this.#options.width`, `settings().width`), or a local assigned from a call to that
// function. A parameter that happens to share field names with the record proves nothing, so its reads are dropped.
//
// A literal returned from `toJSON` (or `serialize`, `toObject`) is the wire format of an object that already exists,
// not a concept of its own, so it is never a candidate.
//
// `no-data-clump` sees the same smell spelled as parameter lists. Bagging a clump into an object silences that rule
// without changing anything, so this one closes the gap: both spellings report, and the only way out is the class.

import { nodesIn } from "#helpers/ast"
import { enclosingFunction } from "#helpers/functions"
import { reportProblems } from "#helpers/report"
import { alphabetically } from "#helpers/sorting"

const MODULE_READER = Symbol("module")
const RETURNING_PARENT_TYPES = new Set([ "ArrowFunctionExpression", "ReturnStatement" ])
const HOLDER_NAME_NODES = {
  FunctionDeclaration: (holder) => holder.id,
  VariableDeclarator: (holder) => holder.id,
  AssignmentExpression: (holder) => holder.left,
  MethodDefinition: (holder) => holder.key,
  PropertyDefinition: (holder) => holder.key
}
const SERIALIZATION_NAMES = new Set([ "toJSON", "serialize", "toObject" ])

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
  #cachedAliases

  constructor(nodes) {
    this.#nodes = nodes
  }

  ownedBy(record, records) {
    return this.#all.filter((read) => this.#bestMatchFor(read, records) === record)
  }

  get #all() {
    return this.#cachedAll ??= this.#nodes.flatMap((node) => new Reach(node).reads)
  }

  // Each branch of a function can return its own literal, so within one home the read goes to the best fit.
  #bestMatchFor(read, records) {
    const reached = this.#fieldsReachedOn(read.base)
    const ranked = records
      .filter((record) => record.livesIn(this.#homesOf(read)))
      .map((record) => ({ record, match: record.matchFor(reached) }))
      .filter((entry) => entry.match.shared > 0)
      .sort((first, second) => second.match.shared - first.match.shared || second.match.fit - first.match.fit)

    return ranked.length > 0 ? ranked[0].record : null
  }

  #fieldsReachedOn(base) {
    return new Set(this.#all.filter((read) => read.isOn(base)).map((read) => read.field))
  }

  #homesOf(read) {
    return new Set([ read.base, ...this.#aliasSourcesOf(read) ])
  }

  #aliasSourcesOf(read) {
    return this.#aliases.filter((alias) => alias.isBaseOf(read)).map((alias) => alias.source)
  }

  get #aliases() {
    return this.#cachedAliases ??= this.#nodes.filter(isCallAlias).map((node) => new Alias(node))
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

  // A record held by the class is reached as `this.#options.width`, so the member holding it is its name.
  get #base() {
    return baseNameOf(this.#node.object)
  }

  get #isRecordPattern() {
    return this.#node.type === "VariableDeclarator"
      && this.#node.id.type === "ObjectPattern"
      && Boolean(this.#patternBase)
  }

  get #patternBase() {
    return this.#node.init ? baseNameOf(this.#node.init) : null
  }

  get #destructuredReads() {
    return this.#node.id.properties
      .filter(isNamedProperty)
      .map((property) => new Read(this.#patternBase, property.key.name, this.#node))
  }
}

class Read {
  #node

  constructor(base, field, node) {
    this.base = base
    this.field = field
    this.#node = node
  }

  isOn(base) {
    return this.base === base
  }

  isFor(fields) {
    return fields.has(this.field)
  }

  isInside(node) {
    return this.#node.range[0] >= node.range[0] && this.#node.range[1] <= node.range[1]
  }

  // The module reading a record at its top level is one consumer, however many lines do the reading.
  get reader() {
    return this.scope ?? MODULE_READER
  }

  get scope() {
    return enclosingFunction(this.#node)
  }
}

function baseNameOf(node) {
  if (node.type === "Identifier") return node.name
  if (node.type === "PrivateIdentifier") return `#${node.name}`
  if (node.type === "CallExpression") return baseNameOf(node.callee)

  return isOwnMember(node) ? baseNameOf(node.property) : null
}

function isOwnMember(node) {
  return node.type === "MemberExpression" && node.object.type === "ThisExpression" && !node.computed
}

function isNamedProperty(property) {
  return property.type === "Property" && !property.computed && property.key.type === "Identifier"
}

function isCallAlias(node) {
  return node.type === "VariableDeclarator"
    && node.id.type === "Identifier"
    && node.init?.type === "CallExpression"
    && Boolean(baseNameOf(node.init))
}

// A local assigned from a call to a home, which reads of it reach within the function declaring it.
class Alias {
  #node

  constructor(node) {
    this.#node = node
  }

  get source() {
    return baseNameOf(this.#node.init)
  }

  isBaseOf(read) {
    return read.isOn(this.#node.id.name) && read.scope === enclosingFunction(this.#node)
  }
}

class Record {
  #node
  #limits
  #reads = []
  #cachedHome

  constructor(node, limits) {
    this.#node = node
    this.#limits = limits
  }

  claim(reads) {
    this.#reads = reads
  }

  livesIn(homes) {
    return this.#home !== null && homes.has(this.#home)
  }

  matchFor(reached) {
    const shared = overlapOf(reached, this.#fields)
    return { shared, fit: shared / this.#fields.length }
  }

  get problems() {
    return this.#isAnemic
      ? [ { node: this.#node, messageId: "anemicRecord", data: this.#data } ]
      : []
  }

  get #home() {
    return this.#cachedHome ??= new Home(this.#node).name
  }

  get #fields() {
    return this.#node.properties.filter(isDataProperty).map((property) => property.key.name)
  }

  get #isAnemic() {
    return this.#isPlainRecord && !this.#isSerialization && this.#readerCount >= this.#limits.minReaders
  }

  // Methods and getters make it an object already, and a spread means the shape is not this literal's to own.
  get #isPlainRecord() {
    return this.#fields.length >= this.#limits.minFields
      && this.#node.properties.every(isDataProperty)
  }

  get #isSerialization() {
    return SERIALIZATION_NAMES.has(this.#home)
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

// The name a record is reached by: the variable or field holding it, or the function returning it.
class Home {
  #node

  constructor(node) {
    this.#node = node
  }

  get name() {
    const nameNode = HOLDER_NAME_NODES[this.#holder.type]?.(this.#holder)
    return nameNode ? baseNameOf(nameNode) : null
  }

  get #holder() {
    return RETURNING_PARENT_TYPES.has(this.#node.parent.type) ? this.#returningFunctionHolder : this.#node.parent
  }

  get #returningFunctionHolder() {
    const functionNode = enclosingFunction(this.#node)
    return functionNode.type === "FunctionDeclaration" ? functionNode : functionNode.parent
  }
}

function isDataProperty(property) {
  return property.type === "Property"
    && !property.computed
    && property.key.type === "Identifier"
    && property.kind === "init"
    && property.value.type !== "FunctionExpression"
    && property.value.type !== "ArrowFunctionExpression"
}

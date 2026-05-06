// An object literal of three or more fields, built in one place and read from several others, is a concept with no
// behavior: every caller reaches past it to its fields (`member.node.value`) because it has no methods of its own.
// That is a data clump wearing braces, and the same refactor applies: give it a class, and the functions reading its
// fields become its methods.
//
// The distinction that matters is whether the record travels. One built and consumed on the spot (a report descriptor,
// a visitor object, an options argument) is a return value, not a concept; only a record whose fields are read from
// more than one function is reported.
//
// A read counts for a record only when it reaches the binding, class field, or function result where the record lives.
// Bindings are compared by eslint-scope identity, never by spelling, so a shadowed parameter cannot borrow another
// record's reads.
//
// A literal returned from `toJSON` (or `serialize`, `toObject`) is the wire format of an object that already exists,
// not a concept of its own, so it is never a candidate.
//
// `no-data-clump` sees the same smell spelled as parameter lists. Bagging a clump into an object silences that rule
// without changing anything, so this one closes the gap: both spellings report, and the only way out is the class.

import { nodesIn } from "#helpers/syntax/ast"
import { propertyNameOf } from "#helpers/syntax/classes"
import { sourceOfDestructuringPattern } from "#helpers/syntax/destructuring"
import { memberWriteOperationOf } from "#helpers/classes/member_write_targets"
import { contains } from "#helpers/syntax/ranges"
import { reportProblems } from "#helpers/eslint/report"
import { alphabetically } from "#helpers/syntax/sorting"
import { RecordHomes } from "#helpers/classes/record_homes"

const MODULE_READER = Symbol("module")
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
  #cachedRecords

  constructor(sourceCode, limits) {
    this.#sourceCode = sourceCode
    this.#limits = limits
  }

  get problems() {
    const homes = new RecordHomes(this.#sourceCode, this.#nodes)
    const records = this.#recordsFor(homes)
    new RecordClaims(records, new Reads(this.#nodes, homes, homes.aliasesIn(this.#nodes)).all).apply()
    return records.flatMap((record) => record.problems)
  }

  get #nodes() {
    return this.#cachedNodes ??= Array.from(nodesIn(this.#sourceCode.ast))
  }

  #recordsFor(homes) {
    return this.#cachedRecords ??= this.#nodes.filter((node) => node.type === "ObjectExpression")
      .map((node) => new Record(node, {
        limits: this.#limits,
        home: homes.homeFor(node),
        enclosingFunctionNode: homes.enclosingFunctionFor(node)
      }))
  }
}

class RecordClaims {
  #records
  #readsByHome

  constructor(records, reads) {
    this.#records = records
    this.#readsByHome = Map.groupBy(reads, (read) => read.home)
  }

  apply() {
    Map.groupBy(this.#records.filter((record) => record.hasHome), (record) => record.home)
      .forEach((records, home) => new BestRecord(records, this.#readsByHome.get(home) ?? []).claim())
  }
}

class BestRecord {
  #records
  #reads

  constructor(records, reads) {
    this.#records = records
    this.#reads = reads
  }

  claim() {
    this.#one?.claim(this.#reads)
  }

  get #one() {
    const reached = new Set(this.#reads.map((read) => read.field))
    return this.#records.map((record) => ({ record, match: record.matchFor(reached) }))
      .filter(({ match }) => match.shared > 0)
      .sort((first, second) => second.match.shared - first.match.shared || second.match.fit - first.match.fit)
      .at(0)?.record ?? null
  }
}

class Reads {
  #nodes
  #homes
  #aliases

  constructor(nodes, homes, aliases) {
    this.#nodes = nodes
    this.#homes = homes
    this.#aliases = aliases
  }

  get all() {
    return this.#nodes.flatMap((node) => new Reach(node, this.#homes, this.#aliases).reads)
  }
}

class Reach {
  #node
  #homes
  #aliases
  #cachedHome

  constructor(node, homes, aliases) {
    this.#node = node
    this.#homes = homes
    this.#aliases = aliases
  }

  get reads() {
    if (this.#isStaticMemberRead) return [ this.#readOf(this.#fieldName) ]
    if (this.#isRecordPattern) return this.#destructuredReads
    return []
  }

  get #isStaticMemberRead() {
    return this.#node.type === "MemberExpression" && Boolean(this.#fieldName)
      && Boolean(this.#home) && !this.#isPlainWrite
  }

  get #fieldName() {
    return this.#node.type === "MemberExpression" ? propertyNameOf(this.#node) : ""
  }

  get #home() {
    return this.#cachedHome ??= this.#homeOf(this.#readBase)
  }

  #homeOf(node) {
    return this.#homes.valueFor(node, this.#aliases)
  }

  get #readBase() {
    return this.#recordPattern ? this.#patternSource : this.#node.object
  }

  get #recordPattern() {
    if (this.#node.type === "VariableDeclarator") return objectPatternOf(this.#node.id)
    if (this.#node.type === "AssignmentExpression") return objectPatternOf(this.#node.left)
    return null
  }

  get #patternSource() {
    return sourceOfDestructuringPattern(this.#recordPattern)
  }

  get #isPlainWrite() {
    const operation = memberWriteOperationOf(this.#node)
    return Boolean(operation) && !isReadWriteOperation(operation)
  }

  #readOf(field) {
    return new Read({
      field,
      home: this.#home,
      node: this.#node,
      reader: this.#homes.enclosingFunctionFor(this.#node) ?? MODULE_READER
    })
  }

  get #isRecordPattern() {
    return Boolean(this.#recordPattern) && Boolean(this.#home)
  }

  get #destructuredReads() {
    return this.#recordPattern.properties.filter(isNamedProperty)
      .map((property) => this.#readOf(propertyNameOf(property)))
  }
}

function objectPatternOf(node) {
  return node.type === "ObjectPattern" ? node : null
}

function isReadWriteOperation(operation) {
  return operation.type === "UpdateExpression"
    || (operation.type === "AssignmentExpression" && operation.operator !== "=")
}

class Read {
  #node

  constructor({ home, field, node, reader }) {
    this.home = home
    this.field = field
    this.reader = reader
    this.#node = node
  }

  isFor(fields) {
    return fields.has(this.field)
  }

  isInside(node) {
    return contains(node, this.#node)
  }
}

function isNamedProperty(property) {
  return property.type === "Property" && Boolean(propertyNameOf(property))
}

class Record {
  #node
  #limits
  #reads = []
  #cachedFields
  #enclosingFunction

  constructor(node, { limits, home, enclosingFunctionNode }) {
    this.#node = node
    this.#limits = limits
    this.home = home
    this.#enclosingFunction = enclosingFunctionNode
  }

  claim(reads) {
    this.#reads = reads
  }

  matchFor(reached) {
    const shared = this.#fields.filter((field) => reached.has(field)).length
    return { shared, fit: shared / this.#fields.length }
  }

  get problems() {
    return this.#isAnemic ? [ { node: this.#node, messageId: "anemicRecord", data: this.#data } ] : []
  }

  get hasHome() {
    return Boolean(this.home)
  }

  get #fields() {
    return this.#cachedFields ??= [ ...new Set(this.#properties.filter(isDataProperty).map(propertyNameOf)) ]
  }

  get #properties() {
    return this.#node.properties.filter((property) => !isPrototypeSetter(property))
  }

  get #isAnemic() {
    return this.#isPlainRecord && !this.#isSerialization && this.#readerCount >= this.#limits.minReaders
  }

  get #isPlainRecord() {
    return this.#fields.length >= this.#limits.minFields && this.#properties.every(isDataProperty)
  }

  get #isSerialization() {
    return SERIALIZATION_NAMES.has(new RecordHomeName(this.#node, this.#enclosingFunction).value)
  }

  get #readerCount() {
    return new Set(this.#fieldReads.map((read) => read.reader)).size
  }

  get #fieldReads() {
    const fields = new Set(this.#fields)
    return this.#reads.filter((read) => read.isFor(fields) && !read.isInside(this.#node))
  }

  get #data() {
    return { fields: [ ...this.#fields ].sort(alphabetically).join(", "), count: this.#readerCount }
  }
}

function isDataProperty(property) {
  return property.type === "Property"
    && Boolean(propertyNameOf(property))
    && property.kind === "init"
    && property.value.type !== "FunctionExpression"
    && property.value.type !== "ArrowFunctionExpression"
}

function isPrototypeSetter(property) {
  return [
    property.type === "Property",
    property.kind === "init",
    !property.method && !property.computed,
    !property.shorthand && propertyNameOf(property) === "__proto__"
  ].every(Boolean)
}

class RecordHomeName {
  #record
  #enclosingFunction

  constructor(record, enclosingFunctionNode) {
    this.#record = record
    this.#enclosingFunction = enclosingFunctionNode
  }

  get value() {
    return this.#functionNode ? new CallableName(this.#functionNode).value : ""
  }

  get #functionNode() {
    const { parent } = this.#record
    if (parent.type === "ReturnStatement") return this.#enclosingFunction
    return parent.type === "ArrowFunctionExpression" && parent.body === this.#record ? parent : null
  }
}

class CallableName {
  #functionNode

  constructor(functionNode) {
    this.#functionNode = functionNode
  }

  get value() {
    return this.#functionNode.id?.name ?? this.#holderName
  }

  get #holderName() {
    return new HolderName(this.#functionNode.parent).value
  }
}

class HolderName {
  #node

  constructor(node) {
    this.#node = node
  }

  get value() {
    if (this.#node.type === "VariableDeclarator") return this.#identifierName
    if (this.#node.type === "AssignmentExpression") return this.#assignedName
    return this.#isMemberHolder ? this.#memberName : ""
  }

  get #identifierName() {
    return this.#node.id.type === "Identifier" ? this.#node.id.name : ""
  }

  get #assignedName() {
    return propertyNameOf(this.#node.left)
  }

  get #isMemberHolder() {
    return [ "MethodDefinition", "PropertyDefinition", "Property" ].includes(this.#node.type)
  }

  get #memberName() {
    return propertyNameOf(this.#node)
  }
}

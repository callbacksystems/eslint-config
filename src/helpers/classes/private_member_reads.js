import { childNodesOf, pushReversed } from "#helpers/syntax/ast"
import { isClassNode, privateNamesIn } from "#helpers/syntax/classes"

const COUNTS_BY_ROOT = new WeakMap()

export class PrivateMemberReads {
  #counts

  constructor(root) {
    const cached = COUNTS_BY_ROOT.get(root)
    this.#counts = cached ?? new WeakMap()
    if (!cached) {
      new PrivateReadIndexer(root, this).index()
      COUNTS_BY_ROOT.set(root, this.#counts)
    }
  }

  countOf(classNode, name) {
    return this.#counts.get(classNode)?.get(name) ?? 0
  }

  add(classNode, name) {
    if (classNode) {
      if (!this.#counts.has(classNode)) this.#counts.set(classNode, new Map())
      const counts = this.#counts.get(classNode)
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  }
}

class PrivateReadIndexer {
  #classes = new LexicalPrivateClasses()
  #pending
  #reads

  constructor(root, reads) {
    this.#reads = reads
    this.#pending = [ { node: root, isLeaving: false } ]
  }

  index() {
    while (this.#pending.length > 0) this.#indexNext()
  }

  #indexNext() {
    const visit = this.#pending.pop()
    if (visit.isLeaving) this.#classes.leave()
    else this.#enter(visit.node)
  }

  #enter(node) {
    if (isClassNode(node)) this.#enterClass(node)
    this.#record(node)
    pushReversed(this.#pending, childNodesOf(node).map(childVisit))
  }

  #enterClass(classNode) {
    this.#classes.enter(classNode)
    this.#pending.push({ node: classNode, isLeaving: true })
  }

  #record(node) {
    const name = node.type === "MemberExpression" && node.property.type === "PrivateIdentifier"
      ? node.property.name
      : null
    if (name) this.#reads.add(this.#classes.declaring(name), name)
  }
}

class LexicalPrivateClasses {
  #entries = []
  #declarations = new Map()

  enter(classNode) {
    const entry = new PrivateClassEntry(classNode)
    this.#entries.push(entry)
    entry.names.forEach((name) => {
      this.#ownersOf(name).push(classNode)
    })
  }

  leave() {
    this.#entries.pop().names.forEach((name) => {
      this.#ownersOf(name).pop()
    })
  }

  declaring(name) {
    return this.#declarations.get(name)?.at(-1) ?? null
  }

  #ownersOf(name) {
    if (!this.#declarations.has(name)) this.#declarations.set(name, [])
    return this.#declarations.get(name)
  }
}

class PrivateClassEntry {
  #node

  constructor(node) {
    this.#node = node
  }

  get names() {
    return privateNamesIn(this.#node)
  }
}

function childVisit(node) {
  return { node, isLeaving: false }
}

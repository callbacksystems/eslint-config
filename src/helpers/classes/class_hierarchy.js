import { nodesIn } from "#helpers/syntax/ast"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { isClassNode } from "#helpers/syntax/classes"

export class ClassHierarchy {
  #ambiguity
  #children = new WeakMap()
  #classes
  #directlyAmbiguous = new WeakSet()
  #parents = new WeakMap()
  #ranges = new WeakMap()
  #positions = new WeakMap()
  #resolver

  constructor(sourceCode) {
    this.#resolver = new BindingResolver(sourceCode)
    this.#classes = nodesIn(sourceCode.ast).filter(isClassNode).toArray()
    this.#classes.forEach((classNode) => this.#children.set(classNode, []))
    this.#classes.forEach((classNode) => this.#connect(classNode))
    this.#ambiguity = new ClassAmbiguity(this.#parents, this.#directlyAmbiguous)
    new ClassOrdering(this).index(this.#classes)
  }

  isAmbiguous(classNode) {
    return this.#ambiguity.includes(classNode)
  }

  positionOf(classNode) {
    return this.#positions.get(classNode)
  }

  rangeOf(classNode) {
    return this.#ranges.get(classNode) ?? null
  }

  ancestorsOf(classNode) {
    return [ ...this.#ancestorsFrom(classNode) ]
  }

  childrenOf(classNode) {
    return this.#children.get(classNode) ?? []
  }

  parentOf(classNode) {
    return this.#parents.get(classNode) ?? null
  }

  setPosition(classNode, position) {
    this.#positions.set(classNode, position)
  }

  setRange(classNode, range) {
    this.#ranges.set(classNode, range)
  }

  #connect(classNode) {
    const superclass = this.#localSuperclassOf(classNode)
    if (superclass) {
      this.#parents.set(classNode, superclass)
      this.#children.get(superclass).push(classNode)
    } else if (classNode.superClass) {
      this.#directlyAmbiguous.add(classNode)
    }
  }

  #localSuperclassOf(classNode) {
    const { superClass } = classNode
    if (isClassNode(superClass)) return superClass
    return superClass?.type === "Identifier" ? this.#localClassFor(superClass) : null
  }

  #localClassFor(identifier) {
    return this.#resolver.classFor(identifier) ?? this.#declaredClassFor(identifier)
  }

  #declaredClassFor(identifier) {
    const variable = this.#resolver.variableFor(identifier)
    const definition = variable?.defs.length === 1 ? variable.defs[0] : null
    return definition?.type === "ClassName" && this.#resolver.isUnmodified(identifier)
      ? definition.node
      : null
  }

  *#ancestorsFrom(classNode) {
    const seen = new Set([ classNode ])
    for (let current = this.#parents.get(classNode); current; current = this.#parents.get(current)) {
      if (seen.has(current)) return

      seen.add(current)
      yield current
    }
  }
}

class ClassAmbiguity {
  #direct
  #parents
  #values = new WeakMap()

  constructor(parents, directlyAmbiguous) {
    this.#direct = directlyAmbiguous
    this.#parents = parents
  }

  includes(classNode) {
    return classNode ? this.#valueFor(classNode) : true
  }

  #valueFor(classNode) {
    if (!this.#values.has(classNode)) this.#resolve(classNode)
    return this.#values.get(classNode)
  }

  #resolve(classNode) {
    const walk = new AmbiguityWalk(classNode, {
      directlyAmbiguous: this.#direct,
      parents: this.#parents,
      values: this.#values
    })
    walk.path.forEach((member) => this.#values.set(member, walk.isAmbiguous))
    if (walk.ending) this.#values.set(walk.ending, walk.isAmbiguous)
  }
}

class AmbiguityWalk {
  path = []

  #current
  #direct
  #parents
  #seen = new Set()
  #values

  constructor(root, { directlyAmbiguous, parents, values }) {
    this.#current = root
    this.#direct = directlyAmbiguous
    this.#parents = parents
    this.#values = values
    while (this.#canAdvance) this.#advance()
  }

  get ending() {
    return this.#current
  }

  get isAmbiguous() {
    return this.#current ? this.#direct.has(this.#current) || this.#isSeenOrKnown : false
  }

  get #canAdvance() {
    return Boolean(this.#current) && !this.#hasEnding
  }

  get #hasEnding() {
    return this.#values.has(this.#current) || this.#isDirectOrSeen
  }

  get #isDirectOrSeen() {
    return this.#direct.has(this.#current) || this.#seen.has(this.#current)
  }

  #advance() {
    this.#seen.add(this.#current)
    this.path.push(this.#current)
    this.#current = this.#parents.get(this.#current)
  }

  get #isSeenOrKnown() {
    return this.#seen.has(this.#current) || Boolean(this.#values.get(this.#current))
  }
}

class ClassOrdering {
  #hierarchy
  #position = 0

  constructor(hierarchy) {
    this.#hierarchy = hierarchy
  }

  index(classes) {
    classes.filter((classNode) => !this.#hierarchy.parentOf(classNode) && !this.#hierarchy.isAmbiguous(classNode))
      .forEach((classNode) => this.#indexTree(classNode))
  }

  #indexTree(root) {
    const pending = [ { node: root, isExit: false } ]
    while (pending.length > 0) this.#indexNext(pending.pop(), pending)
  }

  #indexNext({ node, isExit }, pending) {
    if (isExit) {
      this.#hierarchy.setRange(node, { start: this.#hierarchy.positionOf(node), end: this.#position })
    } else {
      this.#hierarchy.setPosition(node, this.#position)
      this.#position += 1
      pending.push({ node, isExit: true })
      this.#hierarchy.childrenOf(node).toReversed().forEach((child) => {
        if (!this.#hierarchy.isAmbiguous(child)) pending.push({ node: child, isExit: false })
      })
    }
  }
}

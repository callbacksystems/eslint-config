import { isToolDirective } from "#helpers/source/comment_directives"
import { isWithin } from "#helpers/syntax/ranges"
import { RangedEvents } from "#helpers/syntax/ranged_events"

export class ForEachFixPlan {
  #loops
  #sourceCode

  constructor(loops, sourceCode) {
    this.#loops = loops
    this.#sourceCode = sourceCode
  }

  get problems() {
    const fixes = new FixGroups(this.#loops, this.#sourceCode).byRoot
    return this.#loops.filter((loop) => loop.isConvertible)
      .map((loop) => loop.problemWith(fixes.get(loop) ?? null))
  }
}

class FixGroups {
  #loops
  #sourceCode
  #roots = new WeakMap()
  #fixed = new WeakSet()
  #fixedAncestors = new WeakMap()
  #edits = new Map()
  #directives

  constructor(loops, sourceCode) {
    this.#loops = loops
    this.#sourceCode = sourceCode
    this.#directives = new ToolDirectives(sourceCode)
  }

  get byRoot() {
    this.#loops.toReversed().forEach((loop) => this.#add(loop))
    return new Map(Array.from(this.#edits, ([ root, edits ]) =>
      [ root, new LoopReplacement(root.node, edits, this.#sourceCode).fix ]))
  }

  #add(loop) {
    const placement = this.#placementFor(loop)
    this.#roots.set(loop.node, placement.root)
    this.#fixedAncestors.set(loop.node, placement.fixedAncestor)
    if (placement.canFix) this.#addFix(loop, placement.root)
  }

  #placementFor(loop) {
    return new FixPlacement(loop, {
      directives: this.#directives,
      fixedAncestor: this.#fixedAncestors.get(loop.parent) ?? null,
      inheritedRoot: this.#roots.get(loop.parent) ?? null,
      parentIsFixed: this.#fixed.has(loop.parent)
    })
  }

  #addFix(loop, root) {
    this.#fixed.add(loop.node)
    this.#editsFor(root).push(...loop.edits)
  }

  #editsFor(root) {
    if (!this.#edits.has(root)) this.#edits.set(root, [])
    return this.#edits.get(root)
  }
}

class ToolDirectives {
  #positions = new RangedEvents()

  constructor(sourceCode) {
    sourceCode.getAllComments().filter((comment) => isToolDirective(comment.value))
      .forEach((comment) => this.#positions.add(comment.range[0]))
  }

  hasInside(node) {
    return this.#positions.hasInside(node.range)
  }
}

class LoopReplacement {
  #node
  #edits
  #sourceCode
  #cachedOrderedEdits
  #cachedText

  constructor(node, edits, sourceCode) {
    this.#node = node
    this.#edits = edits
    this.#sourceCode = sourceCode
  }

  get fix() {
    return this.#hasDisjointEdits
      ? (fixer) => fixer.replaceTextRange(this.#node.range, this.#text)
      : null
  }

  get #hasDisjointEdits() {
    return this.#orderedEdits.every((edit, index, edits) =>
      index === 0 || edits[index - 1].range[1] <= edit.range[0])
  }

  get #orderedEdits() {
    return this.#cachedOrderedEdits ??= this.#edits.toSorted(byPosition)
  }

  get #text() {
    return this.#cachedText ??= this.#fragments.join("")
  }

  get #fragments() {
    const fragments = []
    let position = this.#node.range[0]

    for (const edit of this.#orderedEdits) {
      fragments.push(this.#sourceCode.text.slice(position, edit.range[0]), edit.text)
      position = edit.range[1]
    }
    return [ ...fragments, this.#sourceCode.text.slice(position, this.#node.range[1]) ]
  }
}

function byPosition(first, second) {
  return first.range[0] - second.range[0] || second.depth - first.depth
}

class FixPlacement {
  #loop
  #directives
  #inheritedFixedAncestor
  #inheritedRoot
  #parentIsFixed
  #cachedCanFix

  constructor(loop, { directives, fixedAncestor, inheritedRoot, parentIsFixed }) {
    this.#loop = loop
    this.#directives = directives
    this.#inheritedFixedAncestor = fixedAncestor
    this.#inheritedRoot = inheritedRoot
    this.#parentIsFixed = parentIsFixed
  }

  get root() {
    if (this.#canInherit) return this.#inheritedRoot
    return this.canFix ? this.#loop : null
  }

  get canFix() {
    return this.#cachedCanFix ??= this.#loop.canFixWith({ parentOpening: this.#canInherit && this.#parentIsFixed })
  }

  get fixedAncestor() {
    if (this.canFix) return this.#loop
    return this.#canInherit ? this.#inheritedFixedAncestor : null
  }

  get #canInherit() {
    return Boolean(this.#inheritedRoot)
      && !this.#directives.hasInside(this.#inheritedRoot.node)
      && !this.#isInsideFixedBinding
  }

  get #isInsideFixedBinding() {
    return Boolean(this.#inheritedFixedAncestor)
      && isWithin(this.#loop.node, this.#inheritedFixedAncestor.node.left.range)
  }
}

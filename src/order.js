import perfectionist from "eslint-plugin-perfectionist"
import { CLASS_GROUPS, ELEMENT_MEMBER_GROUPS } from "#constants/member_groups"
import { DEFAULT_FILES } from "#constants/files"
import { globsIn } from "#helpers/globs"
import callbacksystems from "#rules"

const BLOCK_NAME = "@callbacksystems/order/members"

// Both rules that order a class body get the same groups, or their fixers undo each other.
export function orderMembers({ files = DEFAULT_FILES, groups = [], after, before }) {
  const members = new MemberGroups(groups, { after, before })
  return [ {
    files,
    name: `${BLOCK_NAME} in ${globsIn(files)}`,
    plugins: { callbacksystems, perfectionist },
    rules: {
      "perfectionist/sort-classes": [ "error", {
        type: "unsorted",
        customGroups: members.customGroups,
        groups: members.classGroups
      } ],
      "callbacksystems/step-down-methods": [ "error", { nameGroups: members.patterns } ]
    }
  } ]
}

class MemberGroups {
  #declared
  #anchor
  #cache

  constructor(declared, anchor) {
    this.#declared = declared
    this.#anchor = new Anchor(anchor)
  }

  get customGroups() {
    return this.#all.map(({ name, pattern }) => ({ groupName: name, elementNamePattern: pattern }))
  }

  get classGroups() {
    return CLASS_GROUPS.flatMap((group) => (group === "constructor" ? [ group, ...this.#names ] : [ group ]))
  }

  get patterns() {
    return this.#all.map(({ pattern }) => pattern)
  }

  get #all() {
    return this.#cache ??= this.#inserted
  }

  get #inserted() {
    this.#verifyNames()
    return ELEMENT_MEMBER_GROUPS.toSpliced(this.#anchor.positionIn(ELEMENT_MEMBER_GROUPS), 0, ...this.#declared)
  }

  #verifyNames() {
    const taken = this.#declared.find(({ name }) => isPackaged(name))
    if (taken) {
      throw new Error(`orderMembers: \`${taken.name}\` is already a group. Pick another name, or place yours with `
        + "`after`/`before`.")
    }
  }

  get #names() {
    return this.#all.map(({ name }) => name)
  }
}

class Anchor {
  #after
  #before

  constructor({ after, before }) {
    this.#after = after
    this.#before = before
  }

  positionIn(groups) {
    this.#verifyChoice()
    return this.#name ? this.#anchoredPositionIn(groups) : groups.length
  }

  #verifyChoice() {
    if (this.#after && this.#before) throw new Error("orderMembers: pass `after` or `before`, not both.")
  }

  get #name() {
    return this.#after ?? this.#before
  }

  #anchoredPositionIn(groups) {
    this.#verifyAnchorIn(groups)
    return groups.findIndex((group) => group.name === this.#name) + (this.#after ? 1 : 0)
  }

  #verifyAnchorIn(groups) {
    if (groups.every((group) => group.name !== this.#name)) {
      throw new Error(`orderMembers: no group named \`${this.#name}\` to anchor to.`)
    }
  }
}

function isPackaged(name) {
  return ELEMENT_MEMBER_GROUPS.some((group) => group.name === name)
}

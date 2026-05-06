// Shared AST predicates used across the local rules.
//
// Terminology:
//   - "Function exit": `return` or `throw`. Leaves the surrounding function.
//   - "Loop control": `continue` or `break`. Stays inside the loop.
//   - "Guard clause": `if (condition) <exit>` with no `else` and a single-statement
//     consequent. By default we mean function-level guards (return/throw),
//     but `padding-after-guard-clause` also treats loop-control guards.
//   - "Validation guard": a guard whose return is "trivial" (bare, null,
//     undefined, false, 0, ""). These reject input. Other guards with
//     meaningful return values are dispatch branches, not validation.

export const FUNCTION_EXIT_TYPES = new Set([ "ReturnStatement", "ThrowStatement" ])
export const LOOP_CONTROL_TYPES = new Set([ "ContinueStatement", "BreakStatement" ])
export const ALL_EXIT_TYPES = new Set([ ...FUNCTION_EXIT_TYPES, ...LOOP_CONTROL_TYPES ])

export const isFunctionExit = (node) => Boolean(node) && FUNCTION_EXIT_TYPES.has(node.type)

export const isAnyExit = (node) => Boolean(node) && ALL_EXIT_TYPES.has(node.type)

export const isIfWithoutAlternate = (node) =>
  Boolean(node) && node.type === "IfStatement" && !node.alternate

export const isBareReturn = (node) =>
  Boolean(node) && node.type === "ReturnStatement" && !node.argument

export const isReturnWithValue = (node) =>
  Boolean(node) && node.type === "ReturnStatement" && Boolean(node.argument)

export const isSingleExitBlock = (block, isExit = isFunctionExit) =>
  block.type === "BlockStatement" && block.body.length === 1 && isExit(block.body[0])

export const isGuardClause = (node, isExit = isFunctionExit) =>
  isIfWithoutAlternate(node) && (isExit(node.consequent) || isSingleExitBlock(node.consequent, isExit))

const TRIVIAL_VALUES = new Set([ null, false, 0, "" ])

const isUndefinedIdentifier = (node) =>
  Boolean(node) && node.type === "Identifier" && node.name === "undefined"

const isTrivialLiteral = (node) =>
  Boolean(node) && node.type === "Literal" && TRIVIAL_VALUES.has(node.value)

export const isTrivialReturnValue = (argument) =>
  !argument || isUndefinedIdentifier(argument) || isTrivialLiteral(argument)

const innerExit = (consequent) =>
  consequent.type === "BlockStatement" ? consequent.body[0] : consequent

export const isValidationGuard = (node) => {
  if (!isGuardClause(node)) return false

  const inner = innerExit(node.consequent)
  return inner.type === "ReturnStatement" && isTrivialReturnValue(inner.argument)
}

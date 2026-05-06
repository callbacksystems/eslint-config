import { commentsIn } from "#helpers/source/source"

const DECLARATION_DIRECTIVE = /^(?:\/|<reference\b)/iu
const METADATA_PRAGMA = /^[#@]\s*(?:(?:end)?region\b|source(?:Mapping)?URL)/iu
const LANGUAGE_PRAGMA = /^@\s*(?:ts-\S+|(?:no)?flow\b|jsx\w*\b|preserve\b)/iu
const FILE_PRAGMA = /^@\s*(?:generated|format|prettier|providesModule)\b/iu
const TEST_ENVIRONMENT = /^@\s*(?:jest|vitest)-environment(?:-options)?(?:\s|$)/iu
const HYPHENATED_IGNORE = /^(?:prettier|biome|deno-(?:lint|fmt)|dprint)-ignore(?:-\S+)?\b/iu
const LINTER_CONTROL = /^(?:eslint|oxlint)-(?:disable|enable)(?:-\S+)?\b/iu
const LEGACY_ESLINT = /^(?:eslint-env|globals?|exported)(?:\s|$)/u
const COVERAGE_IGNORE = /^(?:c8|istanbul)\s+ignore\b/iu
const SPDX_LICENSE = /^SPDX-License-Identifier:\s*\S/u
const DENO_TYPES = /^@\s*deno-types(?:\s*=|\b)/iu
const FLOW_CONTROL = /^(?:flowlint(?:-(?:next-line|line))?|\$(?:FlowFixMe|FlowExpectedError))\b/iu
const LICENSE = /^@\s*license\b/iu
const OPTIMIZER_ANNOTATION = /^[#@]\s*__(?:PURE|NO_SIDE_EFFECTS|INLINE)__\b/iu

const TOOL_DIRECTIVES = [
  DECLARATION_DIRECTIVE,
  METADATA_PRAGMA,
  LANGUAGE_PRAGMA,
  FILE_PRAGMA,
  TEST_ENVIRONMENT,
  HYPHENATED_IGNORE,
  LINTER_CONTROL,
  LEGACY_ESLINT,
  COVERAGE_IGNORE,
  SPDX_LICENSE,
  DENO_TYPES,
  FLOW_CONTROL,
  LICENSE,
  OPTIMIZER_ANNOTATION
]
const FILE_DIRECTIVES = [
  DECLARATION_DIRECTIVE,
  /^@\s*(?:ts-(?:check|nocheck)|(?:no)?flow\b|jsx\w*\b|preserve\b)/iu,
  FILE_PRAGMA,
  TEST_ENVIRONMENT,
  LEGACY_ESLINT,
  /^eslint-disable(?:\s|$)/iu,
  /^(?:c8|istanbul)\s+ignore\s+file\b/iu,
  /^(?:deno-(?:lint|fmt)|dprint)-ignore-file\b/iu,
  SPDX_LICENSE
]
const NEXT_STATEMENT_DIRECTIVES = [
  /^(?:eslint|oxlint)-disable-next-line\b/iu,
  /^(?:c8|istanbul)\s+ignore\s+next\b/iu,
  HYPHENATED_IGNORE,
  /^@\s*ts-(?:ignore|expect-error)\b/iu,
  DENO_TYPES,
  /^flowlint-next-line\b/iu,
  /^\$(?:FlowFixMe|FlowExpectedError)\b/iu,
  OPTIMIZER_ANNOTATION
]

export function isToolDirective(commentText) {
  return linesIn(commentText).some((line) => matchesAny(TOOL_DIRECTIVES, line))
}

export function isFileDirective(commentText) {
  return linesIn(commentText).some((line) => matchesAny(FILE_DIRECTIVES, line))
}

export function isNextStatementDirective(commentText) {
  return linesIn(commentText).some((line) => matchesAny(NEXT_STATEMENT_DIRECTIVES, line))
}

export function hasAdjacentToolDirectiveBefore(sourceCode, node) {
  return sourceCode.getCommentsBefore(node)
    .some((comment) => comment.loc.end.line >= node.loc.start.line - 1 && isToolDirective(comment.value))
}

export function hasToolDirectiveIn({ sourceCode, node, range = node.range }) {
  return hasAdjacentToolDirectiveBefore(sourceCode, node)
    || commentsIn(sourceCode, range).some((comment) => isToolDirective(comment.value))
}

function linesIn(commentText) {
  return commentText.split(/\r\n|[\n\r\u{2028}\u{2029}]/u).map(withoutBlockMargin)
}

function withoutBlockMargin(line) {
  return line.replace(/^\s*\*?\s*/u, "").trimEnd()
}

function matchesAny(directives, line) {
  return directives.some((directive) => directive.test(line))
}

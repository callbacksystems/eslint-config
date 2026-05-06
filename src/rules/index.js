import compactGuardClause from "#rules/compact-guard-clause"
import compactObjectPattern from "#rules/compact-object-pattern"
import maxLogicalOperatorsPerCondition from "#rules/max-logical-operators-per-condition"
import maxValidationGuardsPerFunction from "#rules/max-validation-guards-per-function"
import noAliasImports from "#rules/no-alias-imports"
import noEmDash from "#rules/no-em-dash"
import noLoopAccumulator from "#rules/no-loop-accumulator"
import noMidFunctionReturns from "#rules/no-mid-function-returns"
import noParameterClump from "#rules/no-parameter-clump"
import noRedundantTrailingReturn from "#rules/no-redundant-trailing-return"
import noRelativeImports from "#rules/no-relative-imports"
import noSectionDividerComments from "#rules/no-section-divider-comments"
import paddingAfterGuardClause from "#rules/padding-after-guard-clause"
import preferPositiveWrap from "#rules/prefer-positive-wrap"
import preferTailCondition from "#rules/prefer-tail-condition"
import preferTernaryReturn from "#rules/prefer-ternary-return"

export default {
  rules: {
    "compact-guard-clause": compactGuardClause,
    "compact-object-pattern": compactObjectPattern,
    "max-logical-operators-per-condition": maxLogicalOperatorsPerCondition,
    "max-validation-guards-per-function": maxValidationGuardsPerFunction,
    "no-alias-imports": noAliasImports,
    "no-em-dash": noEmDash,
    "no-loop-accumulator": noLoopAccumulator,
    "no-mid-function-returns": noMidFunctionReturns,
    "no-parameter-clump": noParameterClump,
    "no-redundant-trailing-return": noRedundantTrailingReturn,
    "no-relative-imports": noRelativeImports,
    "no-section-divider-comments": noSectionDividerComments,
    "padding-after-guard-clause": paddingAfterGuardClause,
    "prefer-positive-wrap": preferPositiveWrap,
    "prefer-tail-condition": preferTailCondition,
    "prefer-ternary-return": preferTernaryReturn
  }
}

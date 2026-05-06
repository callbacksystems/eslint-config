import compactGuardClause from "#rules/compact-guard-clause"
import compactMultiLine from "#rules/compact-multi-line"
import helpersOnlyFunctions from "#rules/helpers-only-functions"
import maxLogicalOperatorsPerCondition from "#rules/max-logical-operators-per-condition"
import maxValidationGuardsPerFunction from "#rules/max-validation-guards-per-function"
import noAliasImports from "#rules/no-alias-imports"
import noBooleanHandlerChain from "#rules/no-boolean-handler-chain"
import noDeepOptionalChain from "#rules/no-deep-optional-chain"
import noExtraBindAfterArrowField from "#rules/no-extra-bind-after-arrow-field"
import noFlagArg from "#rules/no-flag-arg"
import noJsdoc from "#rules/no-jsdoc"
import noLoopAccumulator from "#rules/no-loop-accumulator"
import noMidFunctionReturns from "#rules/no-mid-function-returns"
import noMutableModuleScope from "#rules/no-mutable-module-scope"
import noPaddedBraces from "#rules/no-padded-braces"
import noParameterClump from "#rules/no-parameter-clump"
import noRedundantTrailingReturn from "#rules/no-redundant-trailing-return"
import noRelativeImports from "#rules/no-relative-imports"
import noSectionDividerComments from "#rules/no-section-divider-comments"
import noSentinelStrings from "#rules/no-sentinel-strings"
import noTypographicClutter from "#rules/no-typographic-clutter"
import noUnderscorePrivate from "#rules/no-underscore-private"
import paddingAfterGuardClause from "#rules/padding-after-guard-clause"
import preferArrowClassFieldForHandler from "#rules/prefer-arrow-class-field-for-handler"
import preferPositiveWrap from "#rules/prefer-positive-wrap"
import preferSwitchOverIfChain from "#rules/prefer-switch-over-if-chain"
import preferTailCondition from "#rules/prefer-tail-condition"
import preferTernaryReturn from "#rules/prefer-ternary-return"
import htmlElementSuffix from "#rules/browser/html-element-suffix"
import actionNaming from "#rules/stimulus/action-naming"
import controllerShape from "#rules/stimulus/controller-shape"
import staticConfigKeysCamelcase from "#rules/stimulus/static-config-keys-camelcase"
import maxConsecutiveFieldsetDefs from "#rules/react/max-consecutive-fieldset-defs"
import maxEffectsPerComponent from "#rules/react/max-effects-per-component"
import maxInternalHooksComposed from "#rules/react/max-internal-hooks-composed"
import noImperativeHandleForSingleMethod from "#rules/react/no-imperative-handle-for-single-method"
import noMagicClassname from "#rules/react/no-magic-classname"
import noSuffixHandlerTypes from "#rules/react/no-suffix-handler-types"
import noTrivialHook from "#rules/react/no-trivial-hook"

export default {
  rules: {
    // General activated by /base.
    "compact-guard-clause": compactGuardClause,
    "compact-multi-line": compactMultiLine,
    "helpers-only-functions": helpersOnlyFunctions,
    "max-logical-operators-per-condition": maxLogicalOperatorsPerCondition,
    "max-validation-guards-per-function": maxValidationGuardsPerFunction,
    "no-alias-imports": noAliasImports,
    "no-boolean-handler-chain": noBooleanHandlerChain,
    "no-deep-optional-chain": noDeepOptionalChain,
    "no-extra-bind-after-arrow-field": noExtraBindAfterArrowField,
    "no-flag-arg": noFlagArg,
    "no-jsdoc": noJsdoc,
    "no-loop-accumulator": noLoopAccumulator,
    "no-mid-function-returns": noMidFunctionReturns,
    "no-mutable-module-scope": noMutableModuleScope,
    "no-padded-braces": noPaddedBraces,
    "no-parameter-clump": noParameterClump,
    "no-redundant-trailing-return": noRedundantTrailingReturn,
    "no-relative-imports": noRelativeImports,
    "no-section-divider-comments": noSectionDividerComments,
    "no-sentinel-strings": noSentinelStrings,
    "no-typographic-clutter": noTypographicClutter,
    "no-underscore-private": noUnderscorePrivate,
    "padding-after-guard-clause": paddingAfterGuardClause,
    "prefer-arrow-class-field-for-handler": preferArrowClassFieldForHandler,
    "prefer-positive-wrap": preferPositiveWrap,
    "prefer-switch-over-if-chain": preferSwitchOverIfChain,
    "prefer-tail-condition": preferTailCondition,
    "prefer-ternary-return": preferTernaryReturn,

    // Browser activated by /browser.
    "browser/html-element-suffix": htmlElementSuffix,

    // Stimulus activated by /stimulus and /rails.
    "stimulus/action-naming": actionNaming,
    "stimulus/controller-shape": controllerShape,
    "stimulus/static-config-keys-camelcase": staticConfigKeysCamelcase,

    // React anti-drift activated by /react.
    "react/max-consecutive-fieldset-defs": maxConsecutiveFieldsetDefs,
    "react/max-effects-per-component": maxEffectsPerComponent,
    "react/max-internal-hooks-composed": maxInternalHooksComposed,
    "react/no-imperative-handle-for-single-method": noImperativeHandleForSingleMethod,
    "react/no-magic-classname": noMagicClassname,
    "react/no-suffix-handler-types": noSuffixHandlerTypes,
    "react/no-trivial-hook": noTrivialHook
  }
}

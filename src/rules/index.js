import booleanNaming from "#rules/boolean-naming"
import collapseMultiLine from "#rules/collapse-multi-line"
import compactGuardClause from "#rules/compact-guard-clause"
import constantNaming from "#rules/constant-naming"
import declarativeMethodNaming from "#rules/declarative-method-naming"
import inlineMemoizedComputation from "#rules/inline-memoized-computation"
import maxBareReturns from "#rules/max-bare-returns"
import maxExportedClasses from "#rules/max-exported-classes"
import maxFieldAssignments from "#rules/max-field-assignments"
import maxLocalVariables from "#rules/max-local-variables"
import maxLogicalOperatorsPerCondition from "#rules/max-logical-operators-per-condition"
import maxOptionalChainDepth from "#rules/max-optional-chain-depth"
import maxValidationGuardsPerFunction from "#rules/max-validation-guards-per-function"
import noAnemicDelegation from "#rules/no-anemic-delegation"
import noBooleanHandlerChain from "#rules/no-boolean-handler-chain"
import noDataClump from "#rules/no-data-clump"
import noHandlerPrefix from "#rules/no-handler-prefix"
import noJsdoc from "#rules/no-jsdoc"
import noLocalVariableReturn from "#rules/no-local-variable-return"
import noManualAccumulation from "#rules/no-manual-accumulation"
import noMethodNamedCall from "#rules/no-method-named-call"
import noMidFunctionReturns from "#rules/no-mid-function-returns"
import noMixedMemoization from "#rules/no-mixed-memoization"
import noMutableModuleScope from "#rules/no-mutable-module-scope"
import noPaddedBraces from "#rules/no-padded-braces"
import noRedundantBindAfterArrow from "#rules/no-redundant-bind-after-arrow"
import noRedundantTrailingReturn from "#rules/no-redundant-trailing-return"
import noRedundantWrapperMethod from "#rules/no-redundant-wrapper-method"
import noRelativeImports from "#rules/no-relative-imports"
import noSectionDividerComments from "#rules/no-section-divider-comments"
import noTypographicClutter from "#rules/no-typographic-clutter"
import noUnderscorePrivate from "#rules/no-underscore-private"
import paddingAfterGuardClause from "#rules/padding-after-guard-clause"
import preferArrowHandlerField from "#rules/prefer-arrow-handler-field"
import preferClassForState from "#rules/prefer-class-for-state"
import preferFindOverLoop from "#rules/prefer-find-over-loop"
import preferForEach from "#rules/prefer-for-each"
import preferFunctionOverStatelessMethod from "#rules/prefer-function-over-stateless-method"
import preferGetter from "#rules/prefer-getter"
import preferGetterOverLocal from "#rules/prefer-getter-over-local"
import preferPositiveWrap from "#rules/prefer-positive-wrap"
import preferSwitchOverIfChain from "#rules/prefer-switch-over-if-chain"
import preferTailCondition from "#rules/prefer-tail-condition"
import preferTernaryReturn from "#rules/prefer-ternary-return"
import stepDownMethods from "#rules/step-down-methods"
import stepDownTopLevel from "#rules/step-down-top-level"
import topLevelConstantsFirst from "#rules/top-level-constants-first"
import unnecessaryLocalVariable from "#rules/unnecessary-local-variable"
import verticalSpacing from "#rules/vertical-spacing"
import htmlElementSuffix from "#rules/browser/html-element-suffix"
import querySelectorSuffix from "#rules/browser/query-selector-suffix"
import noCsrfTokenAccess from "#rules/rails/no-csrf-token-access"
import actionNaming from "#rules/stimulus/action-naming"
import controllerShape from "#rules/stimulus/controller-shape"
import noImperativeEventListener from "#rules/stimulus/no-imperative-event-listener"
import noInstanceStateAssignment from "#rules/stimulus/no-instance-state-assignment"
import preferDispatch from "#rules/stimulus/prefer-dispatch"
import staticConfigKeysCamelcase from "#rules/stimulus/static-config-keys-camelcase"
import useHasTargetGetter from "#rules/stimulus/use-has-target-getter"
import noRenderStreamMessage from "#rules/turbo/no-render-stream-message"

export default {
  rules: {
    "boolean-naming": booleanNaming,
    "collapse-multi-line": collapseMultiLine,
    "compact-guard-clause": compactGuardClause,
    "constant-naming": constantNaming,
    "declarative-method-naming": declarativeMethodNaming,
    "inline-memoized-computation": inlineMemoizedComputation,
    "max-bare-returns": maxBareReturns,
    "max-exported-classes": maxExportedClasses,
    "max-field-assignments": maxFieldAssignments,
    "max-local-variables": maxLocalVariables,
    "max-logical-operators-per-condition": maxLogicalOperatorsPerCondition,
    "max-optional-chain-depth": maxOptionalChainDepth,
    "max-validation-guards-per-function": maxValidationGuardsPerFunction,
    "no-anemic-delegation": noAnemicDelegation,
    "no-boolean-handler-chain": noBooleanHandlerChain,
    "no-data-clump": noDataClump,
    "no-handler-prefix": noHandlerPrefix,
    "no-jsdoc": noJsdoc,
    "no-local-variable-return": noLocalVariableReturn,
    "no-manual-accumulation": noManualAccumulation,
    "no-method-named-call": noMethodNamedCall,
    "no-mid-function-returns": noMidFunctionReturns,
    "no-mixed-memoization": noMixedMemoization,
    "no-mutable-module-scope": noMutableModuleScope,
    "no-padded-braces": noPaddedBraces,
    "no-redundant-bind-after-arrow": noRedundantBindAfterArrow,
    "no-redundant-trailing-return": noRedundantTrailingReturn,
    "no-redundant-wrapper-method": noRedundantWrapperMethod,
    "no-relative-imports": noRelativeImports,
    "no-section-divider-comments": noSectionDividerComments,
    "no-typographic-clutter": noTypographicClutter,
    "no-underscore-private": noUnderscorePrivate,
    "padding-after-guard-clause": paddingAfterGuardClause,
    "prefer-arrow-handler-field": preferArrowHandlerField,
    "prefer-class-for-state": preferClassForState,
    "prefer-find-over-loop": preferFindOverLoop,
    "prefer-for-each": preferForEach,
    "prefer-function-over-stateless-method": preferFunctionOverStatelessMethod,
    "prefer-getter": preferGetter,
    "prefer-getter-over-local": preferGetterOverLocal,
    "prefer-positive-wrap": preferPositiveWrap,
    "prefer-switch-over-if-chain": preferSwitchOverIfChain,
    "prefer-tail-condition": preferTailCondition,
    "prefer-ternary-return": preferTernaryReturn,
    "step-down-methods": stepDownMethods,
    "step-down-top-level": stepDownTopLevel,
    "top-level-constants-first": topLevelConstantsFirst,
    "unnecessary-local-variable": unnecessaryLocalVariable,
    "vertical-spacing": verticalSpacing,

    "browser/html-element-suffix": htmlElementSuffix,
    "browser/query-selector-suffix": querySelectorSuffix,

    "rails/no-csrf-token-access": noCsrfTokenAccess,

    "stimulus/action-naming": actionNaming,
    "stimulus/controller-shape": controllerShape,
    "stimulus/no-imperative-event-listener": noImperativeEventListener,
    "stimulus/no-instance-state-assignment": noInstanceStateAssignment,
    "stimulus/prefer-dispatch": preferDispatch,
    "stimulus/static-config-keys-camelcase": staticConfigKeysCamelcase,
    "stimulus/use-has-target-getter": useHasTargetGetter,

    "turbo/no-render-stream-message": noRenderStreamMessage
  }
}

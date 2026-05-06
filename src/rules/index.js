import packageJson from "#package" with { type: "json" }
import { ruleSourcePathOf } from "#helpers/eslint/rule_source"
import booleanNaming from "#rules/boolean_naming"
import classMatchesFile from "#rules/class_matches_file"
import collapseMultiLine from "#rules/collapse_multi_line"
import compactGuardClause from "#rules/compact_guard_clause"
import constantNaming from "#rules/constant_naming"
import declarativeMethodNaming from "#rules/declarative_method_naming"
import inlineMemoizedComputation from "#rules/inline_memoized_computation"
import maxBareReturns from "#rules/max_bare_returns"
import maxCommentLines from "#rules/max_comment_lines"
import maxFieldAssignments from "#rules/max_field_assignments"
import maxLocalVariables from "#rules/max_local_variables"
import maxLogicalOperatorsPerCondition from "#rules/max_logical_operators_per_condition"
import maxOptionalChainDepth from "#rules/max_optional_chain_depth"
import maxValidationGuardsPerFunction from "#rules/max_validation_guards_per_function"
import noAnemicDelegation from "#rules/no_anemic_delegation"
import noAnemicRecord from "#rules/no_anemic_record"
import noBooleanHandlerChain from "#rules/no_boolean_handler_chain"
import noDataClump from "#rules/no_data_clump"
import noEffectfulBareReturn from "#rules/no_effectful_bare_return"
import noHandlerPrefix from "#rules/no_handler_prefix"
import noJsdoc from "#rules/no_jsdoc"
import noLocalVariableReturn from "#rules/no_local_variable_return"
import noManualAccumulation from "#rules/no_manual_accumulation"
import noMethodNamedCall from "#rules/no_method_named_call"
import noMidFunctionReturns from "#rules/no_mid_function_returns"
import noMixedExports from "#rules/no_mixed_exports"
import noMixedMemoization from "#rules/no_mixed_memoization"
import noMutableModuleScope from "#rules/no_mutable_module_scope"
import noPaddedBraces from "#rules/no_padded_braces"
import noRedundantBindAfterArrow from "#rules/no_redundant_bind_after_arrow"
import noRedundantTrailingReturn from "#rules/no_redundant_trailing_return"
import noRedundantWrapper from "#rules/no_redundant_wrapper"
import noRelativeImports from "#rules/no_relative_imports"
import noSectionDividerComments from "#rules/no_section_divider_comments"
import noTypographicClutter from "#rules/no_typographic_clutter"
import noUninitializedField from "#rules/no_uninitialized_field"
import paddingAfterGuardClause from "#rules/padding_after_guard_clause"
import preferArrayFromMapping from "#rules/prefer_array_from_mapping"
import preferArrowHandlerField from "#rules/prefer_arrow_handler_field"
import preferClassForState from "#rules/prefer_class_for_state"
import preferConstant from "#rules/prefer_constant"
import preferFindOverLoop from "#rules/prefer_find_over_loop"
import preferForEach from "#rules/prefer_for_each"
import preferFunctionOverStatelessMethod from "#rules/prefer_function_over_stateless_method"
import preferFieldOverAccessor from "#rules/prefer_field_over_accessor"
import preferGetter from "#rules/prefer_getter"
import preferGetterOverLocal from "#rules/prefer_getter_over_local"
import preferMinimalTernary from "#rules/prefer_minimal_ternary"
import preferPositiveWrap from "#rules/prefer_positive_wrap"
import preferPrivateMember from "#rules/prefer_private_member"
import preferSwitchOverIfChain from "#rules/prefer_switch_over_if_chain"
import preferTailCondition from "#rules/prefer_tail_condition"
import preferTernaryReturn from "#rules/prefer_ternary_return"
import reflowComments from "#rules/reflow_comments"
import stepDownMethods from "#rules/step_down_methods"
import stepDownTopLevel from "#rules/step_down_top_level"
import testStructure from "#rules/test_structure"
import topLevelConstantsFirst from "#rules/top_level_constants_first"
import unnecessaryLocalVariable from "#rules/unnecessary_local_variable"
import verticalSpacing from "#rules/vertical_spacing"
import htmlElementSuffix from "#rules/browser/html_element_suffix"
import noClassSelector from "#rules/browser/no_class_selector"
import preferReflectedAriaProperties from "#rules/browser/prefer_reflected_aria_properties"
import querySelectorSuffix from "#rules/browser/query_selector_suffix"
import noManualCsrf from "#rules/rails/no_manual_csrf"
import restrictedExports from "#rules/restrictions/exports"
import actionNaming from "#rules/stimulus/action_naming"
import controllerShape from "#rules/stimulus/controller_shape"
import noImperativeEventListener from "#rules/stimulus/no_imperative_event_listener"
import noInstanceStateAssignment from "#rules/stimulus/no_instance_state_assignment"
import noManualStaticAttributeQuery from "#rules/stimulus/no_manual_static_attribute_query"
import preferDispatch from "#rules/stimulus/prefer_dispatch"
import staticConfigKeysCamelcase from "#rules/stimulus/static_config_keys_camelcase"
import useHasTargetGetter from "#rules/stimulus/use_has_target_getter"
import noRenderStreamMessage from "#rules/turbo/no_render_stream_message"
import noStreamAcceptHeader from "#rules/turbo/no_stream_accept_header"

const SOURCE_URL = "https://github.com/callbacksystems/eslint-config/blob/main"

export default {
  meta: { name: packageJson.name, version: packageJson.version },
  rules: documented({
    "boolean-naming": booleanNaming,
    "class-matches-file": classMatchesFile,
    "collapse-multi-line": collapseMultiLine,
    "compact-guard-clause": compactGuardClause,
    "constant-naming": constantNaming,
    "declarative-method-naming": declarativeMethodNaming,
    "inline-memoized-computation": inlineMemoizedComputation,
    "max-bare-returns": maxBareReturns,
    "max-comment-lines": maxCommentLines,
    "max-field-assignments": maxFieldAssignments,
    "max-local-variables": maxLocalVariables,
    "max-logical-operators-per-condition": maxLogicalOperatorsPerCondition,
    "max-optional-chain-depth": maxOptionalChainDepth,
    "max-validation-guards-per-function": maxValidationGuardsPerFunction,
    "no-anemic-delegation": noAnemicDelegation,
    "no-anemic-record": noAnemicRecord,
    "no-boolean-handler-chain": noBooleanHandlerChain,
    "no-data-clump": noDataClump,
    "no-effectful-bare-return": noEffectfulBareReturn,
    "no-handler-prefix": noHandlerPrefix,
    "no-jsdoc": noJsdoc,
    "no-local-variable-return": noLocalVariableReturn,
    "no-manual-accumulation": noManualAccumulation,
    "no-method-named-call": noMethodNamedCall,
    "no-mid-function-returns": noMidFunctionReturns,
    "no-mixed-exports": noMixedExports,
    "no-mixed-memoization": noMixedMemoization,
    "no-mutable-module-scope": noMutableModuleScope,
    "no-padded-braces": noPaddedBraces,
    "no-redundant-bind-after-arrow": noRedundantBindAfterArrow,
    "no-redundant-trailing-return": noRedundantTrailingReturn,
    "no-redundant-wrapper": noRedundantWrapper,
    "no-relative-imports": noRelativeImports,
    "no-section-divider-comments": noSectionDividerComments,
    "no-typographic-clutter": noTypographicClutter,
    "no-uninitialized-field": noUninitializedField,
    "padding-after-guard-clause": paddingAfterGuardClause,
    "prefer-array-from-mapping": preferArrayFromMapping,
    "prefer-arrow-handler-field": preferArrowHandlerField,
    "prefer-class-for-state": preferClassForState,
    "prefer-constant": preferConstant,
    "prefer-find-over-loop": preferFindOverLoop,
    "prefer-for-each": preferForEach,
    "prefer-function-over-stateless-method": preferFunctionOverStatelessMethod,
    "prefer-field-over-accessor": preferFieldOverAccessor,
    "prefer-getter": preferGetter,
    "prefer-getter-over-local": preferGetterOverLocal,
    "prefer-minimal-ternary": preferMinimalTernary,
    "prefer-positive-wrap": preferPositiveWrap,
    "prefer-private-member": preferPrivateMember,
    "prefer-switch-over-if-chain": preferSwitchOverIfChain,
    "prefer-tail-condition": preferTailCondition,
    "prefer-ternary-return": preferTernaryReturn,
    "reflow-comments": reflowComments,
    "step-down-methods": stepDownMethods,
    "step-down-top-level": stepDownTopLevel,
    "test-structure": testStructure,
    "top-level-constants-first": topLevelConstantsFirst,
    "unnecessary-local-variable": unnecessaryLocalVariable,
    "vertical-spacing": verticalSpacing,

    "browser/html-element-suffix": htmlElementSuffix,
    "browser/no-class-selector": noClassSelector,
    "browser/prefer-reflected-aria-properties": preferReflectedAriaProperties,
    "browser/query-selector-suffix": querySelectorSuffix,

    "rails/no-manual-csrf": noManualCsrf,

    "restrictions/exports": restrictedExports,

    "stimulus/action-naming": actionNaming,
    "stimulus/controller-shape": controllerShape,
    "stimulus/no-imperative-event-listener": noImperativeEventListener,
    "stimulus/no-instance-state-assignment": noInstanceStateAssignment,
    "stimulus/no-manual-static-attribute-query": noManualStaticAttributeQuery,
    "stimulus/prefer-dispatch": preferDispatch,
    "stimulus/static-config-keys-camelcase": staticConfigKeysCamelcase,
    "stimulus/use-has-target-getter": useHasTargetGetter,

    "turbo/no-render-stream-message": noRenderStreamMessage,
    "turbo/no-stream-accept-header": noStreamAcceptHeader
  })
}

// The docs link points at the source, where the header already is, so no rule carries its own.
function documented(rules) {
  return Object.fromEntries(Object.entries(rules).map(([ id, rule ]) => [ id, linked(id, rule) ]))
}

function linked(id, rule) {
  return { ...rule, meta: { ...rule.meta, docs: { ...rule.meta.docs, url: `${SOURCE_URL}/${ruleSourcePathOf(id)}` } } }
}

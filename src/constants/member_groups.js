import {
  ELEMENT_ADOPTED_PATTERN,
  ELEMENT_ATTRIBUTE_CHANGED_PATTERN,
  ELEMENT_CONNECTED_PATTERN,
  ELEMENT_DISCONNECTED_PATTERN,
  ELEMENT_FORM_PATTERN,
  STIMULUS_CALLBACK_PATTERN,
  STIMULUS_CONNECT_PATTERN,
  STIMULUS_DISCONNECT_PATTERN,
  STIMULUS_INITIALIZE_PATTERN
} from "#constants/member_patterns"

export const CLASS_GROUPS = [
  "static-property",
  "property",
  "private-property",
  "static-block",
  [ "static-method", "static-function-property", "static-get-method", "static-set-method" ],
  [
    "private-static-method",
    "private-static-function-property",
    "private-static-get-method",
    "private-static-set-method"
  ],
  "constructor",
  [ "method", "function-property", "get-method", "set-method" ],
  [ "private-method", "private-function-property", "private-get-method", "private-set-method" ]
]

// One group per callback, in the order the element goes through them, so `connected` can never sit below
// `disconnected`. The form callbacks share a group: they are alternatives, not a sequence.
export const ELEMENT_MEMBER_GROUPS = [
  { name: "connected-callback", pattern: ELEMENT_CONNECTED_PATTERN },
  { name: "disconnected-callback", pattern: ELEMENT_DISCONNECTED_PATTERN },
  { name: "adopted-callback", pattern: ELEMENT_ADOPTED_PATTERN },
  { name: "attribute-changed-callback", pattern: ELEMENT_ATTRIBUTE_CHANGED_PATTERN },
  { name: "form-callbacks", pattern: ELEMENT_FORM_PATTERN }
]

export const ELEMENT_NAME_GROUPS = ELEMENT_MEMBER_GROUPS.map(({ pattern }) => pattern)

// Restates the element groups because `/stimulus` composes over `/browser` and flat config replaces a rule's options.
export const STIMULUS_NAME_GROUPS = [
  ...ELEMENT_NAME_GROUPS,
  STIMULUS_INITIALIZE_PATTERN,
  STIMULUS_CONNECT_PATTERN,
  STIMULUS_DISCONNECT_PATTERN,
  STIMULUS_CALLBACK_PATTERN
]

export const perfectionistRules = {
  "perfectionist/sort-classes": [ "error", {
    type: "unsorted",
    groups: [
      "static-property",
      "property",
      "private-property",
      "static-method",
      "static-get-method",
      "static-set-method",
      "private-static-get-method",
      "private-static-set-method",
      "constructor",
      [ "method", "function-property" ],
      "get-method",
      "set-method",
      [ "private-method", "private-function-property" ],
      "private-get-method",
      "private-set-method"
    ]
  } ],
  "perfectionist/sort-named-imports": [ "error", { type: "alphabetical", order: "asc", ignoreCase: false } ],
  "perfectionist/sort-named-exports": [ "error", { type: "alphabetical", order: "asc", ignoreCase: false } ]
}

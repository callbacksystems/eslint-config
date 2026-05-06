import { CLASS_GROUPS } from "#constants/member_groups"

export const perfectionistRules = {
  "perfectionist/sort-classes": [ "error", { type: "unsorted", groups: CLASS_GROUPS } ],
  "perfectionist/sort-named-imports": [ "error", { type: "alphabetical", order: "asc", ignoreCase: false } ],
  "perfectionist/sort-named-exports": [ "error", { type: "alphabetical", order: "asc", ignoreCase: false } ]
}

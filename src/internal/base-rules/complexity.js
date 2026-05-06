export const complexityRules = { complexity: [ "error", { max: 7 } ],
  "max-depth": [ "error", { max: 3 } ],
  "max-lines": [ "error", { max: 300, skipBlankLines: true, skipComments: true } ],
  "max-lines-per-function": [ "error", { max: 30, skipBlankLines: true, skipComments: true } ],
  "max-nested-callbacks": [ "error", { max: 3 } ],
  "max-statements": [ "error", { max: 10 } ],
  "max-classes-per-file": [ "error", { max: 1 } ],
  "sonarjs/cognitive-complexity": [ "error", 7 ]
}

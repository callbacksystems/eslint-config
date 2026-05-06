import base from "#base"
import node from "#node"
import { restrictExports } from "#restrictions"

export default [
  ...base,
  ...node,
  ...restrictExports({ files: [ "src/constants/**/*.js" ], to: [ "constant" ] }),
  ...restrictExports({ files: [ "src/helpers/**/*.js" ], to: [ "class", "function" ] }),
  ...restrictExports({ files: [ "src/internal/**/*.js" ], to: [ "constant" ] }),
  ...restrictExports({ files: [ "src/rules/**/*.js" ], to: [ "constant" ] }),
  {
    // A rule file's header is its documentation: the reference links here for what the rule is for and why it exists.
    files: [ "src/rules/**" ],
    rules: { "callbacksystems/max-comment-lines": [ "error", { headerMax: 25 } ] }
  },
  {
    // RuleTester registers its cases through its own run(), so sonarjs sees no literal test() call and flags the file
    // as empty.
    files: [ "test/rules/**/*.test.js" ],
    rules: { "sonarjs/no-empty-test-file": "off" }
  },
  { ignores: [ "test/fixtures/**" ] }
]

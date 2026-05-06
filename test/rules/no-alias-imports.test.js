import rule from "#rules/no-alias-imports"
import { tester } from "#test/helpers"

tester.run("no-alias-imports", rule, {
  valid: [
    "import x from 'lodash'",
    "import x from '@scope/package'",
    "import x from './relative'",
    "import x from 'src/components/Button'"
  ],
  invalid: [
    {
      code: "import x from '@/components/Button'",
      output: "import x from \"components/Button\"",
      errors: [ { messageId: "aliasImport" } ]
    },
    {
      code: "export { default } from '@/utils'",
      output: "export { default } from \"utils\"",
      errors: [ { messageId: "aliasImport" } ]
    },
    {
      code: "export * from '@/lib'",
      output: "export * from \"lib\"",
      errors: [ { messageId: "aliasImport" } ]
    }
  ]
})

import rule from "#rules/no-relative-imports"
import { tester } from "#support"

// RuleTester has no project resolver, so the firing path is covered against a fixture in
// test/configs/relative-imports.test.js. These valid cases assert the rule stays silent when no bare equivalent exists.
tester.run("no-relative-imports", rule, {
  valid: [ "import x from 'lodash'", "import x from './sibling'", "import x from '../parent/file'" ],
  invalid: []
})

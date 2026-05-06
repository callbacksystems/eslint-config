import rule from "#rules/no_relative_imports"
import { tester } from "#support"

// RuleTester has no project resolver, so the firing path is covered against a fixture in
// test/configs/relative_imports.test.js. These valid cases assert the rule stays silent when no bare equivalent exists.
tester.run("no-relative-imports", rule, {
  valid: [ "import x from 'lodash'", "import x from './sibling'", "import x from '../parent/file'" ],
  invalid: []
})

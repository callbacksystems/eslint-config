import rule from "#rules/no-relative-imports"
import { tester } from "#test/helpers"

// Resolution depends on a real tsconfig with `baseUrl`. Without one, no bare
// equivalent resolves and the rule stays silent. The integration suite covers
// the firing case via a fixture project.
tester.run("no-relative-imports", rule, {
  valid: [
    "import x from 'lodash'",
    "import x from './sibling'",
    "import x from '../parent/file'"
  ],
  invalid: []
})

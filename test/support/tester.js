import { test } from "node:test"
import { RuleTester } from "eslint"

RuleTester.describe = (name, group) => group()
RuleTester.it = test
RuleTester.itOnly = test.only

export const tester = new RuleTester({ languageOptions: { ecmaVersion: "latest", sourceType: "module" } })

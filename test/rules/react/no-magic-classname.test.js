import rule from "#rules/react/no-magic-classname"
import { dedent, tester } from "#test/support"

tester.run("no-magic-classname", rule, {
  valid: [
    "const x = 'short'",
    "const y = 'one two three'", // Only used once
    dedent`
      const a = "w-full border rounded"
      const b = "w-full border rounded"
    ` // 2 occurrences only
  ],
  invalid: [
    {
      code: dedent`
        const a = "w-full border rounded px-3 py-2 text-sm"
        const b = "w-full border rounded px-3 py-2 text-sm"
        const c = "w-full border rounded px-3 py-2 text-sm"
      `,
      errors: [ { messageId: "magicClassname" } ]
    }
  ]
})

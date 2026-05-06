import rule from "#rules/react/no-trivial-hook"
import { dedent, tester } from "#test/support"

tester.run("no-trivial-hook", rule, {
  valid: [
    dedent`
      function useCounter() {
        const [count, setCount] = useState(0)
        return { count, setCount }
      }
    `,
    dedent`
      function useDebounced(value, delay) {
        const [debounced, setDebounced] = useState(value)
        useEffect(() => { setDebounced(value) }, [value, delay])
        return debounced
      }
    `,
    "function regular() { return useCallback(() => {}, []) }"
  ],
  invalid: [
    { code: "function useThing() { return useCallback(() => {}, []) }", errors: [ { messageId: "trivialHook" } ] },
    {
      code: "function useValue(deps) { return useMemo(() => deps, [deps]) }",
      errors: [ { messageId: "trivialHook" } ]
    },
    { code: "const useTrack = () => { return useEffect(() => {}, []) }", errors: [ { messageId: "trivialHook" } ] }
  ]
})

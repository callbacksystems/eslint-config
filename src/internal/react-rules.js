// Anti-AI-drift rules layered on top of base/browser/react-base for the
// /react preset. These target patterns observed in AI-generated React code:
// hook explosions, generic suffixes, useEffect spam.

export const reactAntiDriftRules = {
  "callbacksystems/react/no-trivial-hook": "error",
  "callbacksystems/react/max-internal-hooks-composed": [ "warn", { max: 4 } ],
  "callbacksystems/react/no-suffix-handler-types": "error",
  "callbacksystems/react/max-effects-per-component": [ "warn", { max: 2 } ],
  "callbacksystems/react/no-imperative-handle-for-single-method": "error",
  "callbacksystems/react/no-magic-classname": "error",
  "callbacksystems/react/max-consecutive-fieldset-defs": [ "warn", { max: 3 } ]
}

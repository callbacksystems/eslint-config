// Stimulus overlay. Compose with `/base` and `/browser` from the consumer side.

import { stimulusRules } from "#internal/stimulus-rules"

export default [
  { rules: stimulusRules },
  {
    files: [ "**/controllers/**" ],
    rules: {
      // Stimulus controllers occasionally co-locate small helper classes.
      "max-classes-per-file": "off"
    }
  }
]

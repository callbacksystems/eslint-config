// In components/auth/**:
// - `internal` import is exempt (allowedIn under restrictedTo scope).
// - `createContext` is still restricted (global importNames restriction not exempt here).
import x from "internal"
import { createContext } from "react"

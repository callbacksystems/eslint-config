// Fixture: a React component written in `.js`. JSX here must parse and the
// react/react-hooks rules must reach it, not just `.jsx`.
import { useState } from "react"

export const Panel = (props) => {
  if (props.open) {
    const [ count ] = useState(0)
    return <span>{count}</span>
  }
  return <img onClick={props.onClick} />
}

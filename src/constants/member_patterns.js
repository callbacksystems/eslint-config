export const ELEMENT_CONNECTED_PATTERN = "^connectedCallback$"

export const ELEMENT_DISCONNECTED_PATTERN = "^disconnectedCallback$"

export const ELEMENT_ADOPTED_PATTERN = "^adoptedCallback$"

export const ELEMENT_ATTRIBUTE_CHANGED_PATTERN = "^attributeChangedCallback$"

export const ELEMENT_FORM_PATTERN = "^form(Associated|Disabled|Reset|StateRestore)Callback$"

export const STIMULUS_INITIALIZE_PATTERN = "^initialize$"

export const STIMULUS_CONNECT_PATTERN = "^connect$"

export const STIMULUS_DISCONNECT_PATTERN = "^disconnect$"

export const STIMULUS_CALLBACK_PATTERN =
  "^.+(TargetConnected|TargetDisconnected|ValueChanged|OutletConnected|OutletDisconnected)$"

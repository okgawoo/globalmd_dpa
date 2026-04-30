let _tab: 'existing' | 'prospect' | null = null

export function setPendingCustomerTab(t: 'existing' | 'prospect') {
  _tab = t
}

export function getPendingCustomerTab(): 'existing' | 'prospect' | null {
  return _tab
}

export function clearPendingCustomerTab() {
  _tab = null
}

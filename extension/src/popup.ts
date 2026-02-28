// On/off toggle logic

const toggle = document.getElementById('toggle') as HTMLInputElement

// Load saved state
chrome.storage.local.get('enabled', ({ enabled }) => {
  toggle.checked = enabled ?? true
})

toggle.addEventListener('change', () => {
  chrome.storage.local.set({ enabled: toggle.checked })
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'SET_ENABLED',
        enabled: toggle.checked,
      })
    }
  })
})

// On/off toggle logic

const toggle = document.getElementById('toggle') as HTMLInputElement
const beacon = document.getElementById('beacon')!
const statusMsg = document.getElementById('status-msg')!
const statusCard = document.getElementById('status-card')!
const stateLabel = document.getElementById('state-label')!

function applyState(enabled: boolean) {
  if (enabled) {
    beacon.classList.add('live')
    statusMsg.classList.add('live')
    statusCard.classList.add('active')
    statusMsg.textContent = 'Monitoring Instagram Reels'
    stateLabel.textContent = 'ACTIVE'
    stateLabel.classList.add('on')
  } else {
    beacon.classList.remove('live')
    statusMsg.classList.remove('live')
    statusCard.classList.remove('active')
    statusMsg.textContent = 'Monitoring disabled'
    stateLabel.textContent = 'INACTIVE'
    stateLabel.classList.remove('on')
  }
}

// Load saved state
chrome.storage.local.get('enabled', ({ enabled }) => {
  const isEnabled = enabled ?? true
  toggle.checked = isEnabled
  applyState(isEnabled)
})

toggle.addEventListener('change', () => {
  const isEnabled = toggle.checked
  chrome.storage.local.set({ enabled: isEnabled })
  applyState(isEnabled)
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'SET_ENABLED',
        enabled: isEnabled,
      })
    }
  })
})

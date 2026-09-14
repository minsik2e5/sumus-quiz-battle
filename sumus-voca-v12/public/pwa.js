let installPrompt;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
});
window.addEventListener('appinstalled', () => { installPrompt = null; });

export async function installSumusApp() {
  if (!installPrompt) return false;
  installPrompt.prompt();
  await installPrompt.userChoice.catch(() => null);
  installPrompt = null;
  return true;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(registration => {
      registration.update().catch(() => {});
    }).catch(() => {});
  });
}

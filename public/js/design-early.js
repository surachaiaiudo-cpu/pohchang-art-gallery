// Runs before the first paint: puts back the home page look chosen in /admin last time, so a
// returning visitor does not see design B flash before lobby.js reads the settings.
try {
  const d = JSON.parse(localStorage.getItem('home-look') || '{}');
  if (d.design === 'pohchang') {
    document.documentElement.dataset.design = 'pohchang';
    if (d.mood === 'mourning') document.documentElement.dataset.mood = 'mourning';
  }
} catch { /* storage blocked: lobby.js still applies the look */ }

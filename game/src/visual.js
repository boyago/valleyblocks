// Visual novo em teste (cena de teste): ligue com ?visual=novo na URL.
// Sombra de canto nos blocos, céu em degradê e luz quente de fim de tarde.
const visualParam = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('visual') : null;
let storedVisual = false; try { storedVisual = !!JSON.parse(localStorage.getItem('vale-settings') || '{}').newVisual; } catch { /* sem armazenamento */ }
// Também liga pela opção 'Visual novo' em Do seu jeito (salva no aparelho; ?visual=antigo força o antigo).
export const NEW_VISUAL = visualParam === 'novo' || (visualParam !== 'antigo' && storedVisual);
// Hora fixa para comparar (0 a 1; 0,3 manhã, 0,62 fim de tarde): ?hora=0.62
const hour = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('hora') : null;
export const TEST_TIME = hour != null && Number.isFinite(+hour) ? ((+hour % 1) + 1) % 1 : null;

// Tema fisso dark — FOfit Premium
export const DARK = {
  bg: '#080808',
  bgCard: '#0D0D0D',
  bgInput: '#161616',
  bgSubtle: '#0D0D0D',
  border: '#1C1C1C',
  borderSubtle: '#141414',
  text: '#F0F0F0',
  textMuted: '#888',
  textLight: '#333',
  sidebar: '#050505',
  sidebarBorder: 'rgba(255,255,255,0.04)',
  topbar: '#080808',
  topbarBorder: '#151515',
  orange: '#D4570A',
  orangeLight: 'rgba(212,87,10,0.12)',
  orangeMid: '#F4894A',
  green: '#3B8C5A',
  greenLight: 'rgba(59,140,90,0.12)',
  red: '#E24B4A',
  redLight: 'rgba(226,75,74,0.12)',
}

// Alias — tutto dark
export const LIGHT = DARK

export function getTheme() { return DARK }
export function isDark() { return true }
export function toggleTheme() { return 'dark' }

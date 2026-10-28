// Sistema di tema FOfit — Premium Dark

export const DARK = {
  bg: '#080808',
  bgCard: '#101010',
  bgInput: '#161616',
  bgSubtle: '#0D0D0D',
  border: '#1C1C1C',
  borderSubtle: '#141414',
  text: '#F0F0F0',
  textMuted: '#555555',
  textLight: '#2A2A2A',
  sidebar: '#050505',
  sidebarBorder: 'rgba(255,255,255,0.04)',
  topbar: '#080808',
  topbarBorder: '#151515',
  orange: '#D4570A',
  orangeLight: '#1A0A00',
  orangeMid: '#F4894A',
  green: '#3B8C5A',
  greenLight: '#0A1A0E',
  red: '#E24B4A',
  redLight: '#1A0808',
}

export const LIGHT = {
  bg: '#F5F3EF',
  bgCard: '#FFFFFF',
  bgInput: '#F5F3EF',
  bgSubtle: '#F5F3EF',
  border: '#E0DDD6',
  borderSubtle: '#F0EDE8',
  text: '#111111',
  textMuted: '#888780',
  textLight: '#BBBBBB',
  sidebar: '#0F0F0F',
  sidebarBorder: 'rgba(255,255,255,0.04)',
  topbar: '#0F0F0F',
  topbarBorder: '#1A1A1A',
  orange: '#D4570A',
  orangeLight: '#FEF0E7',
  orangeMid: '#F4894A',
  green: '#3B6D11',
  greenLight: '#EAF3DE',
  red: '#E24B4A',
  redLight: '#FEE2E2',
}

export function getTheme() {
  const saved = localStorage.getItem('fofit_theme')
  // Default dark — il design è ottimizzato per dark
  return saved === 'light' ? LIGHT : DARK
}

export function isDark() {
  return localStorage.getItem('fofit_theme') !== 'light'
}

export function toggleTheme() {
  const current = localStorage.getItem('fofit_theme')
  const next = current === 'light' ? 'dark' : 'light'
  localStorage.setItem('fofit_theme', next)
  return next
}

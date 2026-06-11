// Sistema di tema FOfit — Light e Dark

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
  topbar: '#FFFFFF',
  topbarBorder: '#E0DDD6',
  orange: '#D4570A',
  orangeLight: '#FEF0E7',
  orangeMid: '#F4894A',
  green: '#3B6D11',
  greenLight: '#EAF3DE',
  red: '#E24B4A',
  redLight: '#FEE2E2',
}

export const DARK = {
  bg: '#111111',
  bgCard: '#1C1C1E',
  bgInput: '#2C2C2E',
  bgSubtle: '#2C2C2E',
  border: '#2C2C2E',
  borderSubtle: '#222222',
  text: '#F5F5F5',
  textMuted: '#8E8E93',
  textLight: '#444444',
  sidebar: '#000000',
  sidebarBorder: 'rgba(255,255,255,0.06)',
  topbar: '#1C1C1E',
  topbarBorder: '#2C2C2E',
  orange: '#FF6B2B',
  orangeLight: '#2D1A0A',
  orangeMid: '#FF8C4A',
  green: '#4CAF72',
  greenLight: '#0D2B1A',
  red: '#FF4A4A',
  redLight: '#2D0A0A',
}

export function getTheme() {
  const saved = localStorage.getItem('fofit_theme')
  return saved === 'dark' ? DARK : LIGHT
}

export function isDark() {
  return localStorage.getItem('fofit_theme') === 'dark'
}

export function toggleTheme() {
  const current = localStorage.getItem('fofit_theme')
  const next = current === 'dark' ? 'light' : 'dark'
  localStorage.setItem('fofit_theme', next)
  return next
}

export function fmt(n) { return '$' + n.toLocaleString('en-AU') }
export function parseAmt(a) { return parseFloat((a || '0').toString().replace(/[$,]/g, '')) }

export const COLORS = {
  checking: 'rgba(255,255,255,0.9)',
  savings: 'rgba(255,255,255,0.6)',
  cash: 'rgba(255,255,255,0.35)',
  investments: 'rgba(0,255,65,0.7)',
  gold: 'rgba(0,255,65,0.45)',
  receivables: 'rgba(0,255,65,0.25)',
  white: '#ffffff',
  green: '#00ff41',
  red: '#ff0040',
  dim: '#444',
}

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE_FILE = path.join(__dirname, '../../price-cache.json')
const DB_PATH = path.join(process.env.HOME, '.openclaw/workspace/woozy.db')

const CACHE_TTL_MARKET = 15 * 60 * 1000
const CACHE_TTL_OFF = 60 * 60 * 1000

function isMarketHours() {
  const now = new Date()
  const aest = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }))
  const day = aest.getDay()
  const hour = aest.getHours()
  return day >= 1 && day <= 5 && hour >= 10 && hour < 16
}

function getCacheTTL() {
  return isMarketHours() ? CACHE_TTL_MARKET : CACHE_TTL_OFF
}

function readCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'))
    }
  } catch {}
  return null
}

function writeCache(data) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2))
  } catch (e) {
    console.error('Failed to write price cache:', e.message)
  }
}

async function fetchASXPrice(ticker) {
  // Scrape Google Finance for ASX-listed tickers
  const res = await fetch(`https://www.google.com/finance/quote/${ticker}:ASX`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
  })
  const html = await res.text()
  const match = html.match(/data-last-price="([0-9.]+)"/)
  if (match) return parseFloat(match[1])
  throw new Error(`Could not parse ${ticker} price from Google Finance`)
}

async function fetchGoldPriceAUD() {
  const [goldRes, fxRes] = await Promise.all([
    fetch('https://api.gold-api.com/price/XAU'),
    fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json')
  ])
  const goldData = await goldRes.json()
  const fxData = await fxRes.json()
  
  const usdPerOz = goldData.price
  const audRate = fxData.usd.aud
  const audPerGram = (usdPerOz / 31.1035) * audRate
  return { audPerGram: Math.round(audPerGram * 100) / 100, audRate }
}

function getHoldings() {
  const db = new Database(DB_PATH, { readonly: true })
  const holdings = db.prepare('SELECT * FROM holdings').all()
  db.close()
  return holdings
}

export async function fetchPrices(force = false) {
  const cache = readCache()
  const now = Date.now()
  
  if (!force && cache && (now - cache.fetchedAt) < getCacheTTL()) {
    return { ...cache, fromCache: true }
  }
  
  const holdings = getHoldings()
  const result = {
    prices: cache?.prices || {},
    goldPerGram: cache?.goldPerGram || null,
    audRate: cache?.audRate || null,
    fetchedAt: now,
    errors: []
  }
  
  // Keep backward compat
  if (cache?.hndq) result.prices['HNDQ'] = cache.hndq

  // Fetch prices for all holdings with tickers (ASX ETFs)
  const tickerHoldings = holdings.filter(h => h.ticker && h.type === 'etf')
  for (const h of tickerHoldings) {
    const symbol = h.ticker.replace('.AX', '')
    try {
      result.prices[h.name] = await fetchASXPrice(symbol)
    } catch (e) {
      result.errors.push(`${h.name}: ${e.message}`)
    }
  }
  
  // Backward compat
  if (result.prices['HNDQ']) result.hndq = result.prices['HNDQ']

  // Fetch gold if any commodity holdings exist
  const hasGold = holdings.some(h => h.type === 'commodity')
  if (hasGold) {
    try {
      const gold = await fetchGoldPriceAUD()
      result.goldPerGram = gold.audPerGram
      result.audRate = gold.audRate
    } catch (e) {
      result.errors.push(`Gold: ${e.message}`)
    }
  }
  
  writeCache(result)
  return { ...result, fromCache: false }
}

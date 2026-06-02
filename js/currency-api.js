const CACHE_KEY = 'hawaa_exchange_rates';
const CACHE_TIME_KEY = 'hawaa_exchange_rates_time';
const API_KEY = 'fe6c6b56d919c4023f34b403';
const CACHE_DURATION = 24 * 60 * 60 * 1000;

let cachedRates = null;

export async function fetchExchangeRates(baseCurrency = 'USD') {
    const cached = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
    const now = Date.now();
    if (cached && cachedTime && (now - parseInt(cachedTime)) < CACHE_DURATION) {
        cachedRates = JSON.parse(cached);
        return cachedRates;
    }
    if (!navigator.onLine && cached) {
        cachedRates = JSON.parse(cached);
        return cachedRates;
    }
    try {
        const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}?apikey=${API_KEY}`);
        const data = await response.json();
        cachedRates = data.rates;
        cachedRates.base = data.base;
        localStorage.setItem(CACHE_KEY, JSON.stringify(cachedRates));
        localStorage.setItem(CACHE_TIME_KEY, now.toString());
        return cachedRates;
    } catch (err) {
        if (cached) return JSON.parse(cached);
        throw err;
    }
}

export function getRatesLastUpdate() {
    const t = localStorage.getItem(CACHE_TIME_KEY);
    return t ? new Date(parseInt(t)) : null;
}
export function isRatesStale() {
    const t = localStorage.getItem(CACHE_TIME_KEY);
    return t ? (Date.now() - parseInt(t)) > CACHE_DURATION : true;
}

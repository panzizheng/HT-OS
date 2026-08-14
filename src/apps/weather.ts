// ============================================================
// 天气应用 - 使用 Open-Meteo API 获取真实天气数据
// 全面美化：iPad OS 风格毛玻璃卡片设计
// ============================================================

import { WindowManager } from '../wm/WindowManager'
import { ContextMenu } from '../desktop/ContextMenu'
import { dialog } from '../desktop/Dialog'

const APP_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="9" cy="9" r="4" fill="#ffb900"/><path d="M6 17 a4 4 0 0 1 1-8 a5 5 0 0 1 9 1 a3 3 0 0 1 1 6 z" fill="#9ec5e8"/></svg>'

const SEARCH_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
const STAR_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
const STAR_FILLED_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="#ffb900" stroke="#ffb900" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
const REFRESH_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9 a9 9 0 0 1 14.85-3.36 L23 10 M1 14 l4.64 4.36 A9 9 0 0 0 20.49 15"/></svg>'
const LOCATION_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>'

// 城市坐标映射表（Open-Meteo API 使用经纬度）
const CITY_COORDS: { [key: string]: { lat: number; lon: number } } = {
  '北京': { lat: 39.9042, lon: 116.4074 },
  '上海': { lat: 31.2304, lon: 121.4737 },
  '广州': { lat: 23.1291, lon: 113.2644 },
  '深圳': { lat: 22.5431, lon: 114.0579 },
  '杭州': { lat: 30.2741, lon: 120.1551 },
  '南京': { lat: 32.0603, lon: 118.7969 },
  '苏州': { lat: 31.2990, lon: 120.5853 },
  '武汉': { lat: 30.5928, lon: 114.3055 },
  '成都': { lat: 30.5728, lon: 104.0668 },
  '重庆': { lat: 29.4316, lon: 106.9123 },
  '西安': { lat: 34.3416, lon: 108.9398 },
  '天津': { lat: 39.3434, lon: 117.3616 },
  '青岛': { lat: 36.0671, lon: 120.3826 },
  '大连': { lat: 38.9140, lon: 121.6147 },
  '厦门': { lat: 24.4798, lon: 118.0894 },
  '长沙': { lat: 28.2282, lon: 112.9388 },
  '郑州': { lat: 34.7466, lon: 113.6254 },
  '沈阳': { lat: 41.8057, lon: 123.4315 },
  '哈尔滨': { lat: 45.8038, lon: 126.5350 },
  '长春': { lat: 43.8171, lon: 125.3235 },
  '济南': { lat: 36.6512, lon: 116.9970 },
  '合肥': { lat: 31.8206, lon: 117.2272 },
  '南昌': { lat: 28.6832, lon: 115.8921 },
  '福州': { lat: 26.0745, lon: 119.2965 },
  '昆明': { lat: 25.0389, lon: 102.7183 },
  '贵阳': { lat: 26.6470, lon: 106.6302 },
  '南宁': { lat: 22.8170, lon: 108.3665 },
  '海口': { lat: 20.0442, lon: 110.1999 },
  '兰州': { lat: 36.0611, lon: 103.8343 },
  '银川': { lat: 38.4872, lon: 106.2309 },
  '西宁': { lat: 36.6171, lon: 101.7782 },
  '乌鲁木齐': { lat: 43.8256, lon: 87.6168 },
  '拉萨': { lat: 29.6500, lon: 91.1000 },
  '呼和浩特': { lat: 40.8426, lon: 111.7519 },
  '石家庄': { lat: 38.0428, lon: 114.5149 },
  '太原': { lat: 37.8706, lon: 112.5489 },
  '香港': { lat: 22.3193, lon: 114.1694 },
  '澳门': { lat: 22.1987, lon: 113.5439 },
  '台北': { lat: 25.0330, lon: 121.5654 }
}

// Open-Meteo WMO 天气代码映射
const WEATHER_CODES: { [key: number]: { code: string; name: string } } = {
  0: { code: 'sunny', name: '晴' },
  1: { code: 'cloudy', name: '大部晴朗' },
  2: { code: 'cloudy', name: '多云' },
  3: { code: 'overcast', name: '阴' },
  45: { code: 'fog', name: '雾' },
  48: { code: 'fog', name: '雾凇' },
  51: { code: 'rain', name: '小毛毛雨' },
  53: { code: 'rain', name: '毛毛雨' },
  55: { code: 'heavy-rain', name: '大毛毛雨' },
  61: { code: 'rain', name: '小雨' },
  63: { code: 'rain', name: '中雨' },
  65: { code: 'heavy-rain', name: '大雨' },
  71: { code: 'snow', name: '小雪' },
  73: { code: 'snow', name: '中雪' },
  75: { code: 'snow', name: '大雪' },
  77: { code: 'snow', name: '雪粒' },
  80: { code: 'rain', name: '阵雨' },
  81: { code: 'heavy-rain', name: '阵雨' },
  82: { code: 'heavy-rain', name: '暴雨' },
  85: { code: 'snow', name: '阵雪' },
  86: { code: 'snow', name: '大阵雪' },
  95: { code: 'heavy-rain', name: '雷暴' },
  96: { code: 'heavy-rain', name: '雷暴伴冰雹' },
  99: { code: 'heavy-rain', name: '强雷暴伴冰雹' }
}

// 风向转换
function getWindDirection(deg: number): string {
  const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
  const idx = Math.round(deg / 45) % 8
  return dirs[idx] + '风'
}

interface WeatherData {
  city: string
  temperature: number
  condition: string
  conditionCode: string
  humidity: number
  windSpeed: number
  windDirection: string
  pressure: number
  visibility: number
  uvIndex: number
  feelsLike: number
  forecast: ForecastDay[]
  hourly: HourlyData[]
}

interface ForecastDay {
  day: string
  conditionCode: string
  high: number
  low: number
}

interface HourlyData {
  time: string
  temperature: number
  conditionCode: string
}

const CITIES_STORAGE_KEY = 'ht-os-weather-cities'

// 天气数据缓存（用于侧边栏显示）
const weatherCache: { [city: string]: WeatherData } = {}

// 从 Open-Meteo API 获取真实天气数据
async function fetchWeatherData(city: string): Promise<WeatherData> {
  const coord = CITY_COORDS[city]
  if (!coord) {
    throw new Error(`未找到城市 "${city}" 的坐标`)
  }

  // Open-Meteo API URL
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coord.lat}&longitude=${coord.lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,visibility` +
    `&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&timezone=auto&forecast_days=5`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`天气 API 请求失败: ${response.status}`)
  }
  const data = await response.json()

  // 解析当前天气
  const current = data.current
  const weatherInfo = WEATHER_CODES[current.weather_code] || { code: 'sunny', name: '未知' }

  // 解析每日预报
  const daily = data.daily
  const dayNames = ['今天', '明天', '后天', '大后天', '外后天']
  const forecast: ForecastDay[] = daily.time.map((_: string, i: number) => ({
    day: dayNames[i] || daily.time[i],
    conditionCode: WEATHER_CODES[daily.weather_code[i]]?.code || 'sunny',
    high: Math.round(daily.temperature_2m_max[i]),
    low: Math.round(daily.temperature_2m_min[i])
  }))

  // 解析逐时预报（取未来 12 小时）
  const hourly: HourlyData[] = []
  const now = new Date()
  const currentHour = now.getHours()
  const hourlyTimes = data.hourly.time
  const hourlyTemps = data.hourly.temperature_2m
  const hourlyCodes = data.hourly.weather_code

  for (let i = 0; i < hourlyTimes.length && hourly.length < 12; i++) {
    const timeStr = hourlyTimes[i]
    const h = parseInt(timeStr.split('T')[1])
    if (h >= currentHour || hourly.length > 0) {
      hourly.push({
        time: `${String(h).padStart(2, '0')}:00`,
        temperature: Math.round(hourlyTemps[i]),
        conditionCode: WEATHER_CODES[hourlyCodes[i]]?.code || 'sunny'
      })
    }
    if (hourly.length >= 12) break
  }

  // 如果没有逐时数据，添加默认
  if (hourly.length === 0) {
    for (let i = 0; i < 12; i++) {
      const h = (currentHour + i) % 24
      hourly.push({ time: `${String(h).padStart(2, '0')}:00`, temperature: Math.round(current.temperature_2m), conditionCode: weatherInfo.code })
    }
  }

  // 计算紫外线指数
  const uvIndex = estimateUVIndex(current.weather_code, current.temperature_2m)

  const result: WeatherData = {
    city,
    temperature: Math.round(current.temperature_2m),
    condition: weatherInfo.name,
    conditionCode: weatherInfo.code,
    humidity: Math.round(current.relative_humidity_2m),
    windSpeed: Math.round(current.wind_speed_10m),
    windDirection: getWindDirection(current.wind_direction_10m),
    pressure: Math.round(current.pressure_msl),
    visibility: Math.round((current.visibility || 10000) / 1000),
    uvIndex,
    feelsLike: Math.round(current.apparent_temperature),
    forecast,
    hourly
  }

  // 缓存数据
  weatherCache[city] = result
  return result
}

// 简单的紫外线估算
function estimateUVIndex(weatherCode: number, temp: number): number {
  const baseUV = weatherCode <= 2 ? 6 : weatherCode <= 3 ? 3 : 1
  const tempBonus = temp > 30 ? 2 : temp > 20 ? 1 : 0
  return Math.min(11, baseUV + tempBonus)
}

// 备用：生成模拟数据
function generateMockWeatherData(city: string): WeatherData {
  let seed = 0
  for (let i = 0; i < city.length; i++) {
    seed = (seed * 31 + city.charCodeAt(i)) >>> 0
  }
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }

  const conditions = [
    { code: 'sunny', name: '晴', tempRange: [20, 35] },
    { code: 'cloudy', name: '多云', tempRange: [15, 28] },
    { code: 'overcast', name: '阴', tempRange: [10, 22] },
    { code: 'rain', name: '小雨', tempRange: [12, 20] },
    { code: 'heavy-rain', name: '大雨', tempRange: [14, 22] },
    { code: 'snow', name: '小雪', tempRange: [-5, 2] },
    { code: 'fog', name: '雾', tempRange: [5, 15] }
  ]

  const condIdx = Math.floor(rand() * conditions.length)
  const cond = conditions[condIdx]
  const temp = Math.floor(cond.tempRange[0] + rand() * (cond.tempRange[1] - cond.tempRange[0]))

  const dayNames = ['今天', '明天', '后天', '大后天', '外后天']
  const forecast: ForecastDay[] = dayNames.map((day) => {
    const dCond = conditions[Math.floor(rand() * conditions.length)]
    const high = Math.floor(dCond.tempRange[0] + rand() * (dCond.tempRange[1] - dCond.tempRange[0])) + 2
    const low = high - Math.floor(4 + rand() * 6)
    return { day, conditionCode: dCond.code, high, low }
  })

  const now = new Date()
  const hourly: HourlyData[] = []
  for (let i = 0; i < 12; i++) {
    const h = (now.getHours() + i) % 24
    const hCond = conditions[Math.floor(rand() * 3)]
    const hTemp = temp + Math.floor((rand() - 0.5) * 6)
    hourly.push({ time: `${String(h).padStart(2, '0')}:00`, temperature: hTemp, conditionCode: hCond.code })
  }

  return {
    city,
    temperature: temp,
    condition: cond.name,
    conditionCode: cond.code,
    humidity: Math.floor(40 + rand() * 50),
    windSpeed: Math.floor(1 + rand() * 20),
    windDirection: ['东风', '南风', '西风', '北风'][Math.floor(rand() * 4)],
    pressure: Math.floor(1000 + rand() * 30),
    visibility: Math.floor(5 + rand() * 20),
    uvIndex: Math.floor(rand() * 11),
    feelsLike: temp + (rand() > 0.5 ? 1 : -1) * Math.floor(rand() * 3),
    forecast,
    hourly
  }
}

export function registerWeatherApp(wm: WindowManager): void {
  wm.registerApp({
    id: 'weather',
    name: '天气',
    icon: APP_ICON,
    singleton: true,
    defaultWidth: 880,
    defaultHeight: 640,
    entry: (windowId: string) => {
      const win = wm.getWindow(windowId)
      if (!win) return

      const content = win.content
      content.className = 'weather-app window-content'

      // 修复: loadCities 函数移到使用之前
      function loadCities(): string[] {
        try {
          const saved = localStorage.getItem(CITIES_STORAGE_KEY)
          if (saved) {
            const arr = JSON.parse(saved)
            if (Array.isArray(arr) && arr.length > 0) return arr
          }
        } catch (e) {
          console.warn('[Weather] 加载城市失败:', e)
        }
        return ['北京', '上海', '深圳']
      }

      function saveCities(cities: string[]): void {
        try {
          localStorage.setItem(CITIES_STORAGE_KEY, JSON.stringify(cities))
        } catch (e) {
          console.warn('[Weather] 保存城市失败:', e)
        }
      }

      let savedCities: string[] = loadCities()
      let currentCity = savedCities[0] || '北京'

      content.innerHTML = `
        <div class="weather-container">
          <div class="weather-sidebar">
            <div class="weather-search">
              <span class="weather-search-icon">${SEARCH_ICON}</span>
              <input type="text" id="weather-search-input" placeholder="搜索城市...">
            </div>
            <div class="weather-search-results" id="weather-search-results"></div>
            <div class="weather-cities-section">
              <div class="weather-cities-header">
                <span class="weather-cities-label">收藏的城市</span>
              </div>
              <div class="weather-cities" id="weather-cities"></div>
            </div>
          </div>
          <div class="weather-main" id="weather-main">
            <div class="weather-loading">
              <div class="weather-loading-spinner"></div>
              <div class="weather-loading-text">正在加载天气数据...</div>
            </div>
          </div>
        </div>
      `

      const searchInput = content.querySelector('#weather-search-input') as HTMLInputElement
      const searchResults = content.querySelector('#weather-search-results') as HTMLElement
      const citiesEl = content.querySelector('#weather-cities') as HTMLElement
      const mainEl = content.querySelector('#weather-main') as HTMLElement

      const availableCities = Object.keys(CITY_COORDS)

      function getWeatherIcon(code: string, size: number = 48): string {
        const icons: { [key: string]: string } = {
          sunny: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" fill="#ffb900"/><g stroke="#ffb900" stroke-width="2" stroke-linecap="round"><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="5" y1="5" x2="6.5" y2="6.5"/><line x1="17.5" y1="17.5" x2="19" y2="19"/><line x1="5" y1="19" x2="6.5" y2="17.5"/><line x1="17.5" y2="6.5" x2="19" y2="5"/></g></svg>`,
          cloudy: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><circle cx="8" cy="9" r="4" fill="#ffb900"/><path d="M6 17 a4 4 0 0 1 1-8 a5 5 0 0 1 9 1 a3 3 0 0 1 1 6 z" fill="#b0d4f1" stroke="#87b5d9" stroke-width="0.5"/></svg>`,
          overcast: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M6 17 a4 4 0 0 1 1-8 a5 5 0 0 1 9 1 a3 3 0 0 1 1 6 z" fill="#b0bec5" stroke="#90a4ae" stroke-width="0.5"/><path d="M4 19 h16" stroke="#90a4ae" stroke-width="1" stroke-linecap="round"/></svg>`,
          rain: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M6 13 a4 4 0 0 1 1-8 a5 5 0 0 1 9 1 a3 3 0 0 1 1 6 z" fill="#90a4ae"/><line x1="8" y1="16" x2="7" y2="20" stroke="#4a90d9" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="16" x2="11" y2="20" stroke="#4a90d9" stroke-width="2" stroke-linecap="round"/><line x1="16" y1="16" x2="15" y2="20" stroke="#4a90d9" stroke-width="2" stroke-linecap="round"/></svg>`,
          'heavy-rain': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M6 13 a4 4 0 0 1 1-8 a5 5 0 0 1 9 1 a3 3 0 0 1 1 6 z" fill="#607d8b"/><line x1="7" y1="15" x2="5" y2="21" stroke="#1976d2" stroke-width="2" stroke-linecap="round"/><line x1="10" y1="15" x2="8" y2="21" stroke="#1976d2" stroke-width="2" stroke-linecap="round"/><line x1="13" y1="15" x2="11" y2="21" stroke="#1976d2" stroke-width="2" stroke-linecap="round"/><line x1="16" y1="15" x2="14" y2="21" stroke="#1976d2" stroke-width="2" stroke-linecap="round"/></svg>`,
          snow: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M6 13 a4 4 0 0 1 1-8 a5 5 0 0 1 9 1 a3 3 0 0 1 1 6 z" fill="#e0e0e0"/><g fill="#fff" stroke="#b0bec5" stroke-width="0.5"><circle cx="8" cy="18" r="1"/><circle cx="12" cy="19" r="1"/><circle cx="16" cy="18" r="1"/><circle cx="10" cy="21" r="1"/><circle cx="14" cy="21" r="1"/></g></svg>`,
          fog: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#90a4ae" stroke-width="1.5" stroke-linecap="round"><line x1="3" y1="8" x2="21" y2="8"/><line x1="5" y1="12" x2="19" y2="12"/><line x1="3" y1="16" x2="21" y2="16"/><line x1="5" y1="20" x2="17" y2="20"/></svg>`
        }
        return icons[code] || icons.sunny
      }

      function uvLevel(uv: number): string {
        if (uv <= 2) return '弱'
        if (uv <= 5) return '中等'
        if (uv <= 7) return '强'
        if (uv <= 10) return '很强'
        return '极强'
      }

      // 根据天气状况获取背景渐变
      function getWeatherGradient(code: string): string {
        const gradients: { [key: string]: string } = {
          sunny: 'linear-gradient(180deg, #ffd54f 0%, #ffb74d 50%, #ff8a65 100%)',
          cloudy: 'linear-gradient(180deg, #90caf9 0%, #64b5f6 50%, #42a5f5 100%)',
          overcast: 'linear-gradient(180deg, #b0bec5 0%, #90a4ae 50%, #78909c 100%)',
          rain: 'linear-gradient(180deg, #7986cb 0%, #5c6bc0 50%, #3f51b5 100%)',
          'heavy-rain': 'linear-gradient(180deg, #546e7a 0%, #455a64 50%, #37474f 100%)',
          snow: 'linear-gradient(180deg, #b3e5fc 0%, #81d4fa 50%, #4fc3f7 100%)',
          fog: 'linear-gradient(180deg, #cfd8dc 0%, #b0bec5 50%, #90a4ae 100%)'
        }
        return gradients[code] || gradients.sunny
      }

      async function renderMain(city: string): Promise<void> {
        mainEl.innerHTML = `
          <div class="weather-loading">
            <div class="weather-loading-spinner"></div>
            <div class="weather-loading-text">正在加载天气数据...</div>
          </div>
        `

        let data: WeatherData
        let isMockData = false

        try {
          data = await fetchWeatherData(city)
        } catch (error) {
          console.warn('[Weather] 获取真实天气失败，使用模拟数据:', error)
          isMockData = true
          data = generateMockWeatherData(city)
        }

        // 缓存数据用于侧边栏
        weatherCache[city] = data

        const now = new Date()
        const dateStr = now.toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long'
        })
        const isFavorite = savedCities.includes(city)

        mainEl.innerHTML = `
          <div class="weather-main-content" style="background: ${getWeatherGradient(data.conditionCode)};">
            <div class="weather-header">
              <div class="weather-city-info">
                <div class="weather-city-name">
                  ${LOCATION_ICON}
                  ${city}
                </div>
                <div class="weather-date">${dateStr}</div>
              </div>
              <div class="weather-actions">
                <button class="weather-action-btn" id="weather-fav-btn" title="${isFavorite ? '取消收藏' : '收藏城市'}">
                  ${isFavorite ? STAR_FILLED_ICON : STAR_ICON}
                </button>
                <button class="weather-action-btn" id="weather-refresh-btn" title="刷新">${REFRESH_ICON}</button>
              </div>
            </div>
            
            <div class="weather-current">
              <div class="weather-current-icon">${getWeatherIcon(data.conditionCode, 96)}</div>
              <div class="weather-current-info">
                <div class="weather-current-temp">${data.temperature}°</div>
                <div class="weather-current-cond">${data.condition}</div>
                <div class="weather-current-feel">体感温度 ${data.feelsLike}°</div>
              </div>
            </div>

            <div class="weather-details">
              <div class="weather-detail-card">
                <div class="detail-icon">💧</div>
                <div class="detail-info">
                  <div class="detail-label">湿度</div>
                  <div class="detail-value">${data.humidity}%</div>
                </div>
              </div>
              <div class="weather-detail-card">
                <div class="detail-icon">🌬️</div>
                <div class="detail-info">
                  <div class="detail-label">${data.windDirection}</div>
                  <div class="detail-value">${data.windSpeed} km/h</div>
                </div>
              </div>
              <div class="weather-detail-card">
                <div class="detail-icon">📊</div>
                <div class="detail-info">
                  <div class="detail-label">气压</div>
                  <div class="detail-value">${data.pressure}</div>
                  <div class="detail-unit">hPa</div>
                </div>
              </div>
              <div class="weather-detail-card">
                <div class="detail-icon">👁️</div>
                <div class="detail-info">
                  <div class="detail-label">能见度</div>
                  <div class="detail-value">${data.visibility}</div>
                  <div class="detail-unit">km</div>
                </div>
              </div>
              <div class="weather-detail-card">
                <div class="detail-icon">☀️</div>
                <div class="detail-info">
                  <div class="detail-label">紫外线</div>
                  <div class="detail-value">${data.uvIndex}</div>
                  <div class="detail-unit">${uvLevel(data.uvIndex)}</div>
                </div>
              </div>
            </div>

            <div class="weather-section weather-hourly-section">
              <div class="weather-section-title">逐时预报</div>
              <div class="weather-hourly" id="weather-hourly"></div>
            </div>

            <div class="weather-section weather-forecast-section">
              <div class="weather-section-title">${savedCities.length > 1 ? '多日预报' : '5 天预报'}</div>
              <div class="weather-forecast" id="weather-forecast"></div>
            </div>

            ${isMockData ? '<div class="weather-source-note">⚠️ 当前显示为模拟数据，天气 API 暂时不可用</div>' : ''}
          </div>
        `

        // 渲染逐时预报
        const hourlyEl = mainEl.querySelector('#weather-hourly') as HTMLElement
        data.hourly.forEach(h => {
          const item = document.createElement('div')
          item.className = 'hourly-item'
          item.innerHTML = `
            <div class="hourly-time">${h.time}</div>
            <div class="hourly-icon">${getWeatherIcon(h.conditionCode, 24)}</div>
            <div class="hourly-temp">${h.temperature}°</div>
          `
          hourlyEl.appendChild(item)
        })

        // 渲染预报
        const forecastEl = mainEl.querySelector('#weather-forecast') as HTMLElement
        data.forecast.forEach(f => {
          const item = document.createElement('div')
          item.className = 'forecast-item'
          item.innerHTML = `
            <div class="forecast-day">${f.day}</div>
            <div class="forecast-icon">${getWeatherIcon(f.conditionCode, 28)}</div>
            <div class="forecast-bar">
              <div class="forecast-bar-fill" style="left: ${(f.low + 10) * 2}%; right: ${(40 - f.high) * 2}%;"></div>
            </div>
            <div class="forecast-temp">
              <span class="forecast-low">${f.low}°</span>
              <span class="forecast-high">${f.high}°</span>
            </div>
          `
          forecastEl.appendChild(item)
        })

        // 收藏按钮
        const favBtn = mainEl.querySelector('#weather-fav-btn') as HTMLButtonElement
        favBtn.addEventListener('click', () => {
          if (savedCities.includes(city)) {
            savedCities = savedCities.filter(c => c !== city)
          } else {
            savedCities.push(city)
          }
          saveCities(savedCities)
          renderCities()
          renderMain(city)
        })

        // 刷新按钮
        const refreshBtn = mainEl.querySelector('#weather-refresh-btn') as HTMLButtonElement
        refreshBtn.addEventListener('click', () => {
          delete weatherCache[city]
          renderMain(city)
        })
      }

      // 渲染侧边栏城市列表 - 使用缓存的真实数据
      function renderCities(): void {
        citiesEl.innerHTML = ''
        if (savedCities.length === 0) {
          citiesEl.innerHTML = '<div class="weather-no-cities">暂无收藏的城市<br><small>点击搜索添加</small></div>'
          return
        }
        savedCities.forEach(city => {
          const item = document.createElement('div')
          item.className = `weather-city-item ${city === currentCity ? 'active' : ''}`

          // 使用缓存数据或显示加载中
          const cached = weatherCache[city]
          if (cached) {
            item.innerHTML = `
              <div class="city-item-icon">${getWeatherIcon(cached.conditionCode, 22)}</div>
              <div class="city-item-info">
                <div class="city-item-name">${city}</div>
                <div class="city-item-cond">${cached.condition}</div>
              </div>
              <div class="city-item-temp">${cached.temperature}°</div>
            `
          } else {
            item.innerHTML = `
              <div class="city-item-icon">${getWeatherIcon('sunny', 22)}</div>
              <div class="city-item-info">
                <div class="city-item-name">${city}</div>
                <div class="city-item-cond">加载中...</div>
              </div>
              <div class="city-item-temp">--°</div>
            `
            // 异步加载城市天气数据
            fetchWeatherData(city).then(() => {
              renderCities() // 重新渲染
            }).catch(() => {
              // 加载失败，显示模拟数据
              weatherCache[city] = generateMockWeatherData(city)
              renderCities()
            })
          }

          item.addEventListener('click', () => {
            currentCity = city
            renderCities()
            renderMain(city)
          })
          citiesEl.appendChild(item)
        })
      }

      searchInput.addEventListener('input', () => {
        const keyword = searchInput.value.trim()
        if (!keyword) {
          searchResults.innerHTML = ''
          searchResults.style.display = 'none'
          return
        }
        const matches = availableCities
          .filter(c => c.includes(keyword) && !savedCities.includes(c))
          .slice(0, 8)
        if (matches.length === 0) {
          searchResults.innerHTML = '<div class="search-result-empty">无匹配城市</div>'
          searchResults.style.display = 'block'
          return
        }
        searchResults.innerHTML = matches
          .map(c => `<div class="search-result-item" data-city="${c}">${LOCATION_ICON} ${c}</div>`)
          .join('')
        searchResults.style.display = 'block'

        searchResults.querySelectorAll('.search-result-item').forEach(item => {
          item.addEventListener('click', () => {
            const city = item.getAttribute('data-city')
            if (city) {
              currentCity = city
              if (!savedCities.includes(city)) {
                savedCities.push(city)
                saveCities(savedCities)
              }
              searchInput.value = ''
              searchResults.innerHTML = ''
              searchResults.style.display = 'none'
              renderCities()
              renderMain(city)
            }
          })
        })
      })

      searchInput.addEventListener('blur', () => {
        setTimeout(() => {
          searchResults.style.display = 'none'
        }, 200)
      })
      searchInput.addEventListener('focus', () => {
        if (searchResults.innerHTML) searchResults.style.display = 'block'
      })

      const ctxMenu = new ContextMenu()
      content.addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault()
        ctxMenu.show(e.clientX, e.clientY, [
          {
            label: '刷新天气',
            action: () => {
              delete weatherCache[currentCity]
              renderMain(currentCity)
            }
          },
          { separator: true },
          {
            label: '切换城市',
            action: async () => {
              const city = await dialog.prompt('请输入城市名称：', currentCity)
              if (city && city.trim()) {
                const trimmed = city.trim()
                if (CITY_COORDS[trimmed]) {
                  currentCity = trimmed
                  if (!savedCities.includes(trimmed)) {
                    savedCities.push(trimmed)
                    saveCities(savedCities)
                  }
                  renderCities()
                  renderMain(trimmed)
                } else {
                  await dialog.alert(`未找到城市"${trimmed}"，请选择以下城市之一：\n${availableCities.join('、')}`)
                }
              }
            }
          }
        ])
      })

      // 初始渲染
      renderCities()
      renderMain(currentCity)
    }
  })
}

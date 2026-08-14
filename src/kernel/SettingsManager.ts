// ============================================================
// 设置管理器 - 使用 localStorage + Cookie 双重持久化
// ============================================================

import type { SystemSettings, QualitySettings } from './types'

export class SettingsManager {
  private static STORAGE_KEY = 'ht-os-settings'
  private static COOKIE_KEY = 'ht-os-prefs'
  private settings: SystemSettings

  constructor() {
    this.settings = this.load()
  }

  private defaultSettings(): SystemSettings {
    return {
      wallpaper: 'default',
      lockWallpaper: 'lock-default',
      themeColor: '#0078d4',
      userName: '',
      password: '',
      brightness: 100,
      volume: 50,
      quality: {
        mode: 'off',
        sharpness: 0,
        frameInterpolation: 'off',
        animationSpeed: 1
      },
      resolution: 1080,
      oobeCompleted: false,
      uacLevel: 'medium'
    }
  }

  private load(): SystemSettings {
    const defaults = this.defaultSettings()
    let saved: string | null = null

    try {
      saved = localStorage.getItem(SettingsManager.STORAGE_KEY)
    } catch (e) {
      console.warn('[SettingsManager] localStorage 读取失败:', e)
    }

    if (!saved) {
      saved = this.getCookie(SettingsManager.COOKIE_KEY)
    }

    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return {
          ...defaults,
          ...parsed,
          quality: { ...defaults.quality, ...(parsed.quality || {}) }
        }
      } catch (e) {
        console.warn('[SettingsManager] 解析设置失败:', e)
      }
    }

    return defaults
  }

  save(): void {
    const json = JSON.stringify(this.settings)
    try {
      localStorage.setItem(SettingsManager.STORAGE_KEY, json)
    } catch (e) {
      console.warn('[SettingsManager] localStorage 保存失败:', e)
    }
    this.setCookie(SettingsManager.COOKIE_KEY, json, 365)
  }

  private getCookie(name: string): string | null {
    try {
      const match = document.cookie.match(new RegExp('(?:^| )' + name + '=([^;]+)'))
      return match ? decodeURIComponent(match[1]) : null
    } catch (e) {
      return null
    }
  }

  private setCookie(name: string, value: string, days: number): void {
    try {
      const expires = new Date()
      expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
      document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + expires.toUTCString() + ';path=/'
    } catch (e) {
      // cookie 设置失败不影响主流程
    }
  }

  getAll(): SystemSettings {
    return { ...this.settings, quality: { ...this.settings.quality } }
  }

  get<K extends keyof SystemSettings>(key: K): SystemSettings[K] {
    return this.settings[key]
  }

  set<K extends keyof SystemSettings>(key: K, value: SystemSettings[K]): void {
    this.settings[key] = value
    this.save()
  }

  getQuality(): QualitySettings {
    return { ...this.settings.quality }
  }

  setQuality(quality: Partial<QualitySettings>): void {
    this.settings.quality = { ...this.settings.quality, ...quality }
    this.save()
  }
}

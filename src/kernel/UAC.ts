// ============================================================
// UAC 用户账户控制 - 执行敏感操作前弹出确认对话框
// 类似 Windows UAC 提示
// 警戒级别由设置中的 uacLevel 控制：
//   high   - 始终提示
//   medium - 提示（默认）
//   low    - 不提示，自动放行
// ============================================================

import { EventLog } from './EventLog'
import { NotificationService } from './NotificationService'
import { SettingsManager } from './SettingsManager'
import type { EventBus } from './EventBus'

export interface UACRequest {
  operation: string
  resource: string
  // 操作来源应用
  source: string
}

/** UAC 请求事件名 */
export const UAC_EVENT = 'uac:request'

/**
 * 通过 EventBus 请求 UAC 权限（异步）。
 * 应用无需直接持有 UAC 实例，只需导入此函数即可。
 */
export function requestUac(eventBus: EventBus, req: UACRequest): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let resolved = false
    const callback = (allowed: boolean) => {
      if (!resolved) { resolved = true; resolve(allowed) }
    }
    eventBus.emit(UAC_EVENT, req, callback)
    // 安全兜底：60 秒后自动拒绝
    setTimeout(() => callback(false), 60000)
  })
}

/** 在 EventBus 上注册 UAC 监听器，将请求转发给 UAC 实例 */
export function bindUacToEventBus(eventBus: EventBus, uac: UAC): void {
  eventBus.on(UAC_EVENT, (req: UACRequest, callback: (allowed: boolean) => void) => {
    uac.request(req).then(callback)
  })
}

export class UAC {
  private eventLog: EventLog
  private notifications: NotificationService
  private settings: SettingsManager

  constructor(eventLog: EventLog, notifications: NotificationService, settings: SettingsManager) {
    this.eventLog = eventLog
    this.notifications = notifications
    this.settings = settings
  }

  // 请求权限：返回 true 表示用户允许，false 表示拒绝
  async request(req: UACRequest): Promise<boolean> {
    const level = this.settings.get('uacLevel')

    // low 级别：不提示，自动放行
    if (level === 'low') {
      return true
    }

    // high 或 medium：弹出 UAC 对话框
    this.eventLog.security('UAC', `请求权限: ${req.operation} - ${req.resource}（来自 ${req.source}）`)

    const allowed = await this.showUacDialog(req)
    if (allowed) {
      this.eventLog.security('UAC', `用户已允许: ${req.operation} - ${req.resource}`)
    } else {
      this.eventLog.security('UAC', `用户已拒绝: ${req.operation} - ${req.resource}`)
      this.notifications.notify('UAC', '操作已取消', `${req.operation} 被用户拒绝`, 'warning')
    }
    return allowed
  }

  /** 获取当前 UAC 警戒级别的文本描述 */
  getLevelInfo(): { name: string; description: string } {
    const level = this.settings.get('uacLevel')
    switch (level) {
      case 'high':
        return { name: '高', description: '始终提示，所有敏感操作都需要确认' }
      case 'medium':
        return { name: '中', description: '默认级别，敏感操作需要确认' }
      case 'low':
        return { name: '低', description: '不提示，自动允许所有操作' }
    }
  }

  // 弹出 UAC 对话框
  private showUacDialog(req: UACRequest): Promise<boolean> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div')
      overlay.className = 'ht-dialog-overlay uac-overlay'
      overlay.style.zIndex = '200000'

      const userName = this.settings.get('userName') || '管理员'
      const firstLetter = userName.charAt(0).toUpperCase() || 'U'

      const dlg = document.createElement('div')
      dlg.className = 'ht-dialog-box uac-dialog'
      dlg.style.width = '420px'

      dlg.innerHTML = `
        <div class="uac-header">
          <div class="uac-shield">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#0078d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div class="uac-title-area">
            <div class="uac-app-name">${this.escapeHtml(req.source)}</div>
            <div class="uac-prompt">要允许此应用对你的设备进行更改吗？</div>
          </div>
        </div>
        <div class="uac-body">
          <div class="uac-user">
            <div class="uac-avatar">${firstLetter}</div>
            <div class="uac-user-info">
              <div class="uac-user-name">${this.escapeHtml(userName)}</div>
              <div class="uac-user-type">管理员</div>
            </div>
          </div>
          <div class="uac-detail">
            <div class="uac-detail-row">
              <span class="uac-detail-label">操作：</span>
              <span class="uac-detail-value">${this.escapeHtml(req.operation)}</span>
            </div>
            <div class="uac-detail-row">
              <span class="uac-detail-label">对象：</span>
              <span class="uac-detail-value">${this.escapeHtml(req.resource)}</span>
            </div>
          </div>
        </div>
        <div class="ht-dialog-footer">
          <button class="ht-dialog-btn ht-dialog-btn-cancel" id="uac-no">否</button>
          <button class="ht-dialog-btn ht-dialog-btn-primary" id="uac-yes">是</button>
        </div>
      `

      overlay.appendChild(dlg)
      document.body.appendChild(overlay)

      requestAnimationFrame(() => overlay.classList.add('visible'))

      const close = (result: boolean) => {
        overlay.classList.remove('visible')
        setTimeout(() => overlay.remove(), 200)
        resolve(result)
      }

      dlg.querySelector('#uac-yes')!.addEventListener('click', () => close(true))
      dlg.querySelector('#uac-no')!.addEventListener('click', () => close(false))
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close(false)
      })
    })
  }

  private escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]!))
  }
}
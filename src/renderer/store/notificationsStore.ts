import { create } from 'zustand'

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message?: string
  duration?: number
  dismissed?: boolean
  timestamp: number
}

interface NotificationsState {
  notifications: Notification[]
  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'dismissed'>) => string
  dismissNotification: (id: string) => void
  clearNotifications: () => void
}

const generateId = () => crypto.randomUUID?.() ?? Date.now().toString(36)

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  addNotification: (n) => {
    const id = generateId()
    const notification: Notification = { ...n, id, timestamp: Date.now(), dismissed: false }
    set((state) => ({ notifications: [...state.notifications, notification] }))
    const duration = n.duration ?? 4000
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.map((nn) =>
            nn.id === id ? { ...nn, dismissed: true } : nn
          ),
        }))
        setTimeout(() => {
          set((state) => ({
            notifications: state.notifications.filter((nn) => nn.id !== id),
          }))
        }, 300)
      }, duration)
    }
    return id
  },
  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
  clearNotifications: () => set({ notifications: [] }),
}))

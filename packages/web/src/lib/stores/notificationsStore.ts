import { writable, derived } from 'svelte/store';
import type { Notification } from '$types';

const MAX_NOTIFICATIONS = 5;
const DEFAULT_DURATION = 5000;

const notifications = writable<Notification[]>([]);

function add(type: Notification['type'], title: string, message?: string, duration?: number) {
  const id = crypto.randomUUID();
  const notification: Notification = { id, type, title, message, duration: duration ?? DEFAULT_DURATION, timestamp: new Date() };

  notifications.update(n => [notification, ...n].slice(0, MAX_NOTIFICATIONS * 2));

  if (type !== 'error' && notification.duration > 0) {
    setTimeout(() => dismiss(id), notification.duration);
  }
  return id;
}

function dismiss(id: string) {
  notifications.update(n => n.filter(x => x.id !== id));
}

function clear() {
  notifications.set([]);
}

const active = derived(notifications, $n => $n.slice(0, MAX_NOTIFICATIONS));

export const notify = {
  success: (title: string, message?: string) => add('success', title, message),
  error: (title: string, message?: string) => add('error', title, message, 0),
  warning: (title: string, message?: string) => add('warning', title, message, 8000),
  info: (title: string, message?: string) => add('info', title, message)
};

export const notificationsStore = { subscribe: notifications.subscribe, notifications, active, dismiss, clear, add: notify };

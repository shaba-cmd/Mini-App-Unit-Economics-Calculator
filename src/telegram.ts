/**
 * Тонкая обёртка над window.Telegram.WebApp.
 *
 * Приложение работает и в обычном браузере (для разработки): все вызовы
 * безопасно превращаются в no-op, а вместо MainButton/BackButton
 * показываются обычные кнопки на странице.
 */
import { useEffect, useRef } from 'react';

type HapticImpact = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type HapticNotification = 'error' | 'success' | 'warning';

interface BottomButton {
  setText(text: string): BottomButton;
  show(): BottomButton;
  hide(): BottomButton;
  enable(): BottomButton;
  onClick(cb: () => void): BottomButton;
  offClick(cb: () => void): BottomButton;
}

interface BackButton {
  show(): BackButton;
  hide(): BackButton;
  onClick(cb: () => void): BackButton;
  offClick(cb: () => void): BackButton;
}

type StorageCallback<T> = (error: string | null, result?: T) => void;

export interface TelegramCloudStorage {
  setItem(key: string, value: string, cb?: StorageCallback<boolean>): void;
  getItem(key: string, cb: StorageCallback<string>): void;
  getItems(keys: string[], cb: StorageCallback<Record<string, string>>): void;
  removeItem(key: string, cb?: StorageCallback<boolean>): void;
  getKeys(cb: StorageCallback<string[]>): void;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: { first_name?: string } };
  platform: string;
  version: string;
  colorScheme: 'light' | 'dark';
  isVersionAtLeast(version: string): boolean;
  ready(): void;
  expand(): void;
  openLink(url: string): void;
  showAlert(message: string, cb?: () => void): void;
  showConfirm(message: string, cb: (ok: boolean) => void): void;
  MainButton: BottomButton;
  BackButton: BackButton;
  HapticFeedback?: {
    impactOccurred(style: HapticImpact): void;
    notificationOccurred(type: HapticNotification): void;
    selectionChanged(): void;
  };
  CloudStorage?: TelegramCloudStorage;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

function webApp(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp;
}

/** true, если приложение открыто внутри Telegram, а не в обычном браузере. */
export function isInTelegram(): boolean {
  const app = webApp();
  return Boolean(app && app.platform && app.platform !== 'unknown');
}

function supports(version: string): boolean {
  const app = webApp();
  return Boolean(isInTelegram() && app?.isVersionAtLeast(version));
}

/** Вызывается один раз при загрузке: сообщает Telegram, что приложение готово, и раскрывает его на весь экран. */
export function initTelegram(): void {
  const app = webApp();
  if (!app || !isInTelegram()) {
    document.documentElement.dataset.env = 'browser';
    return;
  }
  document.documentElement.dataset.env = 'telegram';
  app.ready();
  app.expand();
}

/** Имя пользователя для приветствия. Другие данные пользователя не используются. */
export function getUserFirstName(): string | undefined {
  if (!isInTelegram()) return undefined;
  return webApp()?.initDataUnsafe.user?.first_name || undefined;
}

export function openLink(url: string): void {
  const app = webApp();
  if (isInTelegram() && app) app.openLink(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

export function confirmAction(message: string): Promise<boolean> {
  const app = webApp();
  if (supports('6.2') && app) {
    return new Promise((resolve) => app.showConfirm(message, resolve));
  }
  return Promise.resolve(window.confirm(message));
}

export const haptic = {
  impact(style: HapticImpact = 'light') {
    if (supports('6.1')) webApp()?.HapticFeedback?.impactOccurred(style);
  },
  success() {
    if (supports('6.1')) webApp()?.HapticFeedback?.notificationOccurred('success');
  },
  error() {
    if (supports('6.1')) webApp()?.HapticFeedback?.notificationOccurred('error');
  },
  selection() {
    if (supports('6.1')) webApp()?.HapticFeedback?.selectionChanged();
  },
};

export function getCloudStorage(): TelegramCloudStorage | undefined {
  return supports('6.9') ? webApp()?.CloudStorage : undefined;
}

/**
 * Показывает MainButton Telegram с текстом и обработчиком, пока компонент
 * смонтирован. Обработчик хранится в ref, чтобы не переподписываться
 * на каждый рендер.
 */
export function useMainButton(text: string | null, onClick: () => void): void {
  const handler = useRef(onClick);
  handler.current = onClick;

  useEffect(() => {
    const app = webApp();
    if (!app || !isInTelegram() || text === null) return;
    const listener = () => handler.current();
    app.MainButton.setText(text).enable().show();
    app.MainButton.onClick(listener);
    return () => {
      app.MainButton.offClick(listener);
      app.MainButton.hide();
    };
  }, [text]);
}

/** Показывает BackButton Telegram, пока передан обработчик. */
export function useBackButton(onBack: (() => void) | null): void {
  const handler = useRef(onBack);
  handler.current = onBack;
  const visible = onBack !== null;

  useEffect(() => {
    const app = webApp();
    if (!app || !visible || !supports('6.1')) return;
    const listener = () => handler.current?.();
    app.BackButton.onClick(listener);
    app.BackButton.show();
    return () => {
      app.BackButton.offClick(listener);
      app.BackButton.hide();
    };
  }, [visible]);
}

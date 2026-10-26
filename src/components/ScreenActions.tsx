import { isInTelegram, useBackButton, useMainButton } from '../telegram';

interface ScreenActionsProps {
  /** Текст главной кнопки; null — кнопка не нужна */
  mainText?: string | null;
  onMain?: () => void;
  onBack?: (() => void) | null;
}

/**
 * Главная кнопка и «Назад» экрана. В Telegram — нативные MainButton и
 * BackButton, в обычном браузере — кнопки на странице.
 */
export function ScreenActions({ mainText = null, onMain, onBack = null }: ScreenActionsProps) {
  useMainButton(mainText, () => onMain?.());
  useBackButton(onBack);

  if (isInTelegram() || !mainText) return null;
  return (
    <div className="bottom-bar">
      <button type="button" className="btn" onClick={onMain}>
        {mainText}
      </button>
    </div>
  );
}

export function BrowserBackLink({ onBack }: { onBack: () => void }) {
  if (isInTelegram()) return null;
  return (
    <button type="button" className="back-link" onClick={onBack}>
      ← Назад
    </button>
  );
}

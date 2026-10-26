import { useCallback, useEffect, useState } from 'react';
import { calculate } from '../calc';
import { BrowserBackLink, ScreenActions } from '../components/ScreenActions';
import { hasErrors, toCalcInput, validateForm } from '../form';
import { formatDate, formatMoney, formatPercent } from '../format';
import { getSavedRepository, MAX_SAVED, SavedLimitError, type SavedCalc } from '../storage';
import { confirmAction, haptic } from '../telegram';

interface SavedScreenProps {
  onOpen: (item: SavedCalc) => void;
  onBack: () => void;
}

const MARKETPLACE_LABEL = { wb: 'WB', ozon: 'Ozon' } as const;

export function SavedScreen({ onOpen, onBack }: SavedScreenProps) {
  const [items, setItems] = useState<SavedCalc[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setItems(await getSavedRepository().list());
    } catch (e) {
      console.error(e);
      setItems([]);
      setError('Не удалось загрузить сохранённые расчёты. Попробуйте ещё раз.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const remove = async (item: SavedCalc) => {
    if (!(await confirmAction(`Удалить «${item.name}»?`))) return;
    try {
      await getSavedRepository().remove(item.id);
      haptic.impact('medium');
      setError(null);
      await reload();
    } catch (e) {
      console.error(e);
      setError('Не удалось удалить расчёт. Попробуйте ещё раз.');
    }
  };

  const duplicate = async (item: SavedCalc) => {
    try {
      await getSavedRepository().duplicate(item);
      haptic.success();
      setError(null);
      await reload();
    } catch (e) {
      if (!(e instanceof SavedLimitError)) console.error(e);
      haptic.error();
      setError(e instanceof SavedLimitError ? e.message : 'Не удалось создать копию. Попробуйте ещё раз.');
    }
  };

  return (
    <>
      <header className="screen-header">
        <BrowserBackLink onBack={onBack} />
        <h1>Мои товары</h1>
        {items && items.length > 0 && (
          <span className="muted">
            {items.length} из {MAX_SAVED}
          </span>
        )}
      </header>

      {error && <div className="notice error">{error}</div>}

      <section className="section">
        {items === null && <p className="empty">Загружаем…</p>}
        {items?.length === 0 && (
          <p className="empty">
            Пока ничего не сохранено.
            <br />
            Посчитайте товар и нажмите «Сохранить».
          </p>
        )}
        {items?.map((item) => {
          const valid = !hasErrors(validateForm(item.form));
          const result = valid ? calculate(toCalcInput(item.form)) : null;
          return (
            <article key={item.id} className="saved-item">
              <div className="saved-head">
                <div>
                  <div className="saved-name">{item.name}</div>
                  <div className="saved-meta">
                    {MARKETPLACE_LABEL[item.form.marketplace]} · {formatDate(item.updatedAt)}
                  </div>
                </div>
                {result && (
                  <div style={{ textAlign: 'right' }}>
                    <div className={`saved-profit ${result.status}`}>{formatMoney(result.profit)}</div>
                    <div className="saved-meta">маржа {formatPercent(result.marginPct)}</div>
                  </div>
                )}
              </div>
              <div className="saved-actions">
                <button type="button" className="btn" onClick={() => onOpen(item)}>
                  Открыть
                </button>
                <button type="button" className="btn" onClick={() => void duplicate(item)}>
                  Копия
                </button>
                <button type="button" className="btn btn-danger" onClick={() => void remove(item)}>
                  Удалить
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <ScreenActions onBack={onBack} />
    </>
  );
}

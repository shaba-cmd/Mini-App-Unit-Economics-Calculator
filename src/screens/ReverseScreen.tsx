import { calculateBatch, priceForMargin, priceForProfit, type CalcInput, type PriceResult } from '../calc';
import { NumberField } from '../components/NumberField';
import { BrowserBackLink, ScreenActions } from '../components/ScreenActions';
import { Segmented } from '../components/Segmented';
import { parseNumber } from '../form';
import { formatInt, formatMoney } from '../format';

export type TargetMode = 'margin' | 'profit';

export interface ReverseState {
  mode: TargetMode;
  target: string;
  quantity: string;
}

export const DEFAULT_REVERSE: ReverseState = { mode: 'margin', target: '20', quantity: '100' };

interface ReverseScreenProps {
  state: ReverseState;
  onChange: (state: ReverseState) => void;
  /** Входные данные с экрана расчёта; null — там есть ошибки */
  input: CalcInput | null;
  /** Цена с экрана расчёта корректна и можно считать партию */
  hasPrice: boolean;
  onApplyPrice: (price: number) => void;
  onBack: () => void;
}

function validateTarget(mode: TargetMode, raw: string): string | undefined {
  if (raw.trim() === '') return mode === 'margin' ? 'Введите желаемую маржу' : 'Введите желаемую прибыль';
  const value = parseNumber(raw);
  if (value === null) return 'Введите число, например 20 или 12,5';
  if (value < 0) return 'Значение не может быть отрицательным';
  if (mode === 'margin' && value >= 100) return 'Маржа должна быть меньше 100%';
  return undefined;
}

function validateQuantity(raw: string): string | undefined {
  if (raw.trim() === '') return 'Введите размер партии';
  const value = parseNumber(raw);
  if (value === null || !Number.isInteger(value)) return 'Введите целое число штук';
  if (value <= 0) return 'Партия должна быть больше нуля';
  if (value > 1_000_000) return 'Слишком большая партия';
  return undefined;
}

export function ReverseScreen({ state, onChange, input, hasPrice, onApplyPrice, onBack }: ReverseScreenProps) {
  const targetError = validateTarget(state.mode, state.target);
  const quantityError = validateQuantity(state.quantity);

  let priceResult: PriceResult | null = null;
  if (input && !targetError) {
    const target = parseNumber(state.target) ?? 0;
    priceResult = state.mode === 'margin' ? priceForMargin(input, target) : priceForProfit(input, target);
  }

  const batch = input && hasPrice && !quantityError ? calculateBatch(input, parseNumber(state.quantity) ?? 0) : null;

  return (
    <>
      <header className="screen-header">
        <BrowserBackLink onBack={onBack} />
        <h1>Обратный расчёт</h1>
      </header>

      {!input && (
        <div className="notice error">
          Сначала заполните себестоимость и расходы на экране расчёта.{' '}
          <button type="button" className="inline-link" style={{ margin: 0, minHeight: 0 }} onClick={onBack}>
            Перейти к расчёту
          </button>
        </div>
      )}

      <h2 className="section-title">Цена под цель</h2>
      <section className="section">
        <Segmented<TargetMode>
          label="Что задаём"
          value={state.mode}
          options={[
            { value: 'margin', label: 'Маржа, %' },
            { value: 'profit', label: 'Прибыль, ₽' },
          ]}
          onChange={(mode) => onChange({ ...state, mode })}
        />
        <NumberField
          label={state.mode === 'margin' ? 'Желаемая маржинальность' : 'Желаемая прибыль с единицы'}
          suffix={state.mode === 'margin' ? '%' : '₽'}
          placeholder=""
          value={state.target}
          error={state.target.trim() === '' ? undefined : targetError}
          onChange={(target) => onChange({ ...state, target })}
        />
        {priceResult && (
          <div className="result-line">
            <span>Рекомендованная цена</span>
            <span className="value big">{priceResult.ok ? formatMoney(Math.ceil(priceResult.price)) : '—'}</span>
          </div>
        )}
        {priceResult && !priceResult.ok && (
          <p className="field-error">
            {priceResult.reason === 'zero_buyout'
              ? 'Процент выкупа равен нулю — цену посчитать нельзя.'
              : 'При таких процентах целевая маржа недостижима: комиссия, реклама, налог и маржа вместе дают 100% и больше.'}
          </p>
        )}
        {priceResult?.ok && (
          <button type="button" className="inline-link" onClick={() => onApplyPrice(Math.ceil(priceResult.price))}>
            Подставить цену в расчёт →
          </button>
        )}
      </section>

      <h2 className="section-title">Партия</h2>
      <section className="section">
        <NumberField
          label="Размер партии"
          hint="Сколько штук закупаете"
          suffix="шт."
          integer
          placeholder=""
          value={state.quantity}
          error={state.quantity.trim() === '' ? undefined : quantityError}
          onChange={(quantity) => onChange({ ...state, quantity })}
        />
        {input && !hasPrice && <p className="muted">Укажите цену продажи на экране расчёта, чтобы посчитать партию.</p>}
        {batch && (
          <>
            <div className="result-line">
              <span>Вложения в закупку</span>
              <span className="value">{formatMoney(batch.investment)}</span>
            </div>
            <div className="result-line">
              <span>Прибыль с партии</span>
              <span className="value big">{formatMoney(batch.batchProfit)}</span>
            </div>
            <div className="result-line">
              <span>Точка безубыточности</span>
              <span className="value">
                {batch.breakEvenUnits === null ? 'не достигается' : `${formatInt(batch.breakEvenUnits)} шт.`}
              </span>
            </div>
            <p className="muted">
              {batch.breakEvenUnits === null
                ? 'Продажа одной штуки не покрывает даже её закупку — вложения не вернутся.'
                : batch.paysBackWithinBatch
                  ? `Чтобы вернуть вложения, нужно продать ${formatInt(batch.breakEvenUnits)} из ${formatInt(batch.quantity)} шт.`
                  : 'Партия не окупается полностью: продайте больше или поднимите цену.'}
            </p>
          </>
        )}
      </section>

      <ScreenActions onBack={onBack} />
    </>
  );
}

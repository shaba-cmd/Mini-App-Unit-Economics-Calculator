import type { CalcResult, CalcWarning } from '../calc';
import { BreakdownBar } from '../components/BreakdownBar';
import { ResultSummary } from '../components/ResultSummary';
import { BrowserBackLink, ScreenActions } from '../components/ScreenActions';
import { formatMoney, formatPercent } from '../format';

const WARNING_TEXT: Record<CalcWarning, string> = {
  zero_buyout: 'Процент выкупа равен нулю — потери на невыкупах посчитать нельзя.',
  zero_price: 'Цена равна нулю — маржинальность не считается.',
  zero_cost: 'Себестоимость равна нулю — ROI не считается.',
};

export type SaveNotice = { type: 'success' | 'error'; text: string } | null;

interface ResultScreenProps {
  result: CalcResult;
  price: number;
  title: string;
  saving: boolean;
  notice: SaveNotice;
  onSave: () => void;
  onBack: () => void;
  onOpenReverse: () => void;
  onOpenSaved: () => void;
}

export function ResultScreen({ result, price, title, saving, notice, onSave, onBack, onOpenReverse, onOpenSaved }: ResultScreenProps) {
  return (
    <>
      <header className="screen-header">
        <BrowserBackLink onBack={onBack} />
        <h1>{title}</h1>
      </header>

      <ResultSummary result={result} />

      {result.warnings
        .filter((w) => w !== 'zero_cost' || price > 0)
        .map((w) => (
          <div key={w} className="notice">
            {WARNING_TEXT[w]}
          </div>
        ))}

      <BreakdownBar result={result} price={price} />

      <h2 className="section-title">Подробно</h2>
      <section className="section">
        <Line label="Цена продажи" value={formatMoney(price)} />
        <Line label="Комиссия" value={formatMoney(result.commission)} />
        <Line label="Реклама" value={formatMoney(result.ads)} />
        <Line label="Потери на невыкупах" value={formatMoney(result.returnLoss)} />
        <Line label="Расходы до налога" value={formatMoney(result.expensesBeforeTax)} />
        <Line label={`Налог (${formatPercent(result.taxRate)})`} value={formatMoney(result.tax)} />
        <Line label="Прибыль" value={formatMoney(result.profit)} />
      </section>

      {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}

      <div className="nav-row">
        <button type="button" className="btn btn-secondary" onClick={onOpenReverse}>
          Обратный расчёт
        </button>
        <button type="button" className="btn btn-secondary" onClick={onOpenSaved}>
          Мои товары
        </button>
      </div>

      <ScreenActions mainText={saving ? 'Сохраняем…' : 'Сохранить'} onMain={onSave} onBack={onBack} />
    </>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="result-line">
      <span>{label}</span>
      <span className="value">{value}</span>
    </div>
  );
}

import type { CalcResult, ResultStatus } from '../calc';
import { LOW_MARGIN_PCT } from '../calc';
import { formatMoney, formatPercent } from '../format';

export const STATUS_TEXT: Record<ResultStatus, string> = {
  profit: 'Товар прибыльный',
  low: `Маржинальность ниже ${LOW_MARGIN_PCT}% — риск уйти в минус`,
  loss: 'Товар убыточный',
};

/** Карточка итога: прибыль с единицы крупно, цвет по статусу, маржинальность и ROI. */
export function ResultSummary({ result }: { result: CalcResult }) {
  return (
    <section className={`summary ${result.status}`} aria-live="polite">
      <div className="summary-label">Прибыль с единицы</div>
      <div className="summary-value">{formatMoney(result.profit)}</div>
      <div className="summary-status">{STATUS_TEXT[result.status]}</div>
      <div className="metrics">
        <div className="metric">
          <div className="metric-label">Маржинальность</div>
          <div className="metric-value">{formatPercent(result.marginPct)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">ROI</div>
          <div className="metric-value">{formatPercent(result.roiPct)}</div>
        </div>
      </div>
    </section>
  );
}

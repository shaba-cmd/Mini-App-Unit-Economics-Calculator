import type { CalcResult } from '../calc';
import { formatMoney, formatPercent } from '../format';

interface BreakdownBarProps {
  result: CalcResult;
  price: number;
}

/**
 * Разбивка цены на расходы и прибыль в виде горизонтальной полосы.
 * При убытке полоса строится от суммы расходов (она больше цены).
 */
export function BreakdownBar({ result, price }: BreakdownBarProps) {
  const items = result.breakdown.filter((item) => item.value > 0);
  const expenses = items.reduce((sum, item) => sum + item.value, 0);
  const profit = Math.max(0, result.profit);
  const total = Math.max(expenses + profit, price, 0);

  const segments = [
    ...items.map((item) => ({ key: item.key, label: item.label, value: item.value })),
    ...(profit > 0 ? [{ key: 'profit' as const, label: 'Прибыль', value: profit }] : []),
  ];

  const share = (value: number) => (price > 0 ? (value / price) * 100 : null);

  return (
    <section className="section">
      <h2 className="section-title" style={{ margin: '12px 0 0' }}>
        Куда уходит цена
      </h2>
      {total > 0 ? (
        <div className="bar" role="img" aria-label="Диаграмма разбивки расходов">
          {segments.map((s) => (
            <span key={s.key} className={`c-${s.key}`} style={{ width: `${(s.value / total) * 100}%` }} />
          ))}
        </div>
      ) : (
        <p className="muted">Нет данных для диаграммы</p>
      )}
      <ul className="legend">
        {segments.map((s) => (
          <li key={s.key}>
            <span className={`dot c-${s.key}`} />
            <span className="name">{s.label}</span>
            <span className="share">{formatPercent(share(s.value))}</span>
            <span className="amount">{formatMoney(s.value)}</span>
          </li>
        ))}
        {result.profit < 0 && (
          <li>
            <span className="dot c-profit" style={{ background: 'var(--loss)' }} />
            <span className="name">Убыток</span>
            <span className="share">{formatPercent(share(result.profit))}</span>
            <span className="amount">{formatMoney(result.profit)}</span>
          </li>
        )}
      </ul>
    </section>
  );
}

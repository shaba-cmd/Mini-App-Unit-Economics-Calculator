import { calculate, TAX_SYSTEMS, type Marketplace, type TaxSystem } from '../calc';
import { NumberField } from '../components/NumberField';
import { STATUS_TEXT } from '../components/ResultSummary';
import { ScreenActions } from '../components/ScreenActions';
import { Segmented } from '../components/Segmented';
import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import { hasErrors, PRODUCT_NAME_MAX, toCalcInput, validateForm, type CalcForm, type FormErrors, type NumericField } from '../form';
import { formatMoney, formatPercent } from '../format';
import { openLink } from '../telegram';

/** Ссылки на кабинеты продавца, где публикуются актуальные тарифы. */
const TARIFF_LINKS: Record<Marketplace, string> = {
  wb: 'https://seller.wildberries.ru/',
  ozon: 'https://seller.ozon.ru/',
};

const MARKETPLACES: { value: Marketplace; label: string }[] = [
  { value: 'wb', label: 'Wildberries' },
  { value: 'ozon', label: 'Ozon' },
];

interface CalcScreenProps {
  form: CalcForm;
  errors: FormErrors;
  greetingName?: string;
  editingName?: string;
  onChange: <K extends keyof CalcForm>(field: K, value: CalcForm[K]) => void;
  onCalculate: () => void;
  onOpenReverse: () => void;
  onOpenSaved: () => void;
  onReset: () => void;
}

export function CalcScreen({
  form,
  errors,
  greetingName,
  editingName,
  onChange,
  onCalculate,
  onOpenReverse,
  onOpenSaved,
  onReset,
}: CalcScreenProps) {
  const field = (name: NumericField) => ({
    value: form[name],
    error: errors[name],
    onChange: (value: string) => onChange(name, value),
  });

  // Итог обновляется сразу при вводе, если все поля заполнены корректно.
  const preview = hasErrors(validateForm(form)) ? null : calculate(toCalcInput(form));

  return (
    <>
      <header className="screen-header">
        <h1>Юнит-экономика WB и Ozon</h1>
      </header>
      <p className="greeting">
        {greetingName ? `Привет, ${greetingName}! ` : ''}
        Посчитайте прибыль с единицы товара, маржинальность и ROI.
      </p>

      <div className="nav-row">
        <button type="button" className="btn btn-secondary" onClick={onOpenReverse}>
          Обратный расчёт
        </button>
        <button type="button" className="btn btn-secondary" onClick={onOpenSaved}>
          Мои товары
        </button>
      </div>

      {editingName && (
        <div className="notice">
          Редактируется «{editingName}».{' '}
          <button type="button" className="inline-link" style={{ margin: 0, minHeight: 0 }} onClick={onReset}>
            Новый расчёт
          </button>
        </div>
      )}

      <h2 className="section-title">Товар</h2>
      <section className="section">
        <Segmented
          label="Маркетплейс"
          value={form.marketplace}
          options={MARKETPLACES}
          onChange={(value) => onChange('marketplace', value)}
        />
        <TextField
          label="Название товара"
          hint="Необязательно"
          placeholder="Например, кружка 350 мл"
          maxLength={PRODUCT_NAME_MAX}
          value={form.productName}
          onChange={(value) => onChange('productName', value)}
        />
        <NumberField label="Цена продажи" hint="Цена, по которой покупает клиент" suffix="₽" placeholder="" {...field('price')} />
        <NumberField label="Себестоимость" hint="Закупка или производство" suffix="₽" placeholder="" {...field('cost')} />
      </section>

      <h2 className="section-title">Расходы маркетплейса</h2>
      <section className="section">
        <NumberField label="Комиссия маркетплейса" hint="Зависит от категории товара" suffix="%" {...field('commissionPct')}>
          <button type="button" className="inline-link" onClick={() => openLink(TARIFF_LINKS[form.marketplace])}>
            Посмотреть актуальные тарифы в кабинете →
          </button>
        </NumberField>
        <NumberField label="Логистика до клиента" suffix="₽" {...field('logistics')} />
        <NumberField label="Хранение на единицу" suffix="₽" {...field('storage')} />
        <NumberField label="Упаковка и маркировка" suffix="₽" {...field('packaging')} />
        <NumberField label="Реклама" hint="Процент от цены продажи" suffix="%" {...field('adsPct')} />
        <NumberField label="Процент выкупа" hint="Доля заказов, которые выкупают" suffix="%" {...field('buyoutPct')} />
        <NumberField label="Обратная логистика" hint="При отказе или возврате" suffix="₽" {...field('returnLogistics')} />
      </section>

      <h2 className="section-title">Налог</h2>
      <section className="section">
        <SelectField<TaxSystem>
          label="Система налогообложения"
          value={form.taxSystem}
          options={TAX_SYSTEMS.map((t) => ({ value: t.id, label: t.label }))}
          onChange={(value) => onChange('taxSystem', value)}
        />
        {form.taxSystem === 'custom' && <NumberField label="Ставка налога" hint="Налог от цены продажи" suffix="%" placeholder="" {...field('customTaxPct')} />}
      </section>

      {preview && (
        <div className="preview" aria-live="polite">
          <span>
            Прибыль: <strong className={preview.status}>{formatMoney(preview.profit)}</strong>
          </span>
          <span className="muted" title={STATUS_TEXT[preview.status]}>
            маржа {formatPercent(preview.marginPct)}
          </span>
        </div>
      )}

      <ScreenActions mainText="Рассчитать" onMain={onCalculate} />
    </>
  );
}

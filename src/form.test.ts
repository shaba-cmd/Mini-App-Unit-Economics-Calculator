import { describe, expect, it } from 'vitest';
import { DEFAULT_FORM, normalizeForm, parseNumber, toCalcInput, validateForm } from './form';
import { formatMoney, formatPercent } from './format';

describe('parseNumber', () => {
  it('понимает точку, запятую и пробелы между разрядами', () => {
    expect(parseNumber('1250')).toBe(1250);
    expect(parseNumber('12,5')).toBe(12.5);
    expect(parseNumber('12.5')).toBe(12.5);
    expect(parseNumber('1 250,75')).toBe(1250.75);
    expect(parseNumber(',5')).toBe(0.5);
    expect(parseNumber('5,')).toBe(5);
  });

  it('пустая строка и мусор → null', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('   ')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('1,2,3')).toBeNull();
    expect(parseNumber('1e5')).toBeNull();
    expect(parseNumber('Infinity')).toBeNull();
  });
});

describe('validateForm', () => {
  it('требует цену и себестоимость понятным языком', () => {
    const errors = validateForm(DEFAULT_FORM);
    expect(errors.price).toBe('Введите цену продажи');
    expect(errors.cost).toBe('Введите себестоимость');
  });

  it('не пропускает отрицательные значения и проценты больше 100', () => {
    const errors = validateForm({ ...DEFAULT_FORM, price: '1000', cost: '-5', commissionPct: '120' });
    expect(errors.price).toBeUndefined();
    expect(errors.cost).toMatch(/не может быть отрицательным/);
    expect(errors.commissionPct).toMatch(/не больше 100%/);
  });

  it('своя ставка налога обязательна только для «своей ставки»', () => {
    const filled = { ...DEFAULT_FORM, price: '1000', cost: '400' };
    expect(validateForm(filled)).toEqual({});
    expect(validateForm({ ...filled, taxSystem: 'custom' }).customTaxPct).toBe('Введите ставку налога');
  });

  it('выкуп 0% — ошибка', () => {
    const errors = validateForm({ ...DEFAULT_FORM, price: '1000', cost: '400', buyoutPct: '0' });
    expect(errors.buyoutPct).toMatch(/больше нуля/);
  });
});

describe('toCalcInput / normalizeForm', () => {
  it('пустые необязательные поля превращаются в 0', () => {
    const input = toCalcInput({ ...DEFAULT_FORM, price: '1000', cost: '400', logistics: '' });
    expect(input.logistics).toBe(0);
    expect(input.price).toBe(1000);
  });

  it('восстанавливает испорченные сохранённые данные', () => {
    const form = normalizeForm({ marketplace: 'amazon', price: 5, cost: '300', taxSystem: 'x' });
    expect(form.marketplace).toBe('wb');
    expect(form.taxSystem).toBe('usn6');
    expect(form.price).toBe('');
    expect(form.cost).toBe('300');
  });
});

describe('format', () => {
  it('не показывает NaN, Infinity и −0', () => {
    expect(formatMoney(NaN)).toBe('—');
    expect(formatMoney(Infinity)).toBe('—');
    expect(formatPercent(null)).toBe('—');
    expect(formatMoney(-0.001)).toBe('0 ₽');
  });
});

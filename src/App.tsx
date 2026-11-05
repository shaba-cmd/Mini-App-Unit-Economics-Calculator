import { useCallback, useEffect, useMemo, useState } from 'react';
import { calculate } from './calc';
import { DEFAULT_FORM, hasErrors, toCalcInput, validateForm, type CalcForm, type FormErrors } from './form';
import { formatMoney } from './format';
import { CalcScreen } from './screens/CalcScreen';
import { ResultScreen, type SaveNotice } from './screens/ResultScreen';
import { DEFAULT_REVERSE, ReverseScreen, type ReverseState } from './screens/ReverseScreen';
import { SavedScreen } from './screens/SavedScreen';
import { getSavedRepository, SavedLimitError, type SavedCalc } from './storage';
import { getUserFirstName, haptic } from './telegram';

type Screen = 'calc' | 'result' | 'reverse' | 'saved';

const MARKETPLACE_NAME = { wb: 'WB', ozon: 'Ozon' } as const;

/** Название для сохранения: из поля «Название товара» или «WB · 1 290 ₽». */
function defaultName(form: CalcForm): string {
  const name = form.productName.trim();
  if (name) return name;
  return `${MARKETPLACE_NAME[form.marketplace]} · ${formatMoney(toCalcInput(form).price)}`;
}

export default function App() {
  const [stack, setStack] = useState<Screen[]>(['calc']);
  const [form, setForm] = useState<CalcForm>(DEFAULT_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [reverse, setReverse] = useState<ReverseState>(DEFAULT_REVERSE);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<SaveNotice>(null);
  const greetingName = useMemo(() => getUserFirstName(), []);

  const screen = stack[stack.length - 1];
  const allErrors = useMemo(() => validateForm(form), [form]);
  const valid = !hasErrors(allErrors);
  const input = useMemo(() => toCalcInput(form), [form]);
  const result = useMemo(() => (valid ? calculate(input) : null), [valid, input]);

  // До первого нажатия «Рассчитать» подсвечиваем только явно неверный ввод,
  // а не пустые обязательные поля.
  const visibleErrors: FormErrors = useMemo(() => {
    if (submitted) return allErrors;
    const filtered: FormErrors = {};
    for (const [field, message] of Object.entries(allErrors) as [keyof FormErrors, string][]) {
      if (form[field].trim() !== '') filtered[field] = message;
    }
    return filtered;
  }, [allErrors, submitted, form]);

  const push = useCallback((next: Screen) => {
    setStack((s) => (s[s.length - 1] === next ? s : [...s, next]));
    window.scrollTo(0, 0);
  }, []);

  const back = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    window.scrollTo(0, 0);
  }, []);

  // Результат без валидных данных показать нельзя — возвращаемся к вводу.
  useEffect(() => {
    if (screen === 'result' && !result) setStack(['calc']);
  }, [screen, result]);

  const change = useCallback(<K extends keyof CalcForm>(field: K, value: CalcForm[K]) => {
    setForm((f) => ({ ...f, [field]: value }));
    setNotice(null);
  }, []);

  const calculateAndShow = () => {
    setSubmitted(true);
    if (!valid) {
      haptic.error();
      requestAnimationFrame(() => {
        document.querySelector<HTMLInputElement>('.field.has-error input')?.focus();
      });
      return;
    }
    haptic.impact('medium');
    setNotice(null);
    push('result');
  };

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const saved = await getSavedRepository().save(form, defaultName(form), editing?.id);
      setEditing({ id: saved.id, name: saved.name });
      haptic.success();
      setNotice({ type: 'success', text: `Сохранено в «Мои товары»: ${saved.name}` });
    } catch (e) {
      if (!(e instanceof SavedLimitError)) console.error(e);
      haptic.error();
      setNotice({
        type: 'error',
        text: e instanceof SavedLimitError ? e.message : 'Не удалось сохранить расчёт. Попробуйте ещё раз.',
      });
    } finally {
      setSaving(false);
    }
  };

  const openSaved = (item: SavedCalc) => {
    setForm(item.form);
    setEditing({ id: item.id, name: item.name });
    setSubmitted(true);
    setNotice(null);
    haptic.selection();
    const ok = !hasErrors(validateForm(item.form));
    setStack(ok ? ['calc', 'result'] : ['calc']);
    window.scrollTo(0, 0);
  };

  const reset = () => {
    setForm(DEFAULT_FORM);
    setEditing(null);
    setSubmitted(false);
    setNotice(null);
  };

  const applyPrice = (price: number) => {
    setForm((f) => ({ ...f, price: String(price) }));
    setSubmitted(true);
    setNotice(null);
    haptic.impact('light');
    setStack(['calc', 'result']);
    window.scrollTo(0, 0);
  };

  // Для обратного расчёта цена не нужна, остальные поля — да.
  const { price: priceError, ...reverseErrors } = allErrors;
  const reverseInput = hasErrors(reverseErrors) ? null : input;

  return (
    <main className="app">
      {screen === 'calc' && (
        <CalcScreen
          form={form}
          errors={visibleErrors}
          greetingName={greetingName}
          editingName={editing?.name}
          onChange={change}
          onCalculate={calculateAndShow}
          onOpenReverse={() => push('reverse')}
          onOpenSaved={() => push('saved')}
          onReset={reset}
        />
      )}
      {screen === 'result' && result && (
        <ResultScreen
          result={result}
          price={input.price}
          title={form.productName.trim() || 'Результат'}
          saving={saving}
          notice={notice}
          onSave={() => void save()}
          onBack={back}
          onOpenReverse={() => push('reverse')}
          onOpenSaved={() => push('saved')}
        />
      )}
      {screen === 'reverse' && (
        <ReverseScreen
          state={reverse}
          onChange={setReverse}
          input={reverseInput}
          hasPrice={!priceError}
          onApplyPrice={applyPrice}
          onBack={back}
        />
      )}
      {screen === 'saved' && <SavedScreen onOpen={openSaved} onBack={back} />}
    </main>
  );
}

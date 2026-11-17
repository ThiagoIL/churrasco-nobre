"use client";

import {
  createContext, startTransition, useActionState, useContext, useEffect, useId, useRef, useState,
  type FormEvent, type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Copy, Loader2 } from "lucide-react";
import clsx from "clsx";
import type { FormState } from "@/lib/form";

const FormCtx = createContext<{ state: FormState; pending: boolean; readOnly: boolean }>({ state: {}, pending: false, readOnly: false });

const ReadOnlyCtx = createContext(false);
/** Perfil só de consulta no módulo: os formulários da tela ficam desabilitados. */
export function ReadOnlyProvider({ readOnly, children }: { readOnly: boolean; children: ReactNode }) {
  return <ReadOnlyCtx.Provider value={readOnly}>{children}</ReadOnlyCtx.Provider>;
}

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * Formulário ligado a uma server action. Mantém o que foi digitado quando há erro (não reinicia o formulário),
 * mostra erro/sucesso e bloqueia o envio em dobro enquanto processa.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  banner = true,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  /** Limpa os campos após salvar (cadastro em sequência). */
  resetOnSuccess?: boolean;
  /** true = erro, sucesso e segredo; "errors" = só erro e segredo (botões de linha); false = nada. */
  banner?: boolean | "errors";
}) {
  const [state, formAction, pending] = useActionState(action, {} as FormState);
  const readOnly = useContext(ReadOnlyCtx);
  const ref = useRef<HTMLFormElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.success && resetOnSuccess) ref.current?.reset();
    if (state.error || state.success) bannerRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [state, resetOnSuccess]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || readOnly) return;
    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const data = new FormData(form, submitter as HTMLButtonElement | null);
    startTransition(() => formAction(data));
  }

  return (
    <FormCtx.Provider value={{ state, pending, readOnly }}>
      <form ref={ref} onSubmit={onSubmit} className={className} noValidate={false} aria-busy={pending}>
        <fieldset disabled={readOnly} className="contents">
          {banner && (
            <div ref={bannerRef} aria-live="polite">
              {state.error && (
                <div role="alert" className="mb-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p>{state.error}</p>
                    {state.details && state.details.length > 0 && (
                      <ul className="mt-1 list-disc pl-5 text-xs">
                        {state.details.map((d, i) => <li key={i}>{d}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
              )}
              {state.success && !state.error && banner !== "errors" && (
                <div role="status" className="mb-4 flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  <p>{state.success}</p>
                </div>
              )}
              {state.secret && <SecretBox value={state.secret} />}
            </div>
          )}
          {children}
        </fieldset>
      </form>
    </FormCtx.Provider>
  );
}

/** Texto mostrado uma única vez (ex.: senha provisória), com botão de copiar. */
function SecretBox({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mb-4 rounded-lg border border-gold-300 bg-gold-50 px-3.5 py-3 text-sm">
      <p className="mb-1.5 text-xs font-medium text-gold-700">Anote agora: este valor não será mostrado de novo.</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 select-all break-all rounded bg-white px-2 py-1.5 font-mono text-base tracking-wide">{value}</code>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => {
            navigator.clipboard?.writeText(value).then(() => setCopied(true)).catch(() => undefined);
          }}
        >
          <Copy className="size-3.5" /> {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

type ButtonProps = {
  children?: ReactNode;
  className?: string;
  variant?: "primary" | "outline" | "danger" | "ghost" | "gold";
  size?: "sm" | "lg";
  name?: string;
  value?: string;
  /** Pergunta de confirmação antes de enviar (ex.: cancelar um lançamento). */
  confirm?: string;
};

export function SubmitButton({ children = "Salvar", className, variant = "primary", size, name, value, confirm }: ButtonProps) {
  const { pending, readOnly } = useContext(FormCtx);
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || readOnly}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
      className={clsx("btn", `btn-${variant}`, size === "sm" && "btn-sm", size === "lg" && "btn-lg", className)}
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

/** Pequeno formulário de um botão só (ação por linha da tabela, com confirmação opcional). */
export function ButtonForm({
  action,
  fields,
  children,
  confirm,
  variant = "outline",
  size = "sm",
  showResult = false,
}: {
  action: Action;
  fields: Record<string, string>;
  children: ReactNode;
  confirm?: string;
  /** Mostra também a mensagem de sucesso e o texto secreto (ex.: senha provisória gerada). */
  showResult?: boolean;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  return (
    <ActionForm action={action} className="inline" banner={showResult ? true : "errors"}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <SubmitButton variant={variant} size={size} confirm={confirm}>{children}</SubmitButton>
    </ActionForm>
  );
}

// ── campos ──

type Option = { value: string; label: string };
type Span = 1 | 2 | 3 | 4;

function spanClass(span?: Span) {
  switch (span) {
    case 2: return "sm:col-span-2";
    case 3: return "sm:col-span-2 lg:col-span-3";
    case 4: return "sm:col-span-2 lg:col-span-4";
    default: return "";
  }
}

export function useFieldError(name: string) {
  return useContext(FormCtx).state.fieldErrors?.[name];
}

function useValue(name: string, fallback?: string) {
  const { state } = useContext(FormCtx);
  return state.values?.[name] ?? fallback ?? "";
}

function FieldShell({
  id, label, required, hint, error, span, children,
}: { id: string; label: string; required?: boolean; hint?: string; error?: string; span?: Span; children: ReactNode }) {
  return (
    <div className={spanClass(span)}>
      <label htmlFor={id} className="label">
        {label}
        {required && <span className="text-brand-600"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

type BaseProps = {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  hint?: string;
  span?: Span;
  placeholder?: string;
  autoFocus?: boolean;
};

export function TextField({
  name, label, defaultValue, required, hint, span, placeholder, autoFocus,
  type = "text", maxLength = 200, autoComplete, inputMode, min, max, step, readOnly,
}: BaseProps & {
  type?: "text" | "email" | "password" | "tel" | "date" | "time" | "datetime-local" | "number" | "search";
  maxLength?: number;
  autoComplete?: string;
  inputMode?: "text" | "decimal" | "numeric" | "tel" | "email" | "search";
  min?: string | number;
  max?: string | number;
  step?: string | number;
  readOnly?: boolean;
}) {
  const id = useId();
  const error = useFieldError(name);
  const value = useValue(name, defaultValue);
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} span={span}>
      <input
        id={id} name={name} type={type} defaultValue={value} required={required} placeholder={placeholder}
        maxLength={type === "date" || type === "time" || type === "datetime-local" ? undefined : maxLength}
        autoComplete={autoComplete} inputMode={inputMode} min={min} max={max} step={step} readOnly={readOnly} autoFocus={autoFocus}
        aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}
        className="input"
      />
    </FieldShell>
  );
}

/** Valor em reais: teclado numérico no celular e prefixo "R$". */
export function MoneyField({ name, label, defaultValue, required, hint, span, placeholder = "0,00", autoFocus }: BaseProps) {
  const id = useId();
  const error = useFieldError(name);
  const value = useValue(name, defaultValue);
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} span={span}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">R$</span>
        <input
          id={id} name={name} type="text" inputMode="decimal" autoComplete="off" defaultValue={value} required={required}
          placeholder={placeholder} maxLength={16} autoFocus={autoFocus}
          aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}
          className="input pl-10 tabular-nums"
        />
      </div>
    </FieldShell>
  );
}

/** Quantidade (aceita vírgula): teclado numérico no celular, com a unidade ao lado. */
export function QtyField({ name, label, defaultValue, required, hint, span, placeholder = "0", unit, autoFocus }: BaseProps & { unit?: string }) {
  const id = useId();
  const error = useFieldError(name);
  const value = useValue(name, defaultValue);
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} span={span}>
      <div className="relative">
        <input
          id={id} name={name} type="text" inputMode="decimal" autoComplete="off" defaultValue={value} required={required}
          placeholder={placeholder} maxLength={14} autoFocus={autoFocus}
          aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}
          className={clsx("input tabular-nums", unit && "pr-12")}
        />
        {unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{unit}</span>}
      </div>
    </FieldShell>
  );
}

export function SelectField({
  name, label, options, defaultValue, required, hint, span, placeholder,
}: BaseProps & { options: Option[]; placeholder?: string }) {
  const id = useId();
  const error = useFieldError(name);
  const value = useValue(name, defaultValue);
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} span={span}>
      <select
        id={id} name={name} defaultValue={value} required={required}
        aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}
        className="input pr-8"
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </FieldShell>
  );
}

export function TextareaField({ name, label, defaultValue, required, hint, span, placeholder, rows = 3, maxLength = 1000 }: BaseProps & { rows?: number; maxLength?: number }) {
  const id = useId();
  const error = useFieldError(name);
  const value = useValue(name, defaultValue);
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} span={span}>
      <textarea
        id={id} name={name} rows={rows} defaultValue={value} required={required} placeholder={placeholder} maxLength={maxLength}
        aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}
        className="input"
      />
    </FieldShell>
  );
}

export function CheckboxField({
  name, label, defaultChecked, hint, span, value = "on",
}: { name: string; label: string; defaultChecked?: boolean; hint?: string; span?: Span; value?: string }) {
  const id = useId();
  const { state } = useContext(FormCtx);
  const checked = state.values ? state.values[name] === value : !!defaultChecked;
  return (
    <div className={spanClass(span)}>
      <label htmlFor={id} className="flex min-h-10 cursor-pointer items-start gap-2.5 py-1.5 text-sm">
        <input id={id} name={name} type="checkbox" value={value} defaultChecked={checked} className="mt-0.5 size-5 accent-brand-600" />
        <span>
          {label}
          {hint && <span className="block text-xs text-muted">{hint}</span>}
        </span>
      </label>
    </div>
  );
}

export function FormGrid({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  return (
    <div className={clsx("grid grid-cols-1 gap-4 sm:grid-cols-2", cols === 3 && "lg:grid-cols-3", cols === 4 && "lg:grid-cols-4")}>
      {children}
    </div>
  );
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-wrap items-center gap-2">{children}</div>;
}

/** Barra de envio fixa na parte de baixo (acima do menu do celular): o botão fica sempre ao alcance do polegar. */
export function StickyActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 mt-6 flex flex-wrap items-center gap-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border lg:bottom-4">
      {children}
    </div>
  );
}

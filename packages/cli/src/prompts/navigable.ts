import {
  select,
  multiselect,
  confirm,
  text,
  isCancel,
  cancel,
} from '@clack/prompts';

export function guardCancel<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel('Operation cancelled.');
    process.exit(0);
  }
  return value as T;
}

type SelectOption<T> = { value: T; label: string; hint?: string };

export async function navigableSelect<T>(opts: {
  message: string;
  options: SelectOption<T>[];
  initialValue?: T;
}): Promise<T> {
  const value = await (select as (opts: unknown) => Promise<T | symbol>)(opts);
  return guardCancel(value);
}

export async function navigableMultiselect<T>(opts: {
  message: string;
  options: SelectOption<T>[];
  initialValues?: T[];
  required?: boolean;
}): Promise<T[]> {
  const value = await (multiselect as (opts: unknown) => Promise<T[] | symbol>)({
    ...opts,
    required: opts.required ?? false,
  });
  return guardCancel(value);
}

export async function navigableConfirm(opts: {
  message: string;
  initialValue?: boolean;
}): Promise<boolean> {
  const value = await confirm(opts);
  return guardCancel(value);
}

export async function navigableText(opts: {
  message: string;
  placeholder?: string;
  defaultValue?: string;
  validate?: (value: string | undefined) => string | undefined;
}): Promise<string> {
  const value = await text({
    ...opts,
    defaultValue: opts.defaultValue ?? opts.placeholder,
  });
  return guardCancel(value);
}

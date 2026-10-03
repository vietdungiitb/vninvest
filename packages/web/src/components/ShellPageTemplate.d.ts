import { type ChangeEvent, type ReactNode } from "react";

export const SHELL_PAGE_TEMPLATE_STYLES: string;

export interface ShellMetricProps {
  label: string;
  value: string;
}

export interface ShellFieldProps {
  label: string;
  name: string;
  type?: string;
  value: string | number | readonly string[];
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  autoComplete?: string;
  fieldKey?: string;
  disabled?: boolean;
}

export interface ShellSelectFieldProps {
  label: string;
  name: string;
  value: string | number | readonly string[];
  options: readonly { key: string; label: string }[];
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  fieldKey?: string;
}

export interface ShellPanelProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  as?: string;
}

export interface ShellPageChromeProps {
  eyebrow?: string;
  title: string;
  description?: string;
  badge?: ReactNode;
  metrics?: ReactNode[];
  notice?: string;
  error?: string;
  children?: ReactNode;
  className?: string;
  id?: string;
}

export declare const ShellMetric: (props: ShellMetricProps) => ReactNode;
export declare const ShellField: (props: ShellFieldProps) => ReactNode;
export declare const ShellSelectField: (props: ShellSelectFieldProps) => ReactNode;
export declare const ShellPanel: (props: ShellPanelProps) => ReactNode;
export declare const ShellPageChrome: (props: ShellPageChromeProps) => ReactNode;

export declare function renderShellMetric(label: string, value: string): ReactNode;
export declare function renderShellField(props: ShellFieldProps): ReactNode;
export declare function renderShellSelectField(props: ShellSelectFieldProps): ReactNode;
export declare function renderShellPanel(props: ShellPanelProps): ReactNode;
export declare function renderShellPageChrome(props: ShellPageChromeProps): ReactNode;

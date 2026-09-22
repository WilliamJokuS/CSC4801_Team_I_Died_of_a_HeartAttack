import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  error?: string;
}

export function Input({ label, name, error, ...rest }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium text-text-primary">
        {label}
      </label>
      <input
        id={name}
        name={name}
        className={`min-h-11 w-full rounded-xl border px-3.5 py-2 text-sm bg-background text-text-primary placeholder:text-text-secondary/60 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 ${
          error ? 'border-danger' : 'border-border'
        }`}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        {...rest}
      />
      {error && (
        <p id={`${name}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  name: string;
  error?: string;
}

export function Textarea({ label, name, error, ...rest }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium text-text-primary">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        className={`w-full rounded-xl border px-3.5 py-3 text-sm bg-background text-text-primary placeholder:text-text-secondary/60 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 min-h-[8rem] ${
          error ? 'border-danger' : 'border-border'
        }`}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        {...rest}
      />
      {error && (
        <p id={`${name}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

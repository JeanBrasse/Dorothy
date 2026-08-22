'use client';

import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

const BASE = 'w-full px-2 bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40 transition-colors';
/** Same 32px as a md Button, so a field and the button beside it share edges. */
const CONTROL_HEIGHT = 'h-8';

export function Label({ children }: { children: ReactNode }) {
  return <label className="block text-xs font-medium text-foreground mb-1">{children}</label>;
}

export function Input({ className = '', mono, ...rest }: InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  return <input className={`${BASE} ${CONTROL_HEIGHT} ${mono ? 'font-mono' : ''} ${className}`} {...rest} />;
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${BASE} ${CONTROL_HEIGHT} ${className}`} {...rest}>{children}</select>;
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${BASE} py-1.5 resize-y ${className}`} {...rest} />;
}

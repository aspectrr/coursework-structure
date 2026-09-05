import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { cn } from '@/lib/utils';

// Feature card: white surface, fog hairline, 8px radius, 24px padding, matte
export function Card(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, others] = splitProps(props, ['class']);
  return <div class={cn('rounded-lg border border-fog bg-pure-white p-6', local.class)} {...others} />;
}

export function CardTitle(props: JSX.HTMLAttributes<HTMLHeadingElement>) {
  const [local, others] = splitProps(props, ['class']);
  return <h3 class={cn('font-bold text-midnight-ink', local.class)} {...others} />;
}

export function CardDescription(props: JSX.HTMLAttributes<HTMLParagraphElement>) {
  const [local, others] = splitProps(props, ['class']);
  return <p class={cn('text-body-sm text-stone', local.class)} {...others} />;
}

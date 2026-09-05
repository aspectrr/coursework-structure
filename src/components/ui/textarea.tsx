import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { cn } from '@/lib/utils';

type TextareaProps = JSX.TextareaHTMLAttributes<HTMLTextAreaElement> & { class?: string };

// ponytail: Kobalte TextField adds nothing for a bare controlled textarea —
// swap in <TextField> if a label/description/validation is ever needed.
export function Textarea(props: TextareaProps) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <textarea
      class={cn(
        'w-full resize-y rounded-lg border border-fog bg-pure-white p-3 font-mono text-body-sm leading-relaxed text-midnight-ink placeholder:text-ash focus:border-moss focus:outline-none',
        local.class,
      )}
      {...others}
    />
  );
}

import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { Checkbox as KCheckbox } from '@kobalte/core/checkbox';
import { cn } from '@/lib/utils';

type CheckboxProps = {
  checked: boolean | 'indeterminate';
  onChange?: (checked: boolean) => void;
  class?: string;
  'aria-label'?: string;
};

// 18px box, 5px radius, lime fill on check (interactive = lime contract)
export function Checkbox(props: CheckboxProps) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <KCheckbox
      class={cn('inline-flex cursor-pointer items-center', local.class)}
      checked={props.checked}
      onChange={props.onChange}
      {...(others as any)}
    >
      <KCheckbox.Input class="sr-only" />
      <KCheckbox.Control class="flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] border-ash bg-pure-white transition-colors hover:border-moss data-[checked]:border-moss data-[checked]:bg-moss">
        <KCheckbox.Indicator>
          <svg viewBox="0 0 24 24" class="size-3.5 text-pure-white" fill="none" stroke="currentColor" stroke-width="3">
            <path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </KCheckbox.Indicator>
      </KCheckbox.Control>
    </KCheckbox>
  );
}

export type { JSX };

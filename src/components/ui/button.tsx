import type { JSX, ValidComponent } from 'solid-js';
import { splitProps } from 'solid-js';
import * as ButtonPrimitive from '@kobalte/core/button';
import type { PolymorphicProps } from '@kobalte/core/polymorphic';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // GT America Extended role → UI chrome: uppercase-free, slight tracking, 8px radius, matte
  'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg text-body-sm font-medium tracking-[0.02em] transition-[filter,color,background-color,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Lime = the only interactive fill (design contract)
        default: 'bg-lime-sprout text-midnight-ink hover:brightness-95 active:scale-[0.98]',
        outline: 'border-[1.5px] border-midnight-ink text-midnight-ink hover:bg-midnight-ink hover:text-cream-paper',
        ghost: 'text-midnight-ink hover:bg-midnight-ink/5',
        destructive: 'text-ember-coral hover:bg-ember-coral/10',
      },
      size: {
        default: 'h-10 px-6',
        sm: 'h-7 px-3 text-xs',
        icon: 'size-7',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

type ButtonProps<T extends ValidComponent = 'button'> = ButtonPrimitive.ButtonRootProps<T> & {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'icon';
  class?: string;
  children?: JSX.Element;
};

export function Button<T extends ValidComponent = 'button'>(props: PolymorphicProps<T, ButtonProps<T>>) {
  const [local, others] = splitProps(props as ButtonProps, ['variant', 'size', 'class']);
  return (
    <ButtonPrimitive.Root
      class={cn(buttonVariants({ variant: local.variant, size: local.size }), local.class)}
      {...others}
    />
  );
}

export { buttonVariants };

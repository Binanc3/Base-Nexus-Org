import React, { ReactNode, ButtonHTMLAttributes } from 'react';
import { cn } from '@/src/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export function GlassCard({ children, className, ...props }: GlassCardProps) {
  return (
    <div 
      className={cn(
        "bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  className?: string;
  children?: ReactNode;
  onClick?: any;
  disabled?: boolean;
  [key: string]: any;
}

export function Button({ variant = 'primary', className, children, ...props }: ButtonProps) {
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30",
    secondary: "bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm",
    outline: "border border-white/20 hover:bg-white/10 text-white",
    ghost: "hover:bg-white/10 text-white"
  };

  return (
    <button 
      className={cn(
        "px-4 py-2 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center",
        variants[variant],
        className
      )}
      {...(props as any)}
    >
      {children}
    </button>
  );
}

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:ring-offset-1 focus:ring-offset-[#0b0f1a] disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";
  
  const variants = {
    primary: "bg-cyan-500 text-white hover:bg-cyan-400 shadow-md shadow-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/30",
    secondary: "bg-white/[0.06] text-white border border-white/[0.08] hover:bg-white/[0.10] shadow-sm",
    outline: "bg-transparent border border-white/[0.10] text-slate-300 hover:bg-white/[0.04] hover:text-white",
    ghost: "bg-transparent text-slate-400 hover:bg-white/[0.04] hover:text-white"
  };

  const sizes = {
    sm: "h-9 px-3 text-sm",
    md: "h-11 px-5 py-2",
    lg: "h-12 px-8 text-base",
    xl: "h-14 px-8 text-lg font-semibold"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
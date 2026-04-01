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
  const baseStyles = "inline-flex items-center justify-center rounded-full border-2 border-black/85 font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";
  
  const variants = {
    primary: "bg-charcoal text-white hover:bg-charcoal focus:ring-white/30 shadow-md hover:shadow-xl hover:shadow-white/20",
    secondary: "bg-charcoal text-white hover:bg-charcoal-light focus:ring-white/40 shadow-sm",
    outline: "bg-transparent hover:bg-charcoal-light text-white/80 focus:ring-white/40",
    ghost: "bg-transparent hover:bg-charcoal-light text-white/80 hover:text-white"
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
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-white/80 mb-1.5 ml-1">
          {label}
        </label>
      )}
      <input
        className={`field-vivid flex h-11 w-full rounded-lg border border-white/10 bg-charcoal px-4 py-2 text-sm text-white ring-offset-transparent file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/15 focus-visible:border-white/14 disabled:cursor-not-allowed disabled:opacity-50 transition-all shadow-sm hover:border-white/14 hover:shadow-md ${className}`}
        {...props}
      />
    </div>
  );
};
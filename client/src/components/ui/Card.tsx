import React from 'react';

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => {
  return (
    <div className={`card-charcoal rounded-2xl text-white shadow-sm transition-all duration-300 hover:shadow-md ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => {
  return <div className={`flex flex-col space-y-1.5 p-6 border-b border-white/10 ${className}`} {...props}>{children}</div>;
};

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => {
  return <div className={`p-6 ${className}`} {...props}>{children}</div>;
};
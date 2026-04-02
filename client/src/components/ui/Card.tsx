import React from 'react';

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => {
  return (
    <div className={`card-charcoal rounded-xl text-white shadow-card transition-all duration-300 hover:shadow-card-lg ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => {
  return <div className={`flex flex-col space-y-1.5 p-5 border-b border-white/[0.06] ${className}`} {...props}>{children}</div>;
};

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => {
  return <div className={`p-5 ${className}`} {...props}>{children}</div>;
};
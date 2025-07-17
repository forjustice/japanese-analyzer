// app/admin/components/ShadcnAdminTheme.tsx
'use client';

import React from 'react';

// 主题布局组件
interface ShadcnAdminThemeProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const ShadcnAdminTheme: React.FC<ShadcnAdminThemeProps> = ({
  title,
  subtitle,
  actions,
  children,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center space-x-2">
            {actions}
          </div>
        )}
      </div>
      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
};

export default ShadcnAdminTheme;

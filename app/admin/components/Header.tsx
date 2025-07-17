'use client';

import { Menu } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/app/components/ui/sheet';
import { Card, CardContent } from '@/app/components/ui/card';
import { Sidebar } from './Sidebar';

interface HeaderProps {
  isMobileMenuOpen: boolean;
  onMobileMenuOpenChange: (open: boolean) => void;
  onLogout: () => void;
  pageTitle: string;
}

export function Header({ isMobileMenuOpen, onMobileMenuOpenChange, onLogout, pageTitle }: HeaderProps) {
  return (
    <header className="border-b bg-card">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          {/* Mobile Menu Trigger */}
          <Sheet open={isMobileMenuOpen} onOpenChange={onMobileMenuOpenChange}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="lg:hidden">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <Sidebar 
                isCollapsed={false} 
                isMobile={true} 
                onLogout={onLogout} 
                onLinkClick={() => onMobileMenuOpenChange(false)}
              />
            </SheetContent>
          </Sheet>
          
          <h1 className="text-xl font-semibold hidden sm:block">
            {pageTitle}
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <Card className="px-3 py-1 shadow-none">
            <CardContent className="p-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>系统正常</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </header>
  );
}
'use client';

import React, { useState } from 'react';
import { Key, Plus, Edit, Trash2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import ShadcnAdminTheme from '../components/ShadcnAdminTheme';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { Badge } from '@/app/components/ui/badge';

const StatCard = ({ title, value, icon: Icon }: { title: string, value: string | number, icon: React.ElementType }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

export default function TestShadcnPage() {
  const [showModal, setShowModal] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectValue, setSelectValue] = useState('');

  return (
    <ShadcnAdminTheme
      title="Shadcn UI Test Page"
      subtitle="Testing components styled with shadcn/ui"
      actions={
        <div className="flex items-center gap-3">
          <Button variant="outline">Refresh</Button>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Open Modal
          </Button>
        </div>
      }
    >
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Items" value={42} icon={Key} />
        <StatCard title="Active Items" value={35} icon={Key} />
        <StatCard title="Failed Items" value={7} icon={Key} />
        <StatCard title="24h Usage" value={1234} icon={Key} />
      </div>

      {/* Alert Tests */}
      <div className="space-y-4">
        <Alert variant="success">
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>This is a success alert.</AlertDescription>
        </Alert>
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Warning</AlertTitle>
          <AlertDescription>This is a warning alert.</AlertDescription>
        </Alert>
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>This is an error alert.</AlertDescription>
        </Alert>
      </div>

      {/* Form Tests */}
      <Card>
        <CardHeader>
          <CardTitle>Form Tests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-input">Input</Label>
            <Input
              id="test-input"
              type="text"
              placeholder="Enter something..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="test-select">Select</Label>
            <Select value={selectValue} onValueChange={setSelectValue}>
              <SelectTrigger id="test-select">
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="option1">Option 1</SelectItem>
                <SelectItem value="option2">Option 2</SelectItem>
                <SelectItem value="option3">Option 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
          </div>
        </CardContent>
      </Card>

      {/* Table Test */}
      <Card>
        <CardHeader>
          <CardTitle>Table Test</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>1</TableCell>
                <TableCell>Test Item 1</TableCell>
                <TableCell><Badge variant="success">Active</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon"><Edit className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon"><Trash2 className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>2</TableCell>
                <TableCell>Test Item 2</TableCell>
                <TableCell><Badge variant="destructive">Failed</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon"><Edit className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon"><Trash2 className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Test */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Modal</DialogTitle>
            <DialogDescription>This is a modal using shadcn/ui components.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="modal-input">Modal Input</Label>
            <Input id="modal-input" placeholder="Type something in the modal" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={() => setShowModal(false)}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ShadcnAdminTheme>
  );
}

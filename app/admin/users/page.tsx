'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Edit, 
  Eye,
  RefreshCw,
  CheckCircle,
  XCircle,
  Trash2,
  Key,
  UserX,
  MoreHorizontal
} from 'lucide-react';

import ShadcnAdminTheme from '../components/ShadcnAdminTheme';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/app/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle
} from '@/app/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import { Card, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Checkbox } from '@/app/components/ui/checkbox';

import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { Skeleton } from '@/app/components/ui/skeleton';

interface User {
  id: number;
  username: string;
  email: string;
  isVerified: boolean;
  createdAt: string;
  lastLoginAt?: string;
  totalTokenUsage: number;
  totalRequests: number;
  status: 'active' | 'suspended' | 'pending';
  avatar_url?: string;
  role: 'user' | 'admin' | 'super_admin';
}

interface UserDetails extends User {
  lastRequestTime?: string;
  dailyStats?: Array<{
    date: string;
    tokens: number;
    requests: number;
  }>;
}

interface UserFilters {
  search: string;
  status: 'all' | 'active' | 'suspended' | 'pending';
  verified: 'all' | 'verified' | 'unverified';
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<UserFilters>({
    search: '',
    status: 'all',
    verified: 'all'
  });
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0
  });
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  
  const [editFormData, setEditFormData] = useState({
    username: '',
    email: '',
    avatar_url: '',
    is_verified: false
  });
  const [passwordFormData, setPasswordFormData] = useState({
    userId: 0,
    newPassword: '',
    confirmPassword: ''
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        setError('Authentication token not found.');
        return;
      }

      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
        search: filters.search,
        status: filters.status,
        verified: filters.verified
      });

      const response = await fetch(`/api/admin/users?${queryParams}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        setPagination(prev => ({
          ...prev,
          total: data.total
        }));
        setError('');
      } else {
        const res = await response.json();
        setError(res.error || 'Failed to load users.');
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.pageSize]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAction = async (action: string, userId: number) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    setSelectedUser(user);

    switch (action) {
      case 'edit':
        setEditFormData({
          username: user.username,
          email: user.email,
          avatar_url: user.avatar_url || '',
          is_verified: user.isVerified
        });
        setShowEditModal(true);
        break;
      case 'view':
        await fetchUserDetails(userId);
        setShowViewModal(true);
        break;
      case 'reset_password':
        setPasswordFormData({ userId, newPassword: '', confirmPassword: '' });
        setShowPasswordModal(true);
        break;
      case 'delete':
        setUserToDelete(user);
        setShowDeleteAlert(true);
        break;
      default:
        await performUserAction(action, userId);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    await performUserAction('delete', userToDelete.id);
    setShowDeleteAlert(false);
    setUserToDelete(null);
  };

  const performUserAction = async (action: string, userId: number) => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;

      const method = action === 'delete' ? 'DELETE' : 'PATCH';
      const body = action !== 'delete' ? JSON.stringify({ action }) : undefined;

      const response = await fetch(`/api/admin/users/${userId}`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body
      });

      if (response.ok) {
        fetchUsers();
      } else {
        const data = await response.json();
        setError(data.error || 'Action failed.');
      }
    } catch (err) {
      console.error(`Failed to ${action} user:`, err);
      setError('An unexpected error occurred.');
    }
  };

  const fetchUserDetails = async (userId: number) => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;

      const response = await fetch(`/api/admin/users/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setUserDetails(data);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to fetch user details.');
      }
    } catch (err) {
      console.error('Failed to fetch user details:', err);
      setError('An unexpected error occurred.');
    }
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;

    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;

      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editFormData)
      });

      if (response.ok) {
        setShowEditModal(false);
        setSelectedUser(null);
        fetchUsers();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save user.');
      }
    } catch (err) {
      console.error('Failed to save user:', err);
      setError('An unexpected error occurred.');
    }
  };

  const handleResetPassword = async () => {
    if (passwordFormData.newPassword !== passwordFormData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (passwordFormData.newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;

      const response = await fetch(`/api/admin/users/${passwordFormData.userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          action: 'reset_password',
          newPassword: passwordFormData.newPassword
        })
      });

      if (response.ok) {
        setShowPasswordModal(false);
        // Optionally show a success message
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to reset password.');
      }
    } catch (err) {
      console.error('Failed to reset password:', err);
      setError('An unexpected error occurred.');
    }
  };

  const handleBatchAction = async (action: string) => {
    if (selectedUsers.length === 0) return;

    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;

      const response = await fetch('/api/admin/users/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          action,
          userIds: selectedUsers
        })
      });

      if (response.ok) {
        setSelectedUsers([]);
        fetchUsers();
      } else {
        const data = await response.json();
        setError(data.error || 'Batch action failed.');
      }
    } catch (err) {
      console.error('Batch action failed:', err);
      setError('An unexpected error occurred.');
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'suspended': return 'destructive';
      case 'pending': return 'warning';
      default: return 'secondary';
    }
  };

  const getRoleVariant = (role: string) => {
    switch (role) {
      case 'super_admin': return 'destructive';
      case 'admin': return 'warning';
      case 'user': return 'secondary';
      default: return 'secondary';
    }
  };

  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  const renderLoadingSkeleton = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-32" />
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"><Skeleton className="h-5 w-5" /></TableHead>
              <TableHead><Skeleton className="h-5 w-32" /></TableHead>
              <TableHead><Skeleton className="h-5 w-24" /></TableHead>
              <TableHead><Skeleton className="h-5 w-20" /></TableHead>
              <TableHead><Skeleton className="h-5 w-24" /></TableHead>
              <TableHead><Skeleton className="h-5 w-24" /></TableHead>
              <TableHead><Skeleton className="h-5 w-24" /></TableHead>
              <TableHead className="text-right"><Skeleton className="h-5 w-16" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-5 w-5" /></TableCell>
                <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-5 w-16" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );

  return (
    <ShadcnAdminTheme
      title="User Management"
      subtitle="Manage all user accounts and their permissions."
      actions={
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Total Users: {pagination.total}</span>
          <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      }
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? renderLoadingSkeleton() : (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex-1 relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                placeholder="Search by username or email..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-3">
              <Select 
                value={filters.status} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, status: value as 'all' | 'active' | 'suspended' | 'pending' }))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              
              <Select 
                value={filters.verified} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, verified: value as 'all' | 'verified' | 'unverified' }))}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Verification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Verification</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="unverified">Unverified</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Batch Actions */}
          {selectedUsers.length > 0 && (
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <span className="text-blue-800 dark:text-blue-200 font-medium">
                    {selectedUsers.length} user(s) selected
                  </span>
                  <div className="flex gap-2">
                    <Button onClick={() => handleBatchAction('activate')} variant="outline" size="sm">Activate</Button>
                    <Button onClick={() => handleBatchAction('suspend')} variant="outline" size="sm">Suspend</Button>
                    <Button onClick={() => handleBatchAction('verify')} variant="outline" size="sm">Verify Email</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Users Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedUsers.length === users.length && users.length > 0}
                      onCheckedChange={(checked) => setSelectedUsers(checked ? users.map(u => u.id) : [])}
                    />
                  </TableHead>
                  <TableHead>User Info</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Usage Stats</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedUsers.includes(user.id)}
                        onCheckedChange={(checked) => {
                          setSelectedUsers(prev => checked ? [...prev, user.id] : prev.filter(id => id !== user.id));
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{user.username}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(user.status) as 'success' | 'destructive' | 'warning' | 'secondary'}>{user.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleVariant(user.role)}>
                        {user.role === 'super_admin' ? '超级管理员' : 
                         user.role === 'admin' ? '管理员' : '用户'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">Tokens: {user.totalTokenUsage.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">Requests: {user.totalRequests}</div>
                    </TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleString()}</TableCell>
                    <TableCell>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'N/A'}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleAction('view', user.id)}>
                            <Eye className="mr-2 h-4 w-4" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAction('edit', user.id)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAction(user.status === 'active' ? 'suspend' : 'activate', user.id)}>
                            {user.status === 'active' ? <UserX className="mr-2 h-4 w-4" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                            {user.status === 'active' ? 'Suspend' : 'Activate'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAction('reset_password', user.id)}>
                            <Key className="mr-2 h-4 w-4" /> Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600" onClick={() => handleAction('delete', user.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-end space-x-2 py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Modify user&apos;s basic information.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={editFormData.username} onChange={(e) => setEditFormData(prev => ({ ...prev, username: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={editFormData.email} onChange={(e) => setEditFormData(prev => ({ ...prev, email: e.target.value }))} />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="verified" checked={editFormData.is_verified} onCheckedChange={(checked) => setEditFormData(prev => ({ ...prev, is_verified: !!checked }))} />
              <Label htmlFor="verified">Email Verified</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button onClick={handleSaveUser}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>{userDetails?.username}</DialogDescription>
          </DialogHeader>
          {userDetails && (
            <div className="space-y-4 py-4">
              {/* ... user details content ... */}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Set a new password for {selectedUser?.username}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input id="newPassword" type="password" value={passwordFormData.newPassword} onChange={(e) => setPasswordFormData(prev => ({ ...prev, newPassword: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input id="confirmPassword" type="password" value={passwordFormData.confirmPassword} onChange={(e) => setPasswordFormData(prev => ({ ...prev, confirmPassword: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordModal(false)}>Cancel</Button>
            <Button onClick={handleResetPassword}>Reset Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user account
              for <span className="font-bold">{userToDelete?.username}</span> and remove their data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ShadcnAdminTheme>
  );
}
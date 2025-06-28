import React, { useState, useMemo } from 'react';
import { 
  Users, UserPlus, Shield, Edit3, Trash2, Search, Filter,
  Calendar, Eye, Settings, Lock, Unlock, AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';

interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'analyst' | 'viewer';
  status: 'active' | 'inactive' | 'suspended';
  last_login: string;
  created_at: string;
  permissions: string[];
  department: string;
}

const mockUsers: User[] = [
  {
    id: 'USR001',
    username: 'admin',
    email: 'admin@reconeasy.com',
    role: 'admin',
    status: 'active',
    last_login: '2024-01-20T10:30:00Z',
    created_at: '2024-01-01T00:00:00Z',
    permissions: ['all'],
    department: 'IT'
  },
  {
    id: 'USR002',
    username: 'manager_ops',
    email: 'manager@reconeasy.com',
    role: 'manager',
    status: 'active',
    last_login: '2024-01-20T09:15:00Z',
    created_at: '2024-01-05T00:00:00Z',
    permissions: ['view_dashboard', 'manage_tickets', 'view_reports'],
    department: 'Operations'
  },
  {
    id: 'USR003',
    username: 'analyst_finance',
    email: 'analyst@reconeasy.com',
    role: 'analyst',
    status: 'active',
    last_login: '2024-01-19T16:45:00Z',
    created_at: '2024-01-10T00:00:00Z',
    permissions: ['view_dashboard', 'view_analytics', 'export_data'],
    department: 'Finance'
  },
  {
    id: 'USR004',
    username: 'viewer_support',
    email: 'support@reconeasy.com',
    role: 'viewer',
    status: 'inactive',
    last_login: '2024-01-15T14:20:00Z',
    created_at: '2024-01-15T00:00:00Z',
    permissions: ['view_dashboard'],
    department: 'Support'
  }
];

const rolePermissions = {
  admin: ['all'],
  manager: ['view_dashboard', 'manage_tickets', 'view_reports', 'manage_users', 'view_analytics'],
  analyst: ['view_dashboard', 'view_analytics', 'export_data', 'view_reports'],
  viewer: ['view_dashboard']
};

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'viewer' as User['role'],
    department: ''
  });

  // Filter users
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      if (searchTerm && !user.username.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !user.email.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !user.department.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (roleFilter !== 'all' && user.role !== roleFilter) return false;
      if (statusFilter !== 'all' && user.status !== statusFilter) return false;
      return true;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.status === 'active').length;
    const adminUsers = users.filter(u => u.role === 'admin').length;
    const recentLogins = users.filter(u => {
      const lastLogin = new Date(u.last_login);
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return lastLogin > dayAgo;
    }).length;
    
    return { totalUsers, activeUsers, adminUsers, recentLogins };
  }, [users]);

  const getRoleBadge = (role: User['role']) => {
    const baseClasses = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';
    
    switch (role) {
      case 'admin':
        return `${baseClasses} bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400`;
      case 'manager':
        return `${baseClasses} bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400`;
      case 'analyst':
        return `${baseClasses} bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400`;
      case 'viewer':
        return `${baseClasses} bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-300`;
    }
  };

  const getStatusBadge = (status: User['status']) => {
    const baseClasses = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';
    
    switch (status) {
      case 'active':
        return `${baseClasses} bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400`;
      case 'inactive':
        return `${baseClasses} bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400`;
      case 'suspended':
        return `${baseClasses} bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400`;
    }
  };

  const handleCreateUser = () => {
    const user: User = {
      id: `USR${String(users.length + 1).padStart(3, '0')}`,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      status: 'active',
      last_login: new Date().toISOString(),
      created_at: new Date().toISOString(),
      permissions: rolePermissions[newUser.role],
      department: newUser.department
    };
    
    setUsers([...users, user]);
    setNewUser({
      username: '',
      email: '',
      password: '',
      role: 'viewer',
      department: ''
    });
    setShowCreateUser(false);
  };

  const handleUpdateUserStatus = (userId: string, newStatus: User['status']) => {
    setUsers(users.map(user => 
      user.id === userId ? { ...user, status: newStatus } : user
    ));
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      setUsers(users.filter(user => user.id !== userId));
    }
  };

  if (selectedUser) {
    return (
      <div className="space-y-6">
        {/* User Detail Header */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-teal-100 hover:text-white mb-2 text-sm"
              >
                ← Back to User Management
              </button>
              <h2 className="text-2xl font-bold">User Details</h2>
              <p className="text-teal-100 mt-1">{selectedUser.username}</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className={getRoleBadge(selectedUser.role)}>
                {selectedUser.role}
              </span>
              <span className={getStatusBadge(selectedUser.status)}>
                {selectedUser.status}
              </span>
            </div>
          </div>
        </div>

        {/* User Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">User Information</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Username</label>
                <p className="text-slate-900 dark:text-slate-100 mt-1">{selectedUser.username}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                <p className="text-slate-900 dark:text-slate-100 mt-1">{selectedUser.email}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Department</label>
                <p className="text-slate-900 dark:text-slate-100 mt-1">{selectedUser.department}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Last Login</label>
                <p className="text-slate-900 dark:text-slate-100 mt-1">
                  {format(new Date(selectedUser.last_login), 'PPpp')}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Created</label>
                <p className="text-slate-900 dark:text-slate-100 mt-1">
                  {format(new Date(selectedUser.created_at), 'PPP')}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Permissions</h3>
            
            <div className="space-y-3">
              {selectedUser.permissions.includes('all') ? (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <span className="text-sm font-medium text-red-700 dark:text-red-300">Full System Access</span>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">Administrator privileges</p>
                </div>
              ) : (
                selectedUser.permissions.map((permission, index) => (
                  <div key={index} className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {permission.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </div>
                ))
              )}
            </div>
            
            <div className="mt-6 space-y-3">
              <button
                onClick={() => handleUpdateUserStatus(selectedUser.id, selectedUser.status === 'active' ? 'inactive' : 'active')}
                className={`w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  selectedUser.status === 'active'
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'bg-emerald-500 text-white hover:bg-emerald-600'
                }`}
              >
                {selectedUser.status === 'active' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                <span>{selectedUser.status === 'active' ? 'Deactivate User' : 'Activate User'}</span>
              </button>
              
              <button
                onClick={() => handleUpdateUserStatus(selectedUser.id, 'suspended')}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Suspend User</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showCreateUser) {
    return (
      <div className="space-y-6">
        {/* Create User Header */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => setShowCreateUser(false)}
                className="text-teal-100 hover:text-white mb-2 text-sm"
              >
                ← Back to User Management
              </button>
              <h2 className="text-2xl font-bold">Create New User</h2>
              <p className="text-teal-100 mt-1">Add a new user to the system</p>
            </div>
          </div>
        </div>

        {/* Create User Form */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Username</label>
              <input
                type="text"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="Enter username"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Email</label>
              <input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="Enter email"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Password</label>
              <input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="Enter password"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Role</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value as User['role'] })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              >
                <option value="viewer">Viewer</option>
                <option value="analyst">Analyst</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Department</label>
              <input
                type="text"
                value={newUser.department}
                onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="Enter department"
              />
            </div>
          </div>
          
          <div className="mt-6 flex space-x-3">
            <button
              onClick={handleCreateUser}
              disabled={!newUser.username || !newUser.email || !newUser.password}
              className="px-6 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create User
            </button>
            <button
              onClick={() => setShowCreateUser(false)}
              className="px-6 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">User Management</h2>
            <p className="text-teal-100 mt-1">Manage user accounts, roles, and permissions</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowCreateUser(true)}
              className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add User</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Users</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.totalUsers}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Active Users</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.activeUsers}</p>
            </div>
            <Shield className="w-8 h-8 text-emerald-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Administrators</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.adminUsers}</p>
            </div>
            <Settings className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Recent Logins</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{metrics.recentLogins}</p>
            </div>
            <Calendar className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Users</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {filteredUsers.length} of {users.length} users
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
              />
            </div>
            
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="analyst">Analyst</option>
              <option value="viewer">Viewer</option>
            </select>
            
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{user.username}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={getRoleBadge(user.role)}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                    {user.department}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={getStatusBadge(user.status)}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                    {format(new Date(user.last_login), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="text-teal-600 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 text-sm font-medium flex items-center space-x-1 hover:bg-teal-50 dark:hover:bg-teal-900/20 px-2 py-1 rounded transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View</span>
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 text-sm font-medium flex items-center space-x-1 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
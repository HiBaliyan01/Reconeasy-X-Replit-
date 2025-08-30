import React, { useState } from 'react';
import { 
  Zap, Plus, Settings, Play, Pause, Trash2, 
  Clock, CheckCircle, AlertTriangle, BarChart3
} from 'lucide-react';

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: string;
  action: string;
  status: 'active' | 'inactive' | 'error';
  created_at: string;
  last_run: string | null;
  success_rate: number;
  executions: number;
}

const mockRules: AutomationRule[] = [
  {
    id: 'RULE001',
    name: 'Auto UTR Reconciliation',
    description: 'Automatically reconcile UTRs with 95%+ confidence score',
    trigger: 'New UTR received',
    action: 'Auto-match with transactions',
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    last_run: '2024-01-20T10:30:00Z',
    success_rate: 95.2,
    executions: 1247
  },
  {
    id: 'RULE002',
    name: 'Exception Handling',
    description: 'Auto-resolve discrepancies under Rs.100',
    trigger: 'Payment discrepancy detected',
    action: 'Auto-approve if amount < Rs.100',
    status: 'active',
    created_at: '2024-01-05T00:00:00Z',
    last_run: '2024-01-20T09:15:00Z',
    success_rate: 88.7,
    executions: 342
  },
  {
    id: 'RULE003',
    name: 'Return Fraud Detection',
    description: 'Flag suspicious return patterns',
    trigger: 'Return request received',
    action: 'Check fraud indicators',
    status: 'active',
    created_at: '2024-01-10T00:00:00Z',
    last_run: '2024-01-20T08:45:00Z',
    success_rate: 92.1,
    executions: 156
  },
  {
    id: 'RULE004',
    name: 'Ticket Auto-Generation',
    description: 'Create tickets for undelivered returns',
    trigger: 'Return not received in WMS',
    action: 'Generate marketplace ticket',
    status: 'inactive',
    created_at: '2024-01-15T00:00:00Z',
    last_run: null,
    success_rate: 0,
    executions: 0
  }
];

export default function AutomationPage() {
  const [rules, setRules] = useState<AutomationRule[]>(mockRules);
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    trigger: '',
    action: ''
  });

  const handleToggleRule = (ruleId: string) => {
    setRules(prev => prev.map(rule => 
      rule.id === ruleId 
        ? { ...rule, status: rule.status === 'active' ? 'inactive' as const : 'active' as const }
        : rule
    ));
  };

  const handleDeleteRule = (ruleId: string) => {
    if (confirm('Are you sure you want to delete this automation rule?')) {
      setRules(prev => prev.filter(rule => rule.id !== ruleId));
    }
  };

  const handleCreateRule = () => {
    const rule: AutomationRule = {
      id: `RULE${String(rules.length + 1).padStart(3, '0')}`,
      name: newRule.name,
      description: newRule.description,
      trigger: newRule.trigger,
      action: newRule.action,
      status: 'inactive',
      created_at: new Date().toISOString(),
      last_run: null,
      success_rate: 0,
      executions: 0
    };
    
    setRules([...rules, rule]);
    setNewRule({ name: '', description: '', trigger: '', action: '' });
    setShowCreateRule(false);
  };

  const getStatusIcon = (status: AutomationRule['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'inactive':
        return <Pause className="w-4 h-4 text-slate-400" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: AutomationRule['status']) => {
    const baseClasses = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium';
    
    switch (status) {
      case 'active':
        return `${baseClasses} bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400`;
      case 'inactive':
        return `${baseClasses} bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-300`;
      case 'error':
        return `${baseClasses} bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400`;
    }
  };

  const activeRules = rules.filter(r => r.status === 'active').length;
  const totalExecutions = rules.reduce((sum, r) => sum + r.executions, 0);
  const avgSuccessRate = rules.length > 0 ? rules.reduce((sum, r) => sum + r.success_rate, 0) / rules.length : 0;

  if (showCreateRule) {
    return (
      <div className="space-y-6">
        {/* Create Rule Header */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => setShowCreateRule(false)}
                className="text-teal-100 hover:text-white mb-2 text-sm"
              >
                ← Back to Automation
              </button>
              <h2 className="text-2xl font-bold">Create Automation Rule</h2>
              <p className="text-teal-100 mt-1">Define triggers and actions for automated workflows</p>
            </div>
          </div>
        </div>

        {/* Create Rule Form */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Rule Name</label>
              <input
                type="text"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="Enter rule name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Description</label>
              <textarea
                value={newRule.description}
                onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="Describe what this rule does"
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Trigger</label>
                <select
                  value={newRule.trigger}
                  onChange={(e) => setNewRule({ ...newRule, trigger: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="">Select trigger</option>
                  <option value="New UTR received">New UTR received</option>
                  <option value="Payment discrepancy detected">Payment discrepancy detected</option>
                  <option value="Return request received">Return request received</option>
                  <option value="Return not received in WMS">Return not received in WMS</option>
                  <option value="SLA violation detected">SLA violation detected</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Action</label>
                <select
                  value={newRule.action}
                  onChange={(e) => setNewRule({ ...newRule, action: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="">Select action</option>
                  <option value="Auto-match with transactions">Auto-match with transactions</option>
                  <option value="Auto-approve if amount < Rs.100">Auto-approve if amount &lt; Rs.100</option>
                  <option value="Check fraud indicators">Check fraud indicators</option>
                  <option value="Generate marketplace ticket">Generate marketplace ticket</option>
                  <option value="Send notification">Send notification</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex space-x-3">
            <button
              onClick={handleCreateRule}
              disabled={!newRule.name || !newRule.trigger || !newRule.action}
              className="px-6 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Rule
            </button>
            <button
              onClick={() => setShowCreateRule(false)}
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
            <h2 className="text-2xl font-bold">Intelligent Automation</h2>
            <p className="text-teal-100 mt-1">Configure smart rules and automated workflows</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowCreateRule(true)}
              className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Rule</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Active Rules</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{activeRules}</p>
            </div>
            <Zap className="w-8 h-8 text-emerald-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Executions</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalExecutions.toLocaleString()}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Success Rate</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{avgSuccessRate.toFixed(1)}%</p>
            </div>
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Time Saved</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">24.5h</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">This week</p>
            </div>
            <Clock className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Automation Rules */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Automation Rules</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {rules.length} rules configured
          </p>
        </div>
        
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {rules.map((rule) => (
            <div key={rule.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    {getStatusIcon(rule.status)}
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">{rule.name}</h4>
                    <span className={getStatusBadge(rule.status)}>
                      {rule.status}
                    </span>
                  </div>
                  
                  <p className="text-slate-600 dark:text-slate-400 mb-3">{rule.description}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Trigger:</span>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{rule.trigger}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Action:</span>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{rule.action}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-6 text-sm text-slate-500 dark:text-slate-400">
                    <span>Executions: {rule.executions.toLocaleString()}</span>
                    <span>Success Rate: {rule.success_rate.toFixed(1)}%</span>
                    {rule.last_run && (
                      <span>Last Run: {new Date(rule.last_run).toLocaleString()}</span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => handleToggleRule(rule.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      rule.status === 'active'
                        ? 'bg-amber-100 text-amber-600 hover:bg-amber-200 dark:bg-amber-900/20 dark:text-amber-400'
                        : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400'
                    }`}
                  >
                    {rule.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  
                  <button className="p-2 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors">
                    <Settings className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-2 bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Automation Templates */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Quick Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              name: 'Smart UTR Matching',
              description: 'Auto-match UTRs with high confidence',
              trigger: 'New UTR received',
              action: 'Auto-match with transactions'
            },
            {
              name: 'Exception Auto-Resolution',
              description: 'Resolve small discrepancies automatically',
              trigger: 'Payment discrepancy detected',
              action: 'Auto-approve if amount < Rs.100'
            },
            {
              name: 'Return Fraud Detection',
              description: 'Flag suspicious return patterns',
              trigger: 'Return request received',
              action: 'Check fraud indicators'
            }
          ].map((template, index) => (
            <div key={index} className="p-4 border border-slate-200 dark:border-slate-600 rounded-lg hover:border-teal-300 dark:hover:border-teal-600 transition-colors cursor-pointer">
              <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2">{template.name}</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{template.description}</p>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                <p>Trigger: {template.trigger}</p>
                <p>Action: {template.action}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
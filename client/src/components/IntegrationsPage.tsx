import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Database, Flame, Link, Settings, Shield } from 'lucide-react';
import { DEFAULT_TENANT_ID } from '../config/tenant';

interface Integration {
  id: string;
  platform: string;
  platform_type: 'marketplace' | 'website_storefront' | 'wms';
  availability: 'preview' | 'planned';
  description: string;
  subtitle?: string;
  helperText?: string;
  features: string[];
  ctaLabel?: string;
  featured?: boolean;
}

interface IntegrationVote {
  voteType: 'normal' | 'super';
  readyToPay?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BackendIntegrationVote {
  integration_id: string;
  vote_type: 'vote' | 'super_vote';
  willing_to_pay: boolean | null;
  created_at: string;
}

const integrations: Integration[] = [
  {
    id: 'INT001',
    platform: 'Amazon',
    platform_type: 'marketplace',
    availability: 'planned',
    description: 'Automated reconciliation and settlement ingestion for Amazon sellers.',
    features: ['Settlement Ingestion', 'Payout Reconciliation', 'Claims Tracking'],
    ctaLabel: 'Vote for Integration'
  },
  {
    id: 'INT002',
    platform: 'Flipkart',
    platform_type: 'marketplace',
    availability: 'planned',
    description: 'Direct Flipkart payout and claims sync integration.',
    features: ['Payout Sync', 'Claims Tracking', 'Settlement Reconciliation'],
    ctaLabel: 'Vote for Integration'
  },
  {
    id: 'INT003',
    platform: 'Myntra',
    platform_type: 'marketplace',
    availability: 'preview',
    subtitle: 'Early access integration',
    description: 'Automated settlement, returns, and claims sync for Myntra sellers.',
    helperText: 'Currently being rolled out to pilot brands.',
    features: ['Settlement Sync', 'Returns Sync', 'Claims Automation', 'Auto Reconciliation'],
    ctaLabel: 'Join Early Access',
    featured: true
  },
  {
    id: 'INT004',
    platform: 'Ajio',
    platform_type: 'marketplace',
    availability: 'planned',
    description: 'Planned marketplace connectivity for settlement ingestion, return tracking, and claims visibility.',
    features: ['Settlement Ingestion', 'Returns Tracking', 'Claims Visibility'],
    ctaLabel: 'Vote for Integration'
  },
  {
    id: 'INT005',
    platform: 'Nykaa',
    platform_type: 'marketplace',
    availability: 'planned',
    description: 'Planned reconciliation coverage for beauty marketplace settlements, returns, and fee leakage.',
    features: ['Settlement Sync', 'Returns Tracking', 'Fee Monitoring'],
    ctaLabel: 'Vote for Integration'
  },
  {
    id: 'INT006',
    platform: 'Shopify',
    platform_type: 'website_storefront',
    availability: 'planned',
    description: 'Planned storefront connectivity for order reconciliation, payout visibility, and returns workflows.',
    features: ['Order Sync', 'Payout Visibility', 'Returns Workflows'],
    ctaLabel: 'Vote for Integration'
  },
  {
    id: 'INT007',
    platform: 'WooCommerce',
    platform_type: 'website_storefront',
    availability: 'planned',
    description: 'Planned WordPress storefront support for reconciliation, returns visibility, and settlement tracking.',
    features: ['Order Sync', 'Settlement Tracking', 'Returns Visibility'],
    ctaLabel: 'Vote for Integration'
  },
  {
    id: 'INT008',
    platform: 'Magento',
    platform_type: 'website_storefront',
    availability: 'planned',
    description: 'Planned enterprise storefront integration for reconciliation controls and payout reporting.',
    features: ['Enterprise Orders', 'Payout Reporting', 'Reconciliation Controls'],
    ctaLabel: 'Vote for Integration'
  },
  {
    id: 'INT009',
    platform: 'Increff',
    platform_type: 'wms',
    availability: 'planned',
    description: 'Planned warehouse integration for return receipt visibility, QC workflows, and damaged inventory sync.',
    features: ['Warehouse Returns', 'QC Workflows', 'Damaged Inventory Sync'],
    ctaLabel: 'Vote for WMS Integration'
  },
  {
    id: 'INT010',
    platform: 'EasyEcom',
    platform_type: 'wms',
    availability: 'planned',
    description: 'Planned warehouse returns integration for in-transit visibility, QC handling, and inventory exceptions.',
    features: ['Warehouse Returns', 'QC Handling', 'Inventory Exceptions'],
    ctaLabel: 'Vote for WMS Integration'
  },
  {
    id: 'INT011',
    platform: 'Unicommerce',
    platform_type: 'wms',
    availability: 'planned',
    description: 'Planned WMS integration for warehouse returns, damaged inventory updates, and QC status sync.',
    features: ['Warehouse Returns', 'Damaged Inventory', 'QC Status Sync'],
    ctaLabel: 'Vote for WMS Integration'
  }
];

const typeTabs = [
  { id: 'all', label: 'All Platforms' },
  { id: 'marketplace', label: 'Marketplaces' },
  { id: 'website_storefront', label: 'Website Storefronts' },
  { id: 'wms', label: 'WMS Systems' }
] as const;

const initialsByPlatform: Record<string, string> = {
  Amazon: 'A',
  Flipkart: 'F',
  Myntra: 'M',
  Ajio: 'A',
  Nykaa: 'N',
  Shopify: 'S',
  WooCommerce: 'W',
  Magento: 'M',
  Increff: 'I',
  EasyEcom: 'E',
  Unicommerce: 'U'
};

function getVotesStorageKey(tenantId?: string) {
  return tenantId ? `reconeasy.integrationVotes.${tenantId}` : 'reconeasy.integrationVotes';
}

function readStoredVotes(tenantId?: string): Record<string, IntegrationVote> {
  if (typeof window === 'undefined') return {};

  const tenantScopedKey = getVotesStorageKey(tenantId);
  const fallbackKey = getVotesStorageKey();
  const raw = localStorage.getItem(tenantScopedKey) ?? localStorage.getItem(fallbackKey);

  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, IntegrationVote>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export default function IntegrationsPage() {
  const tenantId = DEFAULT_TENANT_ID || '';
  const [selectedType, setSelectedType] = useState<string>('all');
  const [votes, setVotes] = useState<Record<string, IntegrationVote>>(() =>
    readStoredVotes(tenantId)
  );
  const [confirmingSuperVoteId, setConfirmingSuperVoteId] = useState<string | null>(null);
  const [superVoteIntent, setSuperVoteIntent] = useState<boolean | null>(null);

  const filteredIntegrations = useMemo(() => {
    if (selectedType === 'all') return integrations;
    return integrations.filter((integration) => integration.platform_type === selectedType);
  }, [selectedType]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(getVotesStorageKey(tenantId), JSON.stringify(votes));
    } catch (error) {
      console.warn('Failed to persist integration votes:', error);
    }
  }, [tenantId, votes]);

  useEffect(() => {
    const syncVotes = async () => {
      try {
        const res = await fetch(`/api/integrations/votes?tenant_id=${DEFAULT_TENANT_ID}`);
        if (!res.ok) {
          throw new Error("Failed to fetch integration votes");
        }

        const data = await res.json();
        if (!Array.isArray(data.votes) || data.votes.length === 0) {
          return;
        }

        const backendVotes: Record<string, IntegrationVote> = {};
        data.votes.forEach((vote: BackendIntegrationVote) => {
          if (!vote?.integration_id) return;
          if (vote.vote_type === 'super_vote' && vote.willing_to_pay === false) {
            return;
          }

          backendVotes[vote.integration_id] = {
            voteType: vote.vote_type === 'super_vote' ? 'super' : 'normal',
            readyToPay: vote.willing_to_pay ?? undefined,
            createdAt: vote.created_at,
            updatedAt: vote.created_at,
          };
        });

        setVotes((prev) => ({ ...backendVotes, ...prev }));
      } catch (err) {
        console.error('Failed to sync votes from backend:', err);
      }
    };

    void syncVotes();
  }, []);

  const persistVoteToBackend = async (
    integrationId: string,
    voteType: 'vote' | 'super_vote',
    willingToPay?: boolean,
  ) => {
    try {
      await fetch('/api/integrations/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEFAULT_TENANT_ID,
          integration_id: integrationId,
          vote_type: voteType,
          willing_to_pay: willingToPay ?? null,
        }),
      });
    } catch (err) {
      console.error('Failed to persist vote:', err);
    }
  };

  const persistDeleteToBackend = async (integrationId: string) => {
    try {
      await fetch('/api/integrations/vote', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: DEFAULT_TENANT_ID,
          integration_id: integrationId,
        }),
      });
    } catch (err) {
      console.error('Failed to delete vote:', err);
    }
  };

  const getTypeIcon = (type: Integration['platform_type']) => {
    switch (type) {
      case 'marketplace':
        return <Database className="w-5 h-5 text-orange-500" />;
      case 'website_storefront':
        return <Link className="w-5 h-5 text-violet-500" />;
      case 'wms':
        return <Shield className="w-5 h-5 text-blue-500" />;
      default:
        return <Settings className="w-5 h-5 text-slate-500" />;
    }
  };

  const getAvailabilityBadge = (integration: Integration) => {
    if (integration.availability === 'preview') {
      return 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300';
    }

    return 'bg-slate-100 text-slate-700 dark:bg-slate-700/80 dark:text-slate-200';
  };

  const getIdentityClasses = (type: Integration['platform_type'], featured?: boolean) => {
    if (featured) {
      return 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 ring-1 ring-teal-100 dark:ring-teal-900/40';
    }

    switch (type) {
      case 'marketplace':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';
      case 'website_storefront':
        return 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300';
      case 'wms':
        return 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
    }
  };

  const saveVote = (
    integrationId: string,
    voteType: 'normal' | 'super'
  ) => {
    setVotes((prev) => {
      const now = new Date().toISOString();
      const existing = prev[integrationId];

      return {
        ...prev,
        [integrationId]: {
          voteType,
          readyToPay: voteType === 'super' ? true : undefined,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now
        }
      };
    });
    setConfirmingSuperVoteId(null);
    setSuperVoteIntent(null);
    void persistVoteToBackend(
      integrationId,
      voteType === 'super' ? 'super_vote' : 'vote',
      voteType === 'super' ? true : undefined,
    );
  };

  const handleUndoVote = (integrationId: string) => {
    setVotes((prev) => {
      const next = { ...prev };
      delete next[integrationId];
      return next;
    });
    if (confirmingSuperVoteId === integrationId) {
      setConfirmingSuperVoteId(null);
    }
    setSuperVoteIntent(null);
    void persistDeleteToBackend(integrationId);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-700 dark:to-emerald-700 rounded-xl p-6 text-white">
        <h2 className="text-2xl font-bold">Platform Integrations</h2>
        <p className="text-teal-100 mt-1">
          Explore upcoming marketplace, storefront, and warehouse integrations for reconciliation, returns, and claims workflows.
        </p>
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
          Integrations are being rolled out in phases based on customer demand and pilot onboarding.
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Vote for the platforms you want ReconEasy to prioritize next.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2 rounded-lg bg-slate-100 dark:bg-slate-700 p-1.5">
            {typeTabs.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSelectedType(id)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedType === id
                    ? 'bg-slate-900 text-white dark:bg-teal-500 dark:text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="text-sm text-slate-600 dark:text-slate-400">
            {filteredIntegrations.length} platforms
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredIntegrations.map((integration) => {
          const vote = votes[integration.id];
          const isRequested = Boolean(vote);
          const isPreview = integration.availability === 'preview';
          const isSuperVote = vote?.voteType === 'super';

          return (
            <div
              key={integration.id}
              className={`rounded-xl border p-6 transition-shadow ${
                integration.featured
                  ? 'bg-white dark:bg-slate-800 border-teal-200 dark:border-teal-800 shadow-sm ring-1 ring-teal-100 dark:ring-teal-900/40'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center text-base font-semibold ${getIdentityClasses(
                      integration.platform_type,
                      integration.featured
                    )}`}
                  >
                    {initialsByPlatform[integration.platform] ?? integration.platform[0]}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">{integration.platform}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {getTypeIcon(integration.platform_type)}
                      <span className="text-sm text-slate-600 dark:text-slate-400 capitalize">
                        {integration.platform_type.replace('_', ' ')}
                      </span>
                    </div>
                    {integration.subtitle && (
                      <p className="text-sm text-teal-700 dark:text-teal-300 mt-2">{integration.subtitle}</p>
                    )}
                  </div>
                </div>

                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getAvailabilityBadge(integration)}`}>
                  {isPreview ? 'Preview' : 'Planned'}
                </span>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                {integration.description}
              </p>

              <div className="mb-5">
                <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">Features</h4>
                <div className="flex flex-wrap gap-2">
                  {integration.features.map((feature) => (
                    <span
                      key={feature}
                      className={`px-2.5 py-1 rounded-full text-xs ${
                        integration.featured
                          ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {isRequested ? (
                  <>
                    <div
                      className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${
                        isSuperVote
                          ? 'bg-gradient-to-r from-orange-50 via-amber-50 to-yellow-50 text-amber-800 border border-amber-200 dark:from-amber-900/20 dark:via-orange-900/20 dark:to-yellow-900/20 dark:text-amber-200 dark:border-amber-800/60'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/60'
                      }`}
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>{isSuperVote ? 'High-priority interest recorded ✓' : 'Requested ✓'}</span>
                    </div>
                    <button
                      onClick={() => handleUndoVote(integration.id)}
                      className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white transition-colors"
                    >
                      Undo
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => saveVote(integration.id, 'normal')}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                    >
                      <span>{integration.ctaLabel}</span>
                    </button>

                    {!isPreview && (
                      <>
                        <button
                          onClick={() =>
                            setConfirmingSuperVoteId((current) => {
                              const next = current === integration.id ? null : integration.id;
                              setSuperVoteIntent(null);
                              return next;
                            })
                          }
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 text-white shadow-[0_8px_20px_rgba(245,158,11,0.25)] hover:brightness-105 hover:-translate-y-0.5 transition-all"
                        >
                          <Flame className="w-4 h-4" />
                          <span>Super Vote</span>
                        </button>
                      </>
                    )}
                  </>
                )}

                {integration.helperText && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{integration.helperText}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {confirmingSuperVoteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => {
              setConfirmingSuperVoteId(null);
              setSuperVoteIntent(null);
            }}
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl">
            <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 px-6 py-6 text-white text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                <Flame className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold">Super Vote</h3>
              <p className="mt-1 text-sm text-white/90">This vote carries 10x more weight.</p>
            </div>

            <div className="p-6 space-y-5">
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                Super voting does not guarantee this integration will be built. It helps us prioritize serious customer demand.
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Payment commitment</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Would you seriously consider paying for this integration if ReconEasy prioritizes it?
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { value: 'yes', label: 'Yes' },
                  { value: 'no', label: 'No' }
                ].map((option) => {
                  const selected = superVoteIntent === (option.value === 'yes');
                  return (
                    <button
                      key={option.value}
                      onClick={() => setSuperVoteIntent(option.value === 'yes')}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                        selected
                          ? 'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-500 dark:bg-amber-950/30 dark:text-amber-100'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-amber-300 hover:bg-amber-50/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-amber-700 dark:hover:bg-amber-950/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">{option.label}</span>
                        <span
                          className={`h-4 w-4 rounded-full border ${
                            selected
                              ? 'border-amber-500 bg-amber-500'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  onClick={() => {
                    setConfirmingSuperVoteId(null);
                    setSuperVoteIntent(null);
                  }}
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (superVoteIntent === true) {
                      saveVote(confirmingSuperVoteId, 'super');
                      return;
                    }

                    void persistVoteToBackend(confirmingSuperVoteId, 'super_vote', false);
                    setConfirmingSuperVoteId(null);
                    setSuperVoteIntent(null);
                  }}
                  disabled={superVoteIntent === null}
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 text-white shadow-[0_8px_20px_rgba(245,158,11,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Super Vote
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  buildDenialCodeRanking,
  buildPayerDenialMatrix,
  buildBucketBreakdown,
  buildDenialPathways,
  STANDARD_BUCKET_ORDER,
  hasDenialCode,
} from '../../utils/atbCalculations.js';
import SortableTable from '../SortableTable.jsx';
import DrillAnalyticsPanel from './DrillAnalyticsPanel.jsx';
import { fmt$, fmtPct } from '../../utils/format.js';

// ── Column Constants ──────────────────────────────────────────────────────────

const CODE_RANKING_COLS = [
  {
    key: 'code',
    label: 'Denial Code',
    sortable: true,
    filterType: 'text',
    render: (r) => <span className="badge badge-red">{r.code}</span>,
  },
  {
    key: 'group',
    label: 'Group',
    sortable: true,
    filterType: 'text',
    render: (r) => <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{r.group || '—'}</span>,
  },
  {
    key: 'balance',
    label: 'Denied Balance',
    sortable: true,
    filterType: 'number',
    cellClass: 'td-mono text-right',
    headerClass: 'text-right',
    render: (r) => <span style={{ color: 'var(--danger)' }}>{fmt$(r.balance)}</span>,
    csvValue: (r) => r.balance?.toFixed(2),
  },
  {
    key: 'count',
    label: 'Claims',
    sortable: true,
    filterType: 'number',
    cellClass: 'td-mono text-right',
    headerClass: 'text-right',
  },
  {
    key: 'carrierCount',
    label: 'Carriers',
    sortable: true,
    filterType: 'number',
    cellClass: 'td-mono text-right',
    headerClass: 'text-right',
  },
  {
    key: 'pct',
    label: '% of Denied',
    sortable: true,
    filterType: 'number',
    cellClass: 'td-mono text-right',
    headerClass: 'text-right',
    render: (r) => fmtPct(r.pct),
    csvValue: (r) => r.pct?.toFixed(2) + '%',
  },
];

const PAYER_MATRIX_COLS = [
  {
    key: 'carrier',
    label: 'Carrier',
    sortable: true,
    filterType: 'text',
  },
  {
    key: 'balance',
    label: 'Denied Balance',
    sortable: true,
    filterType: 'number',
    cellClass: 'td-mono text-right',
    headerClass: 'text-right',
    render: (r) => <span style={{ color: 'var(--danger)' }}>{fmt$(r.balance)}</span>,
    csvValue: (r) => r.balance?.toFixed(2),
  },
  {
    key: 'count',
    label: 'Claims',
    sortable: true,
    filterType: 'number',
    cellClass: 'td-mono text-right',
    headerClass: 'text-right',
  },
  {
    key: 'topCode',
    label: 'Top Code',
    sortable: true,
    filterType: 'text',
    render: (r) =>
      r.topCode ? <span className="badge badge-yellow">{r.topCode}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>,
  },
  {
    key: 'denialRate',
    label: 'Denial Rate',
    sortable: true,
    filterType: 'number',
    cellClass: 'td-mono text-right',
    headerClass: 'text-right',
    render: (r) =>
      r.denialRate != null ? (
        <span className={r.denialRate > 30 ? 'rate-red' : r.denialRate > 15 ? 'rate-orange' : r.denialRate > 5 ? 'rate-yellow' : 'rate-green'}>
          {r.denialRate.toFixed(1)}%
        </span>
      ) : (
        <span style={{ color: 'var(--text-muted)' }}>—</span>
      ),
    csvValue: (r) => (r.denialRate != null ? r.denialRate.toFixed(2) + '%' : ''),
  },
];

const BUCKET_COLS = [
  {
    key: 'bucket',
    label: 'DOS Bucket',
    sortable: true,
    filterType: 'text',
  },
  {
    key: 'balance',
    label: 'Denied Balance',
    sortable: true,
    filterType: 'number',
    cellClass: 'td-mono text-right',
    headerClass: 'text-right',
    render: (r) => <span style={{ color: 'var(--danger)' }}>{fmt$(r.balance)}</span>,
    csvValue: (r) => r.balance?.toFixed(2),
  },
  {
    key: 'count',
    label: 'Claims',
    sortable: true,
    filterType: 'number',
    cellClass: 'td-mono text-right',
    headerClass: 'text-right',
  },
  {
    key: 'pct',
    label: '% of Denied',
    sortable: true,
    filterType: 'number',
    cellClass: 'td-mono text-right',
    headerClass: 'text-right',
    render: (r) => fmtPct(r.pct),
    csvValue: (r) => r.pct?.toFixed(2) + '%',
  },
];

const PATHWAY_COLS = [
  {
    key: 'pathway',
    label: 'Pathway',
    sortable: true,
    filterType: 'text',
    render: (r) => (
      <span>
        <span className="badge badge-yellow">{r.firstCode}</span>
        {' → '}
        <span className="badge badge-red">{r.lastCode}</span>
      </span>
    ),
  },
  {
    key: 'balance',
    label: 'Denied Balance',
    sortable: true,
    filterType: 'number',
    cellClass: 'td-mono text-right',
    headerClass: 'text-right',
    render: (r) => fmt$(r.balance),
    csvValue: (r) => r.balance?.toFixed(2),
  },
  {
    key: 'count',
    label: 'Claims',
    sortable: true,
    filterType: 'number',
    cellClass: 'td-mono text-right',
    headerClass: 'text-right',
  },
];

const DRILL_CLAIM_COLS = [
  {
    key: 'FirstDenialCode',
    label: 'First Code',
    sortable: true,
    filterType: 'text',
    render: (r) =>
      r.FirstDenialCode ? (
        <span className="badge badge-yellow">{r.FirstDenialCode}</span>
      ) : (
        <span style={{ color: 'var(--text-muted)' }}>—</span>
      ),
  },
  {
    key: 'LastDenialCode',
    label: 'Last Code',
    sortable: true,
    filterType: 'text',
    render: (r) =>
      r.LastDenialCode ? (
        <span className="badge badge-red">{r.LastDenialCode}</span>
      ) : (
        <span style={{ color: 'var(--text-muted)' }}>—</span>
      ),
  },
  {
    key: '_carrier',
    label: 'Carrier',
    sortable: true,
    filterType: 'text',
  },
  {
    key: 'InsurancePlanDescription',
    label: 'Plan',
    sortable: true,
    filterType: 'text',
  },
  {
    key: 'CPTCode',
    label: 'CPT',
    sortable: true,
    filterType: 'text',
  },
  {
    key: '_balance',
    label: 'Balance',
    sortable: true,
    filterType: 'number',
    cellClass: 'td-mono text-right',
    headerClass: 'text-right',
    render: (r) => <span style={{ color: 'var(--danger)' }}>{fmt$(r._balance)}</span>,
    csvValue: (r) => r._balance?.toFixed(2),
  },
  {
    key: '_dosBucket',
    label: 'DOS Bucket',
    sortable: true,
    filterType: 'multiselect',
  },
  {
    key: '_status',
    label: 'Status',
    sortable: true,
    filterType: 'multiselect',
  },
];

// Secondary drill cols: payers grouped by carrier (for code drill)
const DRILL_PAYER_COLS = [
  {
    key: 'carrier',
    label: 'Carrier',
    sortable: true,
    filterType: 'text',
  },
  {
    key: 'balance',
    label: 'Denied Balance',
    sortable: true,
    filterType: 'number',
    cellClass: 'td-mono text-right',
    headerClass: 'text-right',
    render: (r) => <span style={{ color: 'var(--danger)' }}>{fmt$(r.balance)}</span>,
    csvValue: (r) => r.balance?.toFixed(2),
  },
  {
    key: 'count',
    label: 'Claims',
    sortable: true,
    filterType: 'number',
    cellClass: 'td-mono text-right',
    headerClass: 'text-right',
  },
];

// Secondary drill cols: codes grouped by code (for payer drill)
const DRILL_CODE_COLS = [
  {
    key: 'code',
    label: 'Denial Code',
    sortable: true,
    filterType: 'text',
    render: (r) => <span className="badge badge-red">{r.code}</span>,
  },
  {
    key: 'balance',
    label: 'Denied Balance',
    sortable: true,
    filterType: 'number',
    cellClass: 'td-mono text-right',
    headerClass: 'text-right',
    render: (r) => <span style={{ color: 'var(--danger)' }}>{fmt$(r.balance)}</span>,
    csvValue: (r) => r.balance?.toFixed(2),
  },
  {
    key: 'count',
    label: 'Claims',
    sortable: true,
    filterType: 'number',
    cellClass: 'td-mono text-right',
    headerClass: 'text-right',
  },
];

// ── Drill helpers ─────────────────────────────────────────────────────────────

function groupByCarrier(rows) {
  const map = {};
  for (const r of rows) {
    const c = r._carrier || '(Unknown)';
    if (!map[c]) map[c] = { carrier: c, balance: 0, count: 0 };
    map[c].balance += r._balance;
    map[c].count++;
  }
  return Object.values(map).sort((a, b) => b.balance - a.balance);
}

function groupByCode(rows) {
  const map = {};
  for (const r of rows) {
    const c = String(r.FirstDenialCode || '').trim();
    if (!c) continue;
    if (!map[c]) map[c] = { code: c, balance: 0, count: 0 };
    map[c].balance += r._balance;
    map[c].count++;
  }
  return Object.values(map).sort((a, b) => b.balance - a.balance);
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AtbDenialsTab({ filteredData }) {
  const [drill, setDrill] = useState(null); // { type, row }
  const [denialAgingMode, setDenialAgingMode] = useState('dos');

  // Partition rows
  const denialRows = useMemo(
    () => filteredData.filter((r) => hasDenialCode(r)),
    [filteredData],
  );

  const allBilledRows = useMemo(
    () => filteredData.filter((r) => !r._isUnbilled),
    [filteredData],
  );

  // ── Section 1: KPIs ──────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const deniedBalance = denialRows.reduce((s, r) => s + r._balance, 0);
    const allBilledBalance = allBilledRows.reduce((s, r) => s + r._balance, 0);
    const uniqueCodes = new Set(denialRows.map((r) => String(r.FirstDenialCode).trim())).size;
    const redeniedCount = denialRows.filter((r) => {
      const first = String(r.FirstDenialCode || '').trim();
      const last = String(r.LastDenialCode || '').trim();
      return first && last && first !== last;
    }).length;
    const pctOfBilledAR = allBilledBalance > 0 ? (deniedBalance / allBilledBalance) * 100 : null;
    return { deniedBalance, claimCount: denialRows.length, uniqueCodes, pctOfBilledAR, redeniedCount };
  }, [denialRows, allBilledRows]);

  // ── Section 2: Code Ranking ──────────────────────────────────────────────
  const codeRanking = useMemo(() => buildDenialCodeRanking(denialRows), [denialRows]);
  const codeChartData = useMemo(
    () =>
      codeRanking.slice(0, 15).map((r) => ({
        name: r.code,
        balance: r.balance,
        label: fmt$(r.balance),
      })),
    [codeRanking],
  );

  // ── Section 3: Payer Denial Matrix ───────────────────────────────────────
  const payerMatrix = useMemo(
    () => buildPayerDenialMatrix(denialRows, allBilledRows),
    [denialRows, allBilledRows],
  );

  // ── Section 4: DOS/MAD Aging ─────────────────────────────────────────────
  const bucketBreakdown = useMemo(
    () => buildBucketBreakdown(denialRows, denialAgingMode === 'dos' ? '_dosBucket' : 'MAD Aging Bucket', STANDARD_BUCKET_ORDER),
    [denialRows, denialAgingMode],
  );
  const bucketChartData = useMemo(
    () => bucketBreakdown.map((r) => ({ name: r.bucket, balance: r.balance })),
    [bucketBreakdown],
  );

  // ── Section 5: Re-denial Pathways ────────────────────────────────────────
  const pathways = useMemo(() => buildDenialPathways(denialRows), [denialRows]);
  const uniquePathwayCount = pathways.length;

  // ── Drill-down data ──────────────────────────────────────────────────────
  const drillClaims = useMemo(() => {
    if (!drill) return [];
    const { type, row } = drill;
    if (type === 'code') {
      return denialRows.filter((r) => String(r.FirstDenialCode || '').trim() === row.code);
    }
    if (type === 'payer') {
      return denialRows.filter((r) => r._carrier === row.carrier);
    }
    if (type === 'dosBucket') {
      return denialRows.filter((r) => r._dosBucket === row.bucket);
    }
    if (type === 'madBucket') {
      return denialRows.filter((r) => r['MAD Aging Bucket'] === row.bucket);
    }
    if (type === 'pathway') {
      return denialRows.filter(
        (r) =>
          String(r.FirstDenialCode || '').trim() === row.firstCode &&
          String(r.LastDenialCode || '').trim() === row.lastCode,
      );
    }
    return [];
  }, [drill, denialRows]);

  const drillSecondaryPayerRows = useMemo(() => {
    if (!drill || drill.type !== 'code') return [];
    return groupByCarrier(drillClaims);
  }, [drill, drillClaims]);

  const drillSecondaryCodeRows = useMemo(() => {
    if (!drill || drill.type !== 'payer') return [];
    return groupByCode(drillClaims);
  }, [drill, drillClaims]);

  const drillTitle = useMemo(() => {
    if (!drill) return '';
    const { type, row } = drill;
    if (type === 'code') return `Denial Code: ${row.code}`;
    if (type === 'payer') return `Carrier: ${row.carrier}`;
    if (type === 'dosBucket') return `DOS Bucket: ${row.bucket}`;
    if (type === 'madBucket') return `MAD Bucket: ${row.bucket}`;
    if (type === 'pathway') return `Pathway: ${row.firstCode} → ${row.lastCode}`;
    return '';
  }, [drill]);

  const drillSubtitle = useMemo(() => {
    if (!drill) return '';
    const { type, row } = drill;
    if (type === 'code') return `${row.group || ''} — ${drillClaims.length} claims`;
    if (type === 'payer') return `${drillClaims.length} denied claims`;
    if (type === 'dosBucket') return `${drillClaims.length} denied claims in this aging bucket`;
    if (type === 'madBucket') return `${drillClaims.length} denied claims in this MAD aging bucket`;
    if (type === 'pathway') return `${drillClaims.length} re-denied claims`;
    return '';
  }, [drill, drillClaims]);

  // ── Empty state ──────────────────────────────────────────────────────────
  if (denialRows.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🚫</div>
        <p>No denied claims found in the current filter selection.</p>
      </div>
    );
  }

  return (
    <div className="section-gap">

      {/* ── Section 1: Summary KPIs ── */}
      <div className="summary-row">
        <div className="summary-item">
          <div className="si-label">Total Denied Balance</div>
          <div className="si-value" style={{ color: 'var(--danger)' }}>{fmt$(kpis.deniedBalance)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Claim Count</div>
          <div className="si-value">{kpis.claimCount.toLocaleString()}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Unique Denial Codes</div>
          <div className="si-value">{kpis.uniqueCodes}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">% of Billed AR</div>
          <div className="si-value" style={{ color: kpis.pctOfBilledAR != null && kpis.pctOfBilledAR > 15 ? 'var(--danger)' : 'inherit' }}>
            {kpis.pctOfBilledAR != null ? `${kpis.pctOfBilledAR.toFixed(1)}%` : '—'}
          </div>
        </div>
        <div className="summary-item">
          <div className="si-label">Re-denied Count</div>
          <div className="si-value" style={{ color: kpis.redeniedCount > 0 ? 'var(--orange)' : 'inherit' }}>
            {kpis.redeniedCount.toLocaleString()}
          </div>
        </div>
      </div>

      {/* ── Section 2: Denial Code Ranking ── */}
      <div>
        <div className="panel-header" style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: '12px 16px' }}>
          <div className="panel-title">Denial Code Ranking</div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Top 15 by denied balance — click row to drill down</span>
        </div>

        {codeChartData.length > 0 && (
          <div className="panel" style={{ borderRadius: 0, borderBottom: 'none' }}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={codeChartData} margin={{ top: 8, right: 16, left: 0, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} width={56} tickFormatter={(v) => fmt$(v)} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0];
                    return (
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
                        <div style={{ fontWeight: 600 }}>{d.payload.name}</div>
                        <div style={{ color: 'var(--danger)' }}>Balance: {fmt$(d.value)}</div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="balance" radius={[3, 3, 0, 0]}>
                  {codeChartData.map((_, i) => (
                    <Cell key={i} fill="#dc2626" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <SortableTable
          columns={CODE_RANKING_COLS}
          data={codeRanking}
          pageSize={25}
          exportFilename="denial_code_ranking.csv"
          emptyMessage="No denial codes found."
          onRowClick={(row) => setDrill({ type: 'code', row })}
        />
      </div>

      {/* ── Section 3: Payer Denial Matrix ── */}
      <div>
        <div className="panel-header" style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: '12px 16px' }}>
          <div className="panel-title">Payer Denial Matrix</div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Denial rate vs. all billed AR per carrier — click row to drill down</span>
        </div>
        <SortableTable
          columns={PAYER_MATRIX_COLS}
          data={payerMatrix}
          pageSize={25}
          exportFilename="payer_denial_matrix.csv"
          emptyMessage="No payer data found."
          onRowClick={(row) => setDrill({ type: 'payer', row })}
        />
      </div>

      {/* ── Section 4: DOS/MAD Aging of Denied Claims ── */}
      <div>
        <div className="panel-header" style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: '12px 16px' }}>
          <div className="panel-title">{denialAgingMode === 'dos' ? 'DOS Aging of Denied Claims' : 'MAD Aging of Denied Claims'}</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className="aging-mode-toggle">
              <button type="button" className={denialAgingMode === 'dos' ? 'active' : ''} onClick={() => setDenialAgingMode('dos')}>DOS Age</button>
              <button type="button" className={denialAgingMode === 'mad' ? 'active' : ''} onClick={() => setDenialAgingMode('mad')}>MAD Age</button>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Denied balance by aging bucket</span>
          </div>
        </div>

        {bucketChartData.length > 0 && (
          <div className="panel" style={{ borderRadius: 0, borderBottom: 'none' }}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={bucketChartData} margin={{ top: 8, right: 16, left: 0, bottom: 32 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={56} tickFormatter={(v) => fmt$(v)} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0];
                    return (
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
                        <div style={{ fontWeight: 600 }}>{d.payload.name} days</div>
                        <div style={{ color: 'var(--danger)' }}>Balance: {fmt$(d.value)}</div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="balance" radius={[3, 3, 0, 0]}>
                  {bucketChartData.map((_, i) => (
                    <Cell key={i} fill="#b91c1c" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <SortableTable
          columns={BUCKET_COLS}
          data={bucketBreakdown}
          pageSize={15}
          exportFilename="denial_dos_aging.csv"
          emptyMessage="No aging data found."
          onRowClick={(row) => setDrill({ type: denialAgingMode === 'dos' ? 'dosBucket' : 'madBucket', row })}
        />
      </div>

      {/* ── Section 5: Re-denial Pathways ── */}
      <div>
        <div className="panel-header" style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: '12px 16px' }}>
          <div className="panel-title">Re-denial Pathways</div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {uniquePathwayCount} unique pathway{uniquePathwayCount !== 1 ? 's' : ''} — first code → last code for re-denied claims
          </span>
        </div>
        <SortableTable
          columns={PATHWAY_COLS}
          data={pathways}
          pageSize={25}
          exportFilename="denial_pathways.csv"
          emptyMessage="No re-denial pathways found. All denied claims have a single code."
          onRowClick={(row) => setDrill({ type: 'pathway', row })}
        />
      </div>

      {/* ── Drill-down Panel ── */}
      {drill && (
        <DrillAnalyticsPanel
          title={drillTitle}
          subtitle={drillSubtitle}
          rows={drillClaims}
          onClose={() => setDrill(null)}
          exportFilename={`denial-drill-${drill.type}`}
        />
      )}

    </div>
  );
}

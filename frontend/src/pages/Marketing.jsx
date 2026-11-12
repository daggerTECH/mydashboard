import { useEffect, useRef, useState } from 'react';
import { API } from '../lib/api.js';
import { useDashboard } from '../context/DashboardContext.jsx';
import { fmtMoney, fmtInt } from '../lib/format.js';
import KpiCard from '../components/KpiCard.jsx';
import BarChart from '../components/charts/BarChart.jsx';
import ComboChart from '../components/charts/ComboChart.jsx';
import { COLORS } from '../lib/chartTheme.js';
import { EmptyState, ErrorState, KpiSkeletonGrid, TableSkeletonRows } from '../components/States.jsx';

const CHANNEL_OPTIONS = [
  '', 'Google Ads', 'Google Organic', 'Other Organic Search', 'Paid Social',
  'Organic Social', 'Email', 'AI Assistants', 'Referral', 'Direct', 'Mobile App', 'Admin / Manual', 'Unknown',
];

function pct(v) { return v == null ? '—' : (v * 100).toFixed(1) + '%'; }

export default function Marketing() {
  const { range, currency } = useDashboard();

  // ---- KPI summary -----------------------------------------
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState(null);

  // ---- Sales by channel -----------------------------------------
  const [channelRows, setChannelRows] = useState(null);
  const [channelError, setChannelError] = useState(null);

  // ---- Trend -----------------------------------------
  const [trendGranularity, setTrendGranularity] = useState('daily');
  const [trend, setTrend] = useState(null);
  const [trendError, setTrendError] = useState(null);

  // ---- Campaign table -----------------------------------------
  const [campRows, setCampRows] = useState(null);
  const [campTotal, setCampTotal] = useState(0);
  const [campAvailable, setCampAvailable] = useState(true);
  const [campError, setCampError] = useState(null);
  const [campPage, setCampPage] = useState(1);
  const [campSort, setCampSort] = useState('cost');
  const campPerPage = 20;

  // ---- Attribution detail -----------------------------------------
  const [attrRows, setAttrRows] = useState(null);
  const [attrTotal, setAttrTotal] = useState(0);
  const [pctUnknown, setPctUnknown] = useState(0);
  const [attrError, setAttrError] = useState(null);
  const [attrPage, setAttrPage] = useState(1);
  const [attrSearch, setAttrSearch] = useState('');
  const [attrSearchInput, setAttrSearchInput] = useState('');
  const [attrChannel, setAttrChannel] = useState('');
  const attrPerPage = 20;
  const searchTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setSummary(null); setSummaryError(null);
    API.marketingSummary(range).then((res) => { if (!cancelled) res.ok ? setSummary(res.data) : setSummaryError(res.error); });
    return () => { cancelled = true; };
  }, [range]);

  useEffect(() => {
    let cancelled = false;
    setChannelRows(null); setChannelError(null);
    API.salesByChannel(range).then((res) => { if (!cancelled) res.ok ? setChannelRows(res.data) : setChannelError(res.error); });
    return () => { cancelled = true; };
  }, [range]);

  useEffect(() => {
    let cancelled = false;
    setTrend(null); setTrendError(null);
    API.adsTrend(range, trendGranularity).then((res) => { if (!cancelled) res.ok ? setTrend(res.data) : setTrendError(res.error); });
    return () => { cancelled = true; };
  }, [range, trendGranularity]);

  useEffect(() => { setCampPage(1); }, [range, campSort]);
  useEffect(() => {
    let cancelled = false;
    setCampRows(null); setCampError(null);
    API.campaignPerformance(range, { page: campPage, perPage: campPerPage, sort: campSort }).then((res) => {
      if (cancelled) return;
      if (res.ok) { setCampRows(res.data.rows); setCampTotal(res.data.total); setCampAvailable(res.data.available); } else setCampError(res.error);
    });
    return () => { cancelled = true; };
  }, [range, campPage, campSort]);

  useEffect(() => { setAttrPage(1); }, [range, attrSearch, attrChannel]);
  useEffect(() => {
    let cancelled = false;
    setAttrRows(null); setAttrError(null);
    API.attributionDetail(range, { page: attrPage, perPage: attrPerPage, search: attrSearch, channel: attrChannel }).then((res) => {
      if (cancelled) return;
      if (res.ok) { setAttrRows(res.data.rows); setAttrTotal(res.data.total); setPctUnknown(res.data.pct_unknown); } else setAttrError(res.error);
    });
    return () => { cancelled = true; };
  }, [range, attrPage, attrSearch, attrChannel]);

  function handleAttrSearchInput(v) {
    setAttrSearchInput(v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setAttrSearch(v.trim()), 350);
  }

  const campStart = (campPage - 1) * campPerPage + 1;
  const campEnd = Math.min(campPage * campPerPage, campTotal);
  const attrStart = (attrPage - 1) * attrPerPage + 1;
  const attrEnd = Math.min(attrPage * attrPerPage, attrTotal);

  return (
    <section className="page is-active">
      {summaryError && <div className="card" style={{ padding: 0, marginBottom: 16 }}><ErrorState error={summaryError} heading="Marketing figures could not be loaded" /></div>}
      {!summaryError && !summary && <KpiSkeletonGrid count={7} />}
      {summary && (
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <KpiCard
            label="Ad spend"
            value={summary.ads_available ? fmtMoney(summary.ad_spend, currency) : '—'}
            current={summary.ad_spend} previous={summary.ads_available ? summary.ad_spend_prev : undefined}
            sub={!summary.ads_available ? 'Requires Google Ads integration' : undefined}
          />
          <KpiCard
            label="Google Ads revenue (store)"
            value={fmtMoney(summary.google_ads_revenue_store, currency)}
            current={summary.google_ads_revenue_store} previous={summary.google_ads_revenue_store_prev}
          />
          <KpiCard
            label="ACOS (Store)"
            value={summary.ads_available ? pct(summary.acos_store) : '—'}
            current={summary.acos_store} previous={summary.ads_available ? summary.acos_store_prev : undefined}
            sub={!summary.ads_available ? 'Requires Google Ads integration' : 'Ad spend ÷ store-attributed revenue — the headline number'}
          />
          <KpiCard
            label="ACOS (Google-reported)"
            value={summary.ads_available ? pct(summary.acos_google) : '—'}
            sub={summary.ads_available ? `Gap: ${fmtMoney(summary.gap, currency)}` : 'Requires Google Ads integration'}
          />
          <KpiCard
            label="ROAS"
            value={summary.ads_available && summary.roas != null ? summary.roas.toFixed(2) + '×' : '—'}
            current={summary.roas} previous={summary.ads_available ? summary.roas_prev : undefined}
            sub={!summary.ads_available ? 'Requires Google Ads integration' : undefined}
          />
          <KpiCard
            label="TACOS"
            value={summary.ads_available ? pct(summary.tacos) : '—'}
            sub={summary.ads_available ? 'Ad spend ÷ total store revenue' : 'Requires Google Ads integration'}
          />
          <KpiCard
            label="Total store revenue"
            value={fmtMoney(summary.total_revenue, currency)}
            current={summary.total_revenue} previous={summary.total_revenue_prev}
          />
        </div>
      )}

      <div className="section-heading"><h3>Sales by channel</h3><span className="hint">Revenue-recognized orders (completed + processing), net of discounts and refunds</span></div>
      <div className="panel-row">
        <div className="card panel">
          <div className="panel__header"><div className="panel__title">Revenue by channel</div></div>
          {channelError && <ErrorState error={channelError} heading="Chart data unavailable" />}
          {!channelError && !channelRows && <div className="skeleton" style={{ height: 280 }} />}
          {channelRows && channelRows.length === 0 && <EmptyState message="No sales data found for the selected reporting period." />}
          {channelRows && channelRows.length > 0 && (
            <BarChart labels={channelRows.map((r) => r.channel)} data={channelRows.map((r) => r.net)} color={COLORS.blue} horizontal currency={currency} />
          )}
        </div>
        <div className="card table-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Channel</th><th>Orders</th><th>Net revenue</th><th>% of revenue</th><th>AOV</th></tr></thead>
              <tbody>
                {channelError && <tr><td colSpan={5}><ErrorState error={channelError} heading="Could not load this section" /></td></tr>}
                {!channelError && !channelRows && <TableSkeletonRows cols={5} rows={5} />}
                {!channelError && channelRows && channelRows.map((r) => (
                  <tr key={r.channel}>
                    <td className="cell-primary">{r.channel}</td>
                    <td className="cell-mono">{fmtInt(r.orders)}</td>
                    <td className="cell-mono">{fmtMoney(r.net, currency)}</td>
                    <td className="cell-mono">{(r.share * 100).toFixed(1)}%</td>
                    <td className="cell-mono">{fmtMoney(r.aov, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="section-heading"><h3>Ad spend vs. revenue trend</h3><span className="hint">Google Ads cost against store revenue attributed to the Google Ads channel, with ACOS (Store) as a line</span></div>
      <div className="card panel">
        <div className="panel__header">
          <div className="panel__title">Trend</div>
          <div className="chip-group">
            {['daily', 'weekly', 'monthly'].map((g) => (
              <button key={g} className={`chip ${trendGranularity === g ? 'is-active' : ''}`} onClick={() => setTrendGranularity(g)}>
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {trendError && <ErrorState error={trendError} heading="Chart data unavailable" />}
        {!trendError && !trend && <div className="skeleton" style={{ height: 320 }} />}
        {trend && !trend.available && (
          <div className="inline-note" style={{ margin: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><path d="M12 9v4" /><circle cx="12" cy="12" r="9" /><path d="M12 16h.01" /></svg>
            <span>Requires Google Ads integration — see Settings for setup.</span>
          </div>
        )}
        {trend && trend.available && (
          <ComboChart
            labels={trend.labels}
            barDatasets={[
              { label: 'Ad spend', data: trend.spend, color: COLORS.red },
              { label: 'Google Ads revenue (store)', data: trend.revenue, color: COLORS.mint },
            ]}
            lineDataset={{ label: 'ACOS (Store)', data: trend.acos, color: COLORS.amber }}
          />
        )}
      </div>

      <div className="section-heading"><h3>Campaign performance</h3><span className="hint">Per-campaign spend joined with store orders matched by UTM campaign</span></div>
      <div className="card table-card">
        {campError && <div style={{ padding: 20 }}><ErrorState error={campError} heading="Campaign data could not be loaded" /></div>}
        {!campError && campRows && !campAvailable && (
          <div style={{ padding: 20 }}><EmptyState message="Requires Google Ads integration — connect it in Settings to see per-campaign spend and ACOS." /></div>
        )}
        {!campError && (campAvailable || !campRows) && (
          <>
            <div className="table-toolbar">
              <div className="filter-row">
                <select className="select" value={campSort} onChange={(e) => setCampSort(e.target.value)}>
                  <option value="cost">Highest spend</option>
                  <option value="store_revenue">Highest store revenue</option>
                  <option value="acos_store">Highest ACOS (Store)</option>
                  <option value="roas">Highest ROAS</option>
                  <option value="clicks">Most clicks</option>
                </select>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Campaign</th><th>Type</th><th>Spend</th><th>Clicks</th><th>CTR</th><th>CPC</th>
                    <th>Store orders</th><th>Store revenue</th><th>ACOS (Store)</th>
                    <th>Google conv. value</th><th>ACOS (Google)</th><th>ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {!campRows && <TableSkeletonRows cols={12} rows={5} />}
                  {campRows && campAvailable && campRows.length === 0 && <tr><td colSpan={12}><EmptyState message="No campaign data found for the selected period." /></td></tr>}
                  {campRows && campAvailable && campRows.map((r) => (
                    <tr key={r.campaign_id}>
                      <td className="cell-primary">{r.campaign_name}{!r.matched && <span className="text-muted" style={{ fontSize: 11 }}> (unmatched)</span>}</td>
                      <td className="text-muted">{r.campaign_type}</td>
                      <td className="cell-mono">{fmtMoney(r.cost, currency)}</td>
                      <td className="cell-mono">{fmtInt(r.clicks)}</td>
                      <td className="cell-mono">{pct(r.ctr)}</td>
                      <td className="cell-mono">{r.cpc != null ? fmtMoney(r.cpc, currency) : '—'}</td>
                      <td className="cell-mono">{fmtInt(r.store_orders)}</td>
                      <td className="cell-mono">{r.store_orders ? fmtMoney(r.store_revenue, currency) : '—'}</td>
                      <td className="cell-mono">{pct(r.acos_store)}</td>
                      <td className="cell-mono">{fmtMoney(r.google_conversion_value, currency)}</td>
                      <td className="cell-mono">{pct(r.acos_google)}</td>
                      <td className="cell-mono">{r.roas != null ? r.roas.toFixed(2) + '×' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {campAvailable && (
              <div className="table-pagination">
                <span>{campTotal ? `${campStart}–${campEnd} of ${campTotal} campaigns` : 'No campaigns'}</span>
                <div className="pager-btns">
                  <button className="pager-btn" disabled={campPage <= 1} onClick={() => setCampPage((p) => p - 1)}>‹</button>
                  <button className="pager-btn" disabled={campPage * campPerPage >= campTotal} onClick={() => setCampPage((p) => p + 1)}>›</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="section-heading">
        <h3>Attribution detail</h3>
        <span className="hint">{attrRows ? `${(pctUnknown * 100).toFixed(1)}% of orders had no attribution data` : 'Raw source / medium / campaign / referrer combinations'}</span>
      </div>
      <div className="card table-card">
        <div className="table-toolbar">
          <div className="search-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input type="text" className="search-input" placeholder="Search source, medium, campaign, referrer" value={attrSearchInput} onChange={(e) => handleAttrSearchInput(e.target.value)} />
          </div>
          <div className="filter-row">
            <select className="select" value={attrChannel} onChange={(e) => setAttrChannel(e.target.value)}>
              <option value="">All channels</option>
              {CHANNEL_OPTIONS.filter(Boolean).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>Source type</th><th>Source</th><th>Medium</th><th>Campaign</th><th>Referrer</th><th>Channel</th><th>Orders</th><th>Revenue</th></tr></thead>
            <tbody>
              {attrError && <tr><td colSpan={8}><ErrorState error={attrError} heading="Attribution data could not be loaded" /></td></tr>}
              {!attrError && !attrRows && <TableSkeletonRows cols={8} />}
              {!attrError && attrRows && attrRows.length === 0 && <tr><td colSpan={8}><EmptyState message="No attribution data found for the selected period or filters." /></td></tr>}
              {!attrError && attrRows && attrRows.map((r, i) => (
                <tr key={i}>
                  <td className="text-muted">{r.source_type}</td>
                  <td>{r.source}</td>
                  <td>{r.medium}</td>
                  <td className="text-muted" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.campaign}>{r.campaign}</td>
                  <td className="text-muted" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.referrer}>{r.referrer}</td>
                  <td><span className="cell-primary">{r.channel}</span></td>
                  <td className="cell-mono">{fmtInt(r.orders)}</td>
                  <td className="cell-mono">{fmtMoney(r.revenue, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-pagination">
          <span>{attrTotal ? `${attrStart}–${attrEnd} of ${attrTotal} combinations` : 'No data'}</span>
          <div className="pager-btns">
            <button className="pager-btn" disabled={attrPage <= 1} onClick={() => setAttrPage((p) => p - 1)}>‹</button>
            <button className="pager-btn" disabled={attrPage * attrPerPage >= attrTotal} onClick={() => setAttrPage((p) => p + 1)}>›</button>
          </div>
        </div>
      </div>
    </section>
  );
}

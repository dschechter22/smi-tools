// ── Helpers ──────────────────────────────────────────────────────────────────

// Returns true only for a real denial code — filters out NULL, empty, N/A, etc.
function isDenialCode(val) {
  if (val == null) return false;
  const s = String(val).trim().toUpperCase();
  return s !== '' && s !== 'NULL' && s !== 'N/A' && s !== 'NA' && s !== 'NONE' && s !== '0';
}

// Hard-coded true-denial mapping (from True_Denial_Code.xlsx, Y = true denial).
// Only these codes count toward denial rates and denial tracking.
const TRUE_DENIAL_CODES = new Set([
  '4','5','6','7','8','9','10','11','12','13','14','15',
  '16','17','18','19','20','21','22','26','27','28','29','31',
  '32','33','34','38','39','40','46','47','48','49','50','51',
  '52','53','54','55','56','57','58','60','61','62','78','95',
  '96','98','A1','A8','B1','B4','B7','B8','B9','D1','D2','D3',
  'D4','D5','D6','D7','D8','D9','M1','N1','N3','N4','N5','N8',
  'P2','P3','P4','P7','W5','W6','Y1','107','109','110','111','112',
  '113','114','116','120','124','125','129','133','136','138','140','141',
  '146','147','148','150','151','152','153','154','155','160','163','164',
  '165','166','167','168','170','171','173','174','175','176','177','178',
  '179','180','181','182','183','184','185','188','189','191','196','197',
  '198','199','200','201','202','203','204','206','207','208','210','211',
  '212','213','214','220','224','226','227','228','229','230','231','233',
  '236','238','239','240','242','243','250','251','252','254','256','257',
  '258','261','268','269','270','272','275','277','278','279','280','282',
  '283','284','285','286','287','288','289','290','291','292','296','297',
  '298','412','416','420','422','424','445','454','460','461','465','473',
  '475','476','485','491','496','497','499','503','506','510','514','515',
  '516','518','519','520','523','525','526','527','528','529','533','536',
  '538','540','543','544','546','547','549','550','551','555','559','560',
  '563','565','567','569','570','574','580','581','582','584','586','587',
  '591','592','595','598','599','600','602','603','606','607','608','610',
  '615','619','620','621','623','626','631','632','633','634','635','638',
  '640','650','652','672','674','688','689','690','691','692','694','696',
  '699','701','703','707','709','712','722','723','724','725','729','730',
  '732','737','742','746','749','753','754','756','761','765','772','777',
  '779','781','783','784','795','796','797','B12','B16','B18','B20','B23',
  'D10','D11','D12','D13','D14','D15','D16','D17','D18','D19','D20','D21',
  'D23','M10','M11','M12','M19','M20','M21','M22','M23','M24','M25','M26',
  'M29','M30','M31','M33','M34','M35','M37','M40','M41','M42','M44','M45',
  'M46','M47','M49','M50','M51','M52','M53','M54','M55','M56','M57','M58',
  'M59','M60','M62','M64','M65','M66','M67','M68','M72','M73','M76','M77',
  'M78','M79','M81','M82','M83','M84','M88','M89','M90','M91','M96','M99',
  'N10','N15','N24','N26','N27','N28','N29','N30','N31','N32','N33','N34',
  'N36','N37','N38','N39','N40','N41','N42','N45','N46','N48','N49','N50',
  'N51','N52','N53','N54','N55','N56','N57','N58','N60','N61','N62','N63',
  'N64','N65','N66','N74','N75','N76','N77','N79','N80','N81','N86','N87',
  'N90','N92','N93','N94','N95','P16','P17','P27','2100','M100','M102','M108',
  'M110','M111','M115','M117','M119','M120','M122','M123','M124','M125','M126','M127',
  'M128','M129','M130','M131','M132','M133','M135','M136','M138','M140','M141','M142',
  'M143','MA04','MA05','MA06','MA16','MA19','MA20','MA21','MA24','MA27','MA29','MA30',
  'MA31','MA32','MA33','MA34','MA35','MA36','MA37','MA38','MA39','MA40','MA41','MA42',
  'MA43','MA47','MA48','MA49','MA50','MA51','MA52','MA53','MA54','MA55','MA58','MA60',
  'MA61','MA63','MA64','MA65','MA66','MA68','MA69','MA70','MA71','MA75','MA76','MA81',
  'MA82','MA85','MA86','MA87','MA88','MA89','MA90','MA92','MA94','MA95','MA96','MA97',
  'MA98','MA99','N101','N102','N103','N104','N106','N107','N108','N110','N111','N115',
  'N121','N122','N124','N125','N126','N127','N129','N130','N141','N142','N143','N145',
  'N146','N147','N148','N149','N150','N152','N153','N155','N157','N158','N159','N160',
  'N163','N164','N165','N167','N168','N170','N171','N173','N174','N175','N178','N179',
  'N180','N181','N182','N184','N186','N188','N190','N191','N192','N193','N195','N196',
  'N197','N198','N200','N203','N204','N205','N206','N207','N208','N209','N213','N214',
  'N216','N221','N222','N223','N224','N225','N226','N227','N228','N229','N230','N231',
  'N232','N233','N234','N235','N236','N237','N238','N239','N240','N241','N242','N243',
  'N244','N245','N247','N248','N249','N250','N251','N252','N253','N254','N255','N256',
  'N257','N258','N259','N260','N261','N262','N263','N264','N265','N266','N267','N268',
  'N269','N270','N271','N272','N273','N274','N275','N276','N277','N278','N279','N280',
  'N281','N282','N283','N284','N285','N286','N287','N288','N289','N290','N291','N292',
  'N293','N294','N295','N296','N297','N298','N299','N300','N301','N302','N303','N304',
  'N305','N306','N307','N308','N309','N310','N311','N312','N313','N314','N315','N316',
  'N317','N318','N319','N320','N321','N322','N323','N324','N325','N326','N327','N328',
  'N329','N330','N331','N332','N333','N334','N335','N336','N337','N338','N339','N340',
  'N341','N342','N343','N344','N345','N346','N348','N349','N350','N351','N352','N354',
  'N356','N357','N358','N359','N360','N366','N375','N376','N378','N379','N380','N382',
  'N383','N384','N385','N386','N388','N389','N391','N392','N393','N394','N395','N396',
  'N397','N398','N399','N401','N402','N403','N404','N407','N409','N410','N418','N426',
  'N428','N429','N430','N431','N433','N434','N438','N439','N440','N441','N443','N445',
  'N446','N448','N450','N451','N452','N453','N454','N455','N456','N457','N458','N459',
  'N460','N461','N462','N463','N464','N465','N466','N467','N468','N471','N473','N474',
  'N475','N476','N477','N478','N479','N480','N481','N482','N483','N484','N485','N486',
  'N487','N488','N489','N490','N491','N493','N494','N495','N496','N497','N498','N499',
  'N500','N501','N502','N503','N504','N516','N517','N519','N521','N522','N525','N528',
  'N529','N530','N531','N532','N536','N537','N539','N541','N542','N543','N550','N554',
  'N555','N556','N557','N558','N559','N560','N561','N562','N563','N564','N567','N569',
  'N570','N572','N574','N575','N576','N577','N578','N581','N582','N583','N584','N585',
  'N586','N589','N590','N593','N594','N595','N596','N598','N607','N612','N613','N619',
  'N621','N622','N623','N625','N626','N627','N628','N630','N633','N637','N643','N650',
  'N651','N652','N653','N657','N658','N661','N665','N667','N668','N675','N678','N679',
  'N680','N681','N682','N683','N684','N685','N686','N698','N703','N705','N706','N707',
  'N708','N709','N710','N711','N712','N713','N714','N715','N716','N717','N718','N721',
  'N725','N727','N728','N729','N730','N731','N732','N735','N736','N737','N738','N739',
  'N743','N744','N745','N746','N747','N749','N750','N752','N753','N754','N755','N756',
  'N760','N761','N762','N763','N764','N767','N768','N769','N771','N772','N776','N777',
  'N778','N779','N780','N784','N785','N788','N789','N790','N791','N792','N796','N797',
  'N798','N799','N800','N802','N808','N811','N812','MA100','MA101','MA102','MA104','MA105',
  'MA107','MA108','MA110','MA111','MA112','MA113','MA114','MA115','MA116','MA119','MA120','MA121',
  'MA122','MA123','MA126','MA128','MA129','MA130','MA133','MA134',
]);

// Returns true only if the code is both a valid denial code AND in the true-denial mapping.
function isTrueDenial(val) {
  if (!isDenialCode(val)) return false;
  return TRUE_DENIAL_CODES.has(String(val).trim().toUpperCase());
}

export function median(arr) {
  if (!arr || arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function mean(arr) {
  if (!arr || arr.length === 0) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

export function getPaymentRate(row) {
  if (!row.ChgAmt || row.ChgAmt === 0) return null;
  return row.InsPmtAmt / row.ChgAmt;
}

function fmt(n) {
  return typeof n === 'number' && isFinite(n) ? n : 0;
}

// ── CPT Benchmarks ────────────────────────────────────────────────────────────
// Dollar-weighted: sum(InsPmtAmt) / sum(ChgAmt) per CPT across all payers.
// Requires at least 3 data rows to be considered reliable.

export function calculateCPTBenchmarks(filteredData) {
  const byCode = {};
  for (const row of filteredData) {
    if (!row.ChgAmt || row.ChgAmt === 0) continue;
    const code = row.CPTCode || '';
    if (!byCode[code]) byCode[code] = { totalIns: 0, totalChg: 0, rowCount: 0 };
    byCode[code].totalIns += fmt(row.InsPmtAmt);
    byCode[code].totalChg += fmt(row.ChgAmt);
    byCode[code].rowCount += 1;
  }
  const benchmarks = {};
  for (const [code, d] of Object.entries(byCode)) {
    if (d.rowCount < 3 || d.totalChg === 0) continue;
    benchmarks[code] = d.totalIns / d.totalChg;
  }
  return benchmarks;
}

// ── Underpayment Stats ────────────────────────────────────────────────────────
// All rates are dollar-weighted: sum(InsPmtAmt) / sum(ChgAmt) per payer+CPT.

export function calculateUnderpaymentStats(filteredData, benchmarks, method = 'mean', threshold = 15) {
  const groups = {};
  for (const row of filteredData) {
    const key = `${row.PrimIns}|||${row.CPTCode}`;
    if (!groups[key]) {
      groups[key] = {
        payer: row.PrimIns || '',
        cpt: row.CPTCode || '',
        payerType: row.PrimInsType || '',
        totalChgAmt: 0,
        totalInsPmtAmt: 0,
        rowCount: 0,
      };
    }
    const g = groups[key];
    g.totalChgAmt += fmt(row.ChgAmt);
    g.totalInsPmtAmt += fmt(row.InsPmtAmt);
    g.rowCount += 1;
  }

  const rows = [];
  const threshFraction = threshold / 100;

  for (const g of Object.values(groups)) {
    if (g.totalChgAmt === 0) continue;
    const benchmark = benchmarks[g.cpt];
    const payerRate = g.totalInsPmtAmt / g.totalChgAmt;
    const benchmarkVal = benchmark !== undefined ? benchmark : null;

    let gapPct = null;
    let dollarImpact = 0;
    let flag = false;

    if (benchmarkVal !== null) {
      gapPct = benchmarkVal > 0 ? ((payerRate - benchmarkVal) / benchmarkVal) * 100 : null;
      if (benchmarkVal > payerRate) {
        dollarImpact = (benchmarkVal - payerRate) * g.totalChgAmt;
        flag = (benchmarkVal - payerRate) / benchmarkVal >= threshFraction;
      }
    }

    rows.push({
      payer: g.payer,
      cpt: g.cpt,
      payerType: g.payerType,
      totalChgAmt: g.totalChgAmt,
      payerRate,
      benchmark: benchmarkVal,
      gapPct,
      dollarImpact,
      flag,
      sampleSize: g.rowCount,
    });
  }

  return rows.sort((a, b) => b.dollarImpact - a.dollarImpact);
}

// ── Denial Stats ──────────────────────────────────────────────────────────────
// Denial rate = denied ChgAmt / total ChgAmt (dollar-based only).

export function calculatePayerDenialStats(filteredData) {
  const payerMap = {};
  for (const row of filteredData) {
    const payer = row.PrimIns || '(Unknown)';
    if (!payerMap[payer]) {
      payerMap[payer] = {
        payer,
        totalChgAmt: 0,
        deniedChgAmt: 0,
        redeniedChgAmt: 0,
        codes: {},
      };
    }
    const p = payerMap[payer];
    p.totalChgAmt += fmt(row.ChgAmt);

    if (isTrueDenial(row.FirstDenialCode)) {
      p.deniedChgAmt += fmt(row.ChgAmt);
      const code = row.FirstDenialCode.trim();
      p.codes[code] = (p.codes[code] || 0) + fmt(row.ChgAmt);
      if (isDenialCode(row.LastDenialCode) && row.LastDenialCode.trim() !== row.FirstDenialCode.trim()) {
        p.redeniedChgAmt += fmt(row.ChgAmt);
      }
    }
  }
  return Object.values(payerMap)
    .map((p) => {
      const top3 = Object.entries(p.codes)
        .sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([code]) => code).join(', ');
      return {
        payer: p.payer,
        totalChgAmt: p.totalChgAmt,
        deniedChgAmt: p.deniedChgAmt,
        denialRateDollar: p.totalChgAmt > 0 ? (p.deniedChgAmt / p.totalChgAmt) * 100 : 0,
        redeniedChgAmt: p.redeniedChgAmt,
        redenialRateDollar: p.deniedChgAmt > 0 ? (p.redeniedChgAmt / p.deniedChgAmt) * 100 : 0,
        top3Codes: top3 || '—',
      };
    })
    .sort((a, b) => b.deniedChgAmt - a.deniedChgAmt);
}

export function calculateTopDenialCodes(filteredData) {
  const totalChgAmt = filteredData.reduce((s, r) => s + fmt(r.ChgAmt), 0);
  const codeAmts = {};
  for (const row of filteredData) {
    if (!isTrueDenial(row.FirstDenialCode)) continue;
    const code = row.FirstDenialCode.trim();
    codeAmts[code] = (codeAmts[code] || 0) + fmt(row.ChgAmt);
  }
  return Object.entries(codeAmts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([code, chgAmt]) => ({
      code,
      chgAmt,
      pctOfTotal: totalChgAmt > 0 ? (chgAmt / totalChgAmt) * 100 : 0,
    }));
}

// ── Re-denial ─────────────────────────────────────────────────────────────────
// Re-denial = FirstDenialCode ≠ LastDenialCode AND both non-empty.
// Pathway volumes measured in dollars (ChgAmt).

export function calculateReDenials(filteredData) {
  const rows = filteredData.filter((row) =>
    isTrueDenial(row.FirstDenialCode) &&
    isDenialCode(row.LastDenialCode) &&
    row.FirstDenialCode.trim() !== row.LastDenialCode.trim()
  );

  const pathways = {};
  for (const row of rows) {
    const key = `${row.FirstDenialCode.trim()} → ${row.LastDenialCode.trim()}`;
    if (!pathways[key]) {
      pathways[key] = {
        pathway: key,
        firstCode: row.FirstDenialCode.trim(),
        firstGroup: row.FirstDenialGroup || '',
        lastCode: row.LastDenialCode.trim(),
        lastGroup: row.LastDenialGroup || '',
        totalChgAmt: 0,
        totalBalance: 0,
      };
    }
    pathways[key].totalChgAmt += fmt(row.ChgAmt);
    pathways[key].totalBalance += fmt(row.Balance);
  }

  const pathwayList = Object.values(pathways).sort((a, b) => b.totalChgAmt - a.totalChgAmt);
  const totalExposure = rows.reduce((s, r) => s + fmt(r.Balance), 0);
  const totalChgAmt = rows.reduce((s, r) => s + fmt(r.ChgAmt), 0);

  return { rows, pathways: pathwayList, totalCount: rows.length, totalExposure, totalChgAmt };
}

// ── Location Comparison ───────────────────────────────────────────────────────
// Dollar-weighted payment rate per payer+CPT+state; threshold uses ChgAmt.

export function calculateLocationComparison(filteredData) {
  const groups = {};
  for (const row of filteredData) {
    const key = `${row.PrimIns}|||${row.CPTCode}`;
    if (!groups[key]) {
      groups[key] = { payer: row.PrimIns || '', cpt: row.CPTCode || '', states: {}, totalChgAmt: 0 };
    }
    const g = groups[key];
    const state = row.Location_State || '(Unknown)';
    if (!g.states[state]) g.states[state] = { totalIns: 0, totalChg: 0 };
    g.states[state].totalIns += fmt(row.InsPmtAmt);
    g.states[state].totalChg += fmt(row.ChgAmt);
    g.totalChgAmt += fmt(row.ChgAmt);
  }

  const results = [];
  for (const g of Object.values(groups)) {
    const stateEntries = Object.entries(g.states);
    if (stateEntries.length < 2 || g.totalChgAmt < 500) continue;

    const stateRates = {};
    for (const [state, d] of stateEntries) {
      if (d.totalChg > 0) stateRates[state] = d.totalIns / d.totalChg;
    }
    const rateValues = Object.values(stateRates);
    if (rateValues.length < 2) continue;

    const minRate = Math.min(...rateValues);
    const maxRate = Math.max(...rateValues);

    results.push({
      payer: g.payer,
      cpt: g.cpt,
      states: Object.keys(g.states).sort().join(', '),
      stateCount: stateEntries.length,
      minRate,
      maxRate,
      variance: maxRate - minRate,
      totalChgAmt: g.totalChgAmt,
    });
  }

  return results.sort((a, b) => b.variance - a.variance);
}

// ── Patient / Insurance Split ─────────────────────────────────────────────────
// All dollar-based. % of collected payments from ins vs patient.

export function calculatePatientInsuranceSplit(filteredData) {
  const payerMap = {};
  for (const row of filteredData) {
    const payer = row.PrimIns || '(Unknown)';
    if (!payerMap[payer]) {
      payerMap[payer] = { payer, totalChgAmt: 0, totalInsPmt: 0, totalPtPmt: 0, totalBalance: 0 };
    }
    const p = payerMap[payer];
    p.totalChgAmt += fmt(row.ChgAmt);
    p.totalInsPmt += fmt(row.InsPmtAmt);
    p.totalPtPmt += fmt(row.PtPmtAmt);
    p.totalBalance += fmt(row.Balance);
  }

  return Object.values(payerMap)
    .map((p) => {
      const totalPmt = p.totalInsPmt + p.totalPtPmt;
      return {
        payer: p.payer,
        totalChgAmt: p.totalChgAmt,
        totalInsPmt: p.totalInsPmt,
        totalPtPmt: p.totalPtPmt,
        totalBalance: p.totalBalance,
        insPct: totalPmt > 0 ? (p.totalInsPmt / totalPmt) * 100 : 0,
        ptPct: totalPmt > 0 ? (p.totalPtPmt / totalPmt) * 100 : 0,
        impliedWriteoffs: p.totalChgAmt - p.totalInsPmt - p.totalPtPmt - p.totalBalance,
      };
    })
    .sort((a, b) => b.ptPct - a.ptPct);
}

// ── Overview Stats ────────────────────────────────────────────────────────────

export function calculateOverviewStats(filteredData) {
  let totalChgAmt = 0;
  let totalInsPmt = 0;
  let totalPtPmt = 0;
  let totalBalance = 0;
  let totalPmtAmt = 0;
  let totalDeniedChgAmt = 0;
  const payers = new Set();
  const cpts = new Set();

  for (const row of filteredData) {
    totalChgAmt += fmt(row.ChgAmt);
    totalInsPmt += fmt(row.InsPmtAmt);
    totalPtPmt += fmt(row.PtPmtAmt);
    totalBalance += fmt(row.Balance);
    totalPmtAmt += fmt(row.PmtAmt);
    if (row.PrimIns) payers.add(row.PrimIns);
    if (row.CPTCode) cpts.add(row.CPTCode);
    if (isTrueDenial(row.FirstDenialCode)) totalDeniedChgAmt += fmt(row.ChgAmt);
  }

  // ChgStatus breakdown by ChgAmt
  const statusAmts = {};
  for (const row of filteredData) {
    const s = row.ChgStatus || '(Unknown)';
    statusAmts[s] = (statusAmts[s] || 0) + fmt(row.ChgAmt);
  }

  // PrimInsType breakdown by ChgAmt
  const insTypeAmts = {};
  for (const row of filteredData) {
    const t = row.PrimInsType || '(Unknown)';
    insTypeAmts[t] = (insTypeAmts[t] || 0) + fmt(row.ChgAmt);
  }

  // Top 5 payers by outstanding balance
  const payerBalance = {};
  for (const row of filteredData) {
    const p = row.PrimIns || '(Unknown)';
    payerBalance[p] = (payerBalance[p] || 0) + fmt(row.Balance);
  }
  const top5Payers = Object.entries(payerBalance)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([payer, balance]) => ({ payer, balance }));

  // Top 5 denial codes by denied ChgAmt
  const denialCodeAmts = {};
  for (const row of filteredData) {
    if (!isTrueDenial(row.FirstDenialCode)) continue;
    const c = row.FirstDenialCode.trim();
    denialCodeAmts[c] = (denialCodeAmts[c] || 0) + fmt(row.ChgAmt);
  }
  const top5DenialCodes = Object.entries(denialCodeAmts)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([code, amt]) => ({ code, amt }));

  return {
    totalChgAmt,
    totalInsPmt,
    totalPtPmt,
    totalBalance,
    totalPmtAmt,
    overallPaymentRate: totalChgAmt > 0 ? totalInsPmt / totalChgAmt : 0,
    impliedWriteoffs: totalChgAmt - totalInsPmt - totalPtPmt - totalBalance,
    denialRateDollar: totalChgAmt > 0 ? (totalDeniedChgAmt / totalChgAmt) * 100 : 0,
    payerCount: payers.size,
    cptCount: cpts.size,
    rowCount: filteredData.length,
    statusAmts,
    insTypeAmts,
    top5Payers,
    top5DenialCodes,
  };
}

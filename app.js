/* ============================================================
   Budget Scanner — Vanilla JS engine
   - Parses CSV / TSV / freeform bank statement text + PDF/OFX/QIF
   - Categorises transactions via keyword rules + custom user rules
   - Renders dashboard, alerts, subscriptions, goals, health score,
     SVG charts, history, recommendations
   - 100% client-side, no network calls
   ============================================================ */

(() => {
  'use strict';

  // ---------- LOCAL STORAGE KEYS ----------
  const LS = {
    theme:        'budget-scanner-theme',
    history:      'budget-scanner-history',
    goal:         'budget-scanner-goal',
    customCats:   'budget-scanner-custom-cats',
    catOverrides: 'budget-scanner-cat-overrides'
  };

  // ---------- DEFAULT CATEGORISATION RULES ----------
  const DEFAULT_CATEGORIES = [
    { id: 'income',     label: 'Revenus',           type: 'income',
      keywords: ['salaire', 'paie', 'virement recu', 'virement reçu', 'remboursement', 'remb.', 'paypal recu', 'caf', 'allocation', 'pension', 'dividende', 'loyer percu'] },
    { id: 'housing',    label: 'Logement',          type: 'fixed',
      keywords: ['loyer', 'edf', 'engie', 'enedis', 'gdf', 'eau', 'veolia', 'suez', 'syndic', 'charges copro', 'taxe fonciere', 'taxe habitation', 'assurance habitation'] },
    { id: 'telecom',    label: 'Télécom & Internet', type: 'fixed',
      keywords: ['orange', 'free mobile', 'free telecom', 'sfr', 'bouygues', 'sosh', 'red sfr', 'b&you', 'fibre'] },
    { id: 'subscription', label: 'Abonnements',     type: 'fixed',
      keywords: ['netflix', 'spotify', 'disney', 'apple.com', 'icloud', 'google one', 'google storage', 'youtube premium', 'amazon prime', 'prime video', 'deezer', 'canal+', 'canal +', 'molotov', 'adobe', 'microsoft 365', 'office 365', 'dropbox', 'notion', 'chatgpt', 'openai', 'anthropic', 'figma', 'github'] },
    { id: 'insurance',  label: 'Assurances & Mutuelle', type: 'fixed',
      keywords: ['assurance', 'mutuelle', 'maaf', 'macif', 'maif', 'matmut', 'axa', 'allianz', 'groupama', 'harmonie'] },
    { id: 'transport',  label: 'Transport',         type: 'variable',
      keywords: ['sncf', 'ratp', 'navigo', 'uber', 'bolt', 'heetch', 'taxi', 'blablacar', 'essence', 'total energies', 'totalenergies', 'shell', 'bp ', 'esso', 'avia', 'station service', 'autoroute', 'apr', 'sanef', 'vinci', 'parking', 'indigo park', 'velib', 'lime'] },
    { id: 'groceries',  label: 'Courses',           type: 'variable',
      keywords: ['carrefour', 'auchan', 'leclerc', 'monoprix', 'franprix', 'lidl', 'aldi', 'intermarche', 'super u', 'hyper u', 'casino', 'picard', 'biocoop', 'naturalia', 'grand frais', 'g20', 'leader price'] },
    { id: 'restaurant', label: 'Restaurants & Bars', type: 'variable',
      keywords: ['restaurant', 'resto', 'mcdo', 'mc donald', 'kfc', 'burger', 'subway', 'starbucks', 'paul', 'brioche doree', 'sushi', 'pizza', 'deliveroo', 'uber eats', 'just eat', 'frichti', 'foodora', 'bar ', 'pub ', 'cafe '] },
    { id: 'shopping',   label: 'Shopping',          type: 'variable',
      keywords: ['amazon', 'fnac', 'darty', 'boulanger', 'cdiscount', 'zara', 'h&m', 'uniqlo', 'sephora', 'ikea', 'leroy merlin', 'castorama', 'decathlon', 'go sport', 'zalando', 'asos', 'vinted', 'shein', 'aliexpress'] },
    { id: 'leisure',    label: 'Loisirs & Sorties', type: 'variable',
      keywords: ['cinema', 'ugc', 'pathe', 'gaumont', 'mk2', 'theatre', 'concert', 'spectacle', 'fnac billet', 'ticketmaster', 'see tickets', 'musee', 'salle de sport', 'basic fit', 'fitness park', 'on air', 'piscine'] },
    { id: 'health',     label: 'Santé',             type: 'variable',
      keywords: ['pharmacie', 'medecin', 'docteur', 'doctolib', 'dentiste', 'opticien', 'optic', 'laboratoire', 'cpam', 'hopital', 'clinique'] },
    { id: 'savings',    label: 'Épargne & Investissement', type: 'savings',
      keywords: ['virement epargne', 'livret a', 'livret jeune', 'ldds', 'lep ', 'pea', 'assurance vie', 'av ', 'pee', 'per ', 'cto', 'boursorama epargne', 'trade republic', 'bourse direct', 'fortuneo', 'yomoni', 'nalo', 'crypto', 'binance', 'coinbase', 'kraken'] },
    { id: 'fees',       label: 'Frais bancaires',   type: 'fees',
      keywords: ['agios', 'commission', 'frais', 'cotisation carte', 'cotisation compte', 'tenue de compte', 'rejet', 'incident'] },
    { id: 'cash',       label: 'Retraits espèces',  type: 'variable',
      keywords: ['retrait', 'dab', 'distributeur'] },
    { id: 'transfer_out', label: 'Virements émis',  type: 'variable',
      keywords: ['virement emis', 'virement sortant', 'vir sepa', 'paypal envoye'] }
  ];

  const OTHER_CATEGORY = { id: 'other', label: 'Autres', type: 'variable' };

  // Competing services for duplicate detection
  const COMPETING_SERVICES = [
    { ids: ['spotify', 'deezer', 'apple music', 'youtube music', 'amazon music'], label: 'Streaming musical' },
    { ids: ['netflix', 'disney', 'canal+', 'canal +', 'amazon prime', 'prime video', 'molotov', 'apple tv'], label: 'Streaming vidéo' },
    { ids: ['basic fit', 'fitness park', 'on air'], label: 'Salle de sport' },
    { ids: ['dropbox', 'google one', 'icloud', 'google storage'], label: 'Stockage cloud' },
    { ids: ['microsoft 365', 'office 365', 'google workspace'], label: 'Suite bureautique' },
    { ids: ['chatgpt', 'openai', 'anthropic', 'claude'], label: 'Assistant IA' }
  ];

  // ---------- SAMPLE DATA ----------
  const SAMPLE_DATA = `01/03/2025	VIREMENT SALAIRE SARL DUPONT	+2450,00
02/03/2025	LOYER APPARTEMENT MARS	-850,00
02/03/2025	EDF FACTURE	-78,50
03/03/2025	FREE MOBILE	-19,99
03/03/2025	NETFLIX	-15,49
04/03/2025	SPOTIFY PREMIUM	-9,99
05/03/2025	CARREFOUR MARKET	-87,40
06/03/2025	UBER PARIS	-14,20
07/03/2025	RESTAURANT LA TABLE	-42,00
08/03/2025	AMAZON COMMANDE	-67,90
09/03/2025	LIDL PARIS	-43,15
10/03/2025	CINEMA UGC	-13,50
11/03/2025	DELIVEROO	-28,40
12/03/2025	VIREMENT LIVRET A	-300,00
13/03/2025	TOTAL ENERGIES STATION	-65,00
14/03/2025	PHARMACIE CENTRALE	-22,30
15/03/2025	APPLE.COM/BILL	-2,99
16/03/2025	COTISATION CARTE VISA	-4,50
17/03/2025	MONOPRIX	-54,80
18/03/2025	SNCF VOYAGE	-89,00
19/03/2025	BASIC FIT ABONNEMENT	-29,90
20/03/2025	MCDONALDS	-11,80
21/03/2025	DECATHLON	-45,00
22/03/2025	UBER EATS	-23,50
23/03/2025	RETRAIT DAB	-60,00
24/03/2025	REMBOURSEMENT AMI	+30,00
25/03/2025	ASSURANCE HABITATION MAIF	-18,50
26/03/2025	FNAC ACHAT	-39,99
27/03/2025	CARREFOUR	-72,30
28/03/2025	RESTAURANT SUSHI	-35,00
29/03/2025	DEEZER PREMIUM	-10,99
30/03/2025	DISNEY+ ABONNEMENT	-8,99`;

  // ---------- DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dataInput     = $('#data-input');
  const analyzeBtn    = $('#analyze-btn');
  const parseFeedback = $('#parse-feedback');
  const loadSampleBtn = $('#load-sample');
  const fileInput     = $('#file-input');
  const dropZone      = $('#drop-zone');
  const dashboard     = $('#dashboard');
  const recoSection   = $('#recommendations');
  const exportCsvBtn  = $('#export-csv');
  const exportXlsxBtn = $('#export-xlsx');
  const exportPdfBtn  = $('#export-pdf');
  const themeToggle   = $('#theme-toggle');

  // ---------- CDN URLS (pinned versions) ----------
  const CDN = {
    pdfjs:       'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    pdfjsWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    jspdf:       'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    html2canvas: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    xlsx:        'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
  };

  // ---------- STATE ----------
  let lastAnalysis = null;

  // ---------- STORAGE HELPERS ----------
  function lsGet(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }
  function lsRemove(key) {
    try { localStorage.removeItem(key); } catch {}
  }

  // ---------- THEME ----------
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(LS.theme, theme); } catch {}
  }
  function initTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    themeToggle.addEventListener('click', () => {
      const next = (document.documentElement.getAttribute('data-theme') === 'dark') ? 'light' : 'dark';
      applyTheme(next);
    });
  }

  // ---------- CATEGORIES (default + custom) ----------
  function getCustomCategories() {
    return lsGet(LS.customCats, []);
  }
  function setCustomCategories(cats) {
    lsSet(LS.customCats, cats);
  }
  function getAllCategories() {
    // Custom categories first so they take priority on keyword match.
    return [...getCustomCategories(), ...DEFAULT_CATEGORIES];
  }
  function findCategoryById(id) {
    if (id === OTHER_CATEGORY.id) return OTHER_CATEGORY;
    return getAllCategories().find(c => c.id === id) || OTHER_CATEGORY;
  }
  function getCatOverrides() {
    return lsGet(LS.catOverrides, {});
  }
  function setCatOverride(libelle, categoryId) {
    const overrides = getCatOverrides();
    overrides[libelleKey(libelle)] = categoryId;
    lsSet(LS.catOverrides, overrides);
  }
  function libelleKey(libelle) {
    return libelle.toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim().slice(0, 24);
  }

  // ---------- FORMATTING ----------
  const nf = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
  const fmt = (n) => nf.format(n);
  const fmtSigned = (n) => (n > 0 ? '+' : '') + nf.format(n);
  const fmtPct = (n) => `${n.toFixed(1)} %`;

  // ---------- EVENTS ----------
  dataInput.addEventListener('input', updateParseFeedback);
  loadSampleBtn.addEventListener('click', () => {
    dataInput.value = SAMPLE_DATA;
    updateParseFeedback();
  });
  fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
  analyzeBtn.addEventListener('click', runAnalysis);
  exportCsvBtn.addEventListener('click', exportCSV);
  exportXlsxBtn.addEventListener('click', exportXLSX);
  exportPdfBtn.addEventListener('click', exportPDF);

  // Global sign flip (fallback when bank export is inverted)
  const flipSignsBtn = $('#flip-signs');
  if (flipSignsBtn) flipSignsBtn.addEventListener('click', flipAllSigns);

  // Diagnostic button: explains why lines are/are not parsed
  const diagnoseBtn = $('#diagnose-btn');
  if (diagnoseBtn) diagnoseBtn.addEventListener('click', runDiagnostic);

  function runDiagnostic() {
    const raw = dataInput.value || '';
    const allLines = raw.split(/\r?\n/);
    const nonEmpty = allLines.map(l => l.trim()).filter(Boolean);
    const txs = parseTransactions(raw);
    const linesWithDate = nonEmpty.filter(l => /\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{2}-\d{2}/.test(l));
    // Detect lines that have a date but FAILED to parse
    const failures = [];
    for (const line of linesWithDate) {
      if (isNoiseLine(line)) continue;
      const tx = parseLine(line);
      if (!tx) failures.push(line);
    }
    const noiseCount = nonEmpty.filter(isNoiseLine).length;
    // Detect amount-like substrings on lines with date but no parsed amount
    const amountRegex = /\d+[.,]\d{1,2}/g;
    const sampleLines = nonEmpty.slice(0, 25);
    const out = [];
    out.push(`=== STATISTIQUES ===`);
    out.push(`Lignes totales : ${nonEmpty.length}`);
    out.push(`Lignes avec une date : ${linesWithDate.length}`);
    out.push(`Lignes filtrées comme bruit : ${noiseCount}`);
    out.push(`Transactions parsées avec succès : ${txs.length}`);
    out.push(`Lignes datées MAIS rejetées : ${failures.length}`);
    out.push('');
    out.push(`=== 25 PREMIÈRES LIGNES BRUTES ===`);
    sampleLines.forEach((l, i) => {
      const hasDate = /\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/.test(l);
      const amounts = l.match(amountRegex) || [];
      const tags = [];
      if (hasDate) tags.push('DATE');
      if (amounts.length) tags.push(`AMT(${amounts.join(',')})`);
      if (isNoiseLine(l)) tags.push('NOISE');
      const tx = parseLine(l);
      if (tx) tags.push(`OK→${tx.amount}`);
      out.push(`${String(i + 1).padStart(2, '0')} [${tags.join('|') || '—'}] ${l.slice(0, 120)}`);
    });
    if (failures.length) {
      out.push('');
      out.push(`=== LIGNES DATÉES REJETÉES (max 15) ===`);
      failures.slice(0, 15).forEach((l, i) => {
        out.push(`${i + 1}. ${l.slice(0, 160)}`);
      });
    }
    const panel = $('#diagnose-output');
    const content = $('#diagnose-content');
    if (panel && content) {
      content.textContent = out.join('\n');
      panel.hidden = false;
      panel.open = true;
    }
  }

  function flipAllSigns() {
    if (!lastAnalysis) return;
    lastAnalysis.transactions.forEach(t => { t.amount = -t.amount; });
    rerunAggregations();
  }

  function rerunAggregations() {
    const transactions = lastAnalysis.transactions;
    transactions.forEach(tx => { tx.category = categorise(tx); });

    const totalIncome = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalSavings = transactions
      .filter(t => t.category.id === 'savings' && t.amount < 0)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const cashflow = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? ((totalSavings + Math.max(cashflow, 0)) / totalIncome) * 100 : 0;
    const categoryTotals = {};
    for (const tx of transactions) {
      if (tx.amount >= 0) continue;
      const key = tx.category.id;
      if (!categoryTotals[key]) {
        categoryTotals[key] = { label: tx.category.label, total: 0, count: 0, type: tx.category.type, color: tx.category.color || null };
      }
      categoryTotals[key].total += Math.abs(tx.amount);
      categoryTotals[key].count += 1;
    }
    const fixedCosts = Object.values(categoryTotals).filter(c => c.type === 'fixed').reduce((s, c) => s + c.total, 0);
    const fees = Object.values(categoryTotals).filter(c => c.type === 'fees').reduce((s, c) => s + c.total, 0);
    const subscriptions = detectSubscriptions(transactions);
    const health = computeHealthScore({ savingsRate, totalIncome, fixedCosts, fees, totalSavings });

    Object.assign(lastAnalysis, {
      categoryTotals, income: totalIncome, expenses: totalExpenses,
      cashflow, savings: totalSavings, savingsRate, fixedCosts, fees, subscriptions, health
    });

    renderAlerts(lastAnalysis);
    renderHealthScore(health);
    renderKPIs(totalIncome, totalExpenses, cashflow, savingsRate);
    renderKPIDeltas(lastAnalysis);
    renderPieChart(categoryTotals, totalExpenses);
    renderBreakdown(categoryTotals, totalExpenses);
    renderTopExpenses(transactions);
    renderTransactions(transactions);
    renderSubscriptions(subscriptions);
    renderGoal();
    renderRecommendations(transactions, categoryTotals, totalIncome, totalExpenses, cashflow, totalSavings);
  }

  // Drag & drop
  ['dragenter', 'dragover'].forEach(ev => {
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragging');
    });
  });
  ['dragleave', 'drop'].forEach(ev => {
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (ev === 'dragleave' && e.target !== dropZone && !dropZone.contains(e.relatedTarget)) return;
      dropZone.classList.remove('dragging');
    });
  });
  dropZone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  // ---------- FILE HANDLER ----------
  async function handleFile(file) {
    if (!file) return;
    const name = file.name.toLowerCase();
    parseFeedback.textContent = `Lecture de "${file.name}"…`;
    try {
      if (name.endsWith('.pdf')) {
        const text = await extractTextFromPDF(file);
        dataInput.value = text;
      } else {
        const text = await readAsText(file);
        dataInput.value = preprocessByFormat(text, name);
      }
      updateParseFeedback();
    } catch (err) {
      parseFeedback.textContent = `Erreur : ${err.message}`;
      analyzeBtn.disabled = true;
    }
  }

  function readAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
      reader.readAsText(file);
    });
  }

  // ---------- PDF EXTRACTION ----------
  async function extractTextFromPDF(file) {
    await loadScript(CDN.pdfjs);
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = CDN.pdfjsWorker;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const allLines = [];
    // Track Débit/Crédit column X positions (carried across pages if headers repeat)
    let debitX = null, creditX = null;
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      // Detect header positions on this page (banks repeat headers per page)
      for (const item of content.items) {
        const t = (item.str || '').toLowerCase().trim();
        if (!t) continue;
        if (/^d[ée]bit(\s*euros)?$/.test(t) || /d[ée]bit\s+euros/.test(t)) debitX = item.transform[4];
        if (/^cr[ée]dit(\s*euros)?$/.test(t) || /cr[ée]dit\s+euros/.test(t)) creditX = item.transform[4];
      }
      const lines = groupItemsIntoLines(content.items, debitX, creditX);
      allLines.push(...lines);
    }
    return allLines.join('\n');
  }

  function groupItemsIntoLines(items, debitX, creditX) {
    const rows = {};
    for (const item of items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const bucket = Math.round(y / 3) * 3;
      if (!rows[bucket]) rows[bucket] = [];
      rows[bucket].push({ x: item.transform[4], str: item.str });
    }
    const haveColumns = debitX !== null && creditX !== null && creditX > debitX;
    const midX = haveColumns ? (debitX + creditX) / 2 : null;
    const sortedY = Object.keys(rows).map(Number).sort((a, b) => b - a);
    // French amount pattern: "30,00", "1.234,56", "1 234,56"
    const AMOUNT_RE = /^\d{1,3}(?:[.\s]\d{3})*,\d{2}$/;
    return sortedY.map(y => {
      const sorted = rows[y].sort((a, b) => a.x - b.x);
      let line = '';
      let lastX = -Infinity;
      for (const c of sorted) {
        let s = c.str;
        // If we know the column layout and this text looks like a French amount
        // located in the right half of the page, prefix it with - (Débit) or + (Crédit).
        if (haveColumns && AMOUNT_RE.test(s.trim()) && c.x > debitX - 30) {
          s = (c.x < midX ? '-' : '+') + s.trim();
        }
        if (lastX !== -Infinity && c.x - lastX > 20) line += '\t';
        else if (line) line += ' ';
        line += s;
        lastX = c.x + s.length * 5;
      }
      return line.trim();
    }).filter(Boolean);
  }

  // ---------- FORMAT PREPROCESSING ----------
  function preprocessByFormat(text, filename) {
    if (filename.endsWith('.ofx')) return ofxToText(text);
    if (filename.endsWith('.qif')) return qifToText(text);
    return text;
  }

  function ofxToText(ofx) {
    const lines = [];
    const blocks = ofx.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
    for (const block of blocks) {
      const date = (block.match(/<DTPOSTED>([^<\r\n]+)/i) || [])[1] || '';
      const amount = (block.match(/<TRNAMT>([^<\r\n]+)/i) || [])[1] || '';
      const memo = (block.match(/<MEMO>([^<\r\n]+)/i) || [])[1] || '';
      const name = (block.match(/<NAME>([^<\r\n]+)/i) || [])[1] || '';
      const libelle = (name + ' ' + memo).trim() || 'OFX';
      const isoDate = date.length >= 8 ? `${date.substr(6,2)}/${date.substr(4,2)}/${date.substr(0,4)}` : date;
      lines.push(`${isoDate}\t${libelle}\t${amount}`);
    }
    return lines.join('\n');
  }

  function qifToText(qif) {
    const lines = [];
    const blocks = qif.split(/^\^/m);
    for (const block of blocks) {
      const dateMatch = block.match(/^D(.+)$/m);
      const amountMatch = block.match(/^T(.+)$/m);
      const payeeMatch = block.match(/^P(.+)$/m);
      const memoMatch = block.match(/^M(.+)$/m);
      if (!dateMatch || !amountMatch) continue;
      const libelle = ((payeeMatch && payeeMatch[1]) || (memoMatch && memoMatch[1]) || 'QIF').trim();
      lines.push(`${dateMatch[1].trim()}\t${libelle}\t${amountMatch[1].trim()}`);
    }
    return lines.join('\n');
  }

  // ---------- DYNAMIC SCRIPT LOADING ----------
  const loadedScripts = new Set();
  function loadScript(src) {
    if (loadedScripts.has(src)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => { loadedScripts.add(src); resolve(); };
      s.onerror = () => reject(new Error(`Échec du chargement de la librairie : ${src}`));
      document.head.appendChild(s);
    });
  }

  function updateParseFeedback() {
    const txs = parseTransactions(dataInput.value);
    if (txs.length === 0) {
      parseFeedback.textContent = 'En attente de données…';
      analyzeBtn.disabled = true;
    } else {
      parseFeedback.textContent = `${txs.length} transaction${txs.length > 1 ? 's' : ''} détectée${txs.length > 1 ? 's' : ''}.`;
      analyzeBtn.disabled = false;
    }
  }

  // ---------- PARSER ----------
  // Skip noise lines (bank statement headers, footers, balances, IBANs…)
  const NOISE_RE = /^(solde\b|nouveau solde|ancien solde|ref\s*:|r[ée]f\.?\s|page\s+\d|<<|titulaire|date\s+valeur|situation|total\b|sous-?total|iban\b|bic\b|relev[ée]|votre conseiller|cic\s|compte de|livret\b|start\s+jeunes|information|num[ée]ro|sous r[ée]serve|en euros|tenue de compte|votre banque|adresse|m\.?\s|mme\b|mlle\b|monsieur|madame|tel\s*:|tél\s*:|t[ée]l\.|courriel|email|www\.|http|@|en cas|prochain|frais\b|cotisation\b|conditions)/i;
  function isNoiseLine(line) {
    if (!line) return true;
    if (line.length < 4) return true;
    if (NOISE_RE.test(line)) return true;
    return false;
  }
  // Continuation line heuristic: pure libellé text appended to previous tx
  // (no date, no amount, looks like merchant detail e.g. "ZITOUNA CARTE 8626").
  function isContinuationLine(line) {
    if (!line) return false;
    // Must NOT start with a date
    if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/.test(line)) return false;
    if (/^\d{4}-\d{2}-\d{2}/.test(line)) return false;
    // Must NOT look like a tabular line (multiple cells separated by \t / ;)
    if (line.includes('\t')) return false;
    if (line.includes(';')) return false;
    // No amount on the line
    const tokens = line.split(/\s+/).filter(Boolean);
    if (tokens.some(t => isAmount(t))) return false;
    // Should look like a merchant/detail line: mostly uppercase or mixed text
    return /[A-Za-zÀ-ÿ]/.test(line) && line.length <= 80;
  }
  function parseTransactions(raw) {
    if (!raw || !raw.trim()) return [];
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const transactions = [];
    for (const line of lines) {
      if (isNoiseLine(line)) continue;
      const tx = parseLine(line);
      if (tx) {
        transactions.push(tx);
      } else if (transactions.length && isContinuationLine(line)) {
        // Append to previous transaction's libellé
        const prev = transactions[transactions.length - 1];
        prev.libelle = (prev.libelle + ' ' + line).replace(/\s+/g, ' ').trim();
        prev.raw = prev.raw + ' | ' + line;
      }
    }
    return transactions;
  }

  function parseLine(line) {
    if (/^(date|libell|description|montant|amount|debit|credit|d[ée]bit|cr[ée]dit)/i.test(line)) return null;
    let parts;
    if (line.includes('\t')) parts = line.split('\t').map(p => p.trim());
    else if (line.includes(';')) parts = line.split(';').map(p => p.trim());
    else if (countCommas(line) >= 2 && !looksLikeFreeform(line)) parts = smartSplitCSV(line);
    else parts = freeformSplit(line);
    if (!parts || parts.length < 2) return null;

    // Extract date
    let date = null;
    const remaining = [];
    for (const p of parts) {
      if (!date && isDate(p)) { date = normaliseDate(p); continue; }
      remaining.push(p);
    }

    // Find amount-like cells among the remaining parts
    const amountIndexes = [];
    remaining.forEach((p, i) => { if (isAmount(p)) amountIndexes.push(i); });

    let amount = null;
    let amountSlots = new Set();

    if (amountIndexes.length >= 2) {
      // Multi-amount line: very likely a "Débit | Crédit" two-column format.
      // Heuristic: the first amount column is Débit (sortie → négatif),
      // the second is Crédit (entrée → positif). Empty/zero column is ignored.
      const vals = amountIndexes.map(i => ({ idx: i, val: parseAmount(remaining[i]) }));
      const nonZero = vals.filter(v => v.val !== 0 && !isNaN(v.val));
      if (nonZero.length === 1) {
        // Single non-zero: column position determines the sign.
        const position = vals.indexOf(nonZero[0]); // 0 = débit, 1+ = crédit
        const absV = Math.abs(nonZero[0].val);
        amount = position === 0 ? -absV : absV;
        amountSlots = new Set(amountIndexes);
      } else if (nonZero.length >= 2) {
        // Both filled (rare but possible: a transfer line). Keep the difference,
        // signed as crédit - débit so a net positive means an inflow.
        const debit = Math.abs(nonZero[0].val);
        const credit = Math.abs(nonZero[1].val);
        amount = credit - debit;
        amountSlots = new Set(amountIndexes);
      } else {
        // Only zeros: skip line
        return null;
      }
    } else if (amountIndexes.length === 1) {
      amount = parseAmount(remaining[amountIndexes[0]]);
      amountSlots = new Set([amountIndexes[0]]);
    } else {
      return null;
    }

    if (amount === null || isNaN(amount)) return null;
    // Require a real date: avoids parsing headers / orphan amount lines as tx
    if (!date) return null;

    const libelleParts = remaining.filter((_, i) => !amountSlots.has(i) && remaining[i]);
    const libelle = libelleParts.join(' ').replace(/\s+/g, ' ').trim();
    if (!libelle) return null;
    return { date, libelle, amount, raw: line };
  }

  function countCommas(s) { return (s.match(/,/g) || []).length; }
  function looksLikeFreeform(line) {
    const tabs = (line.match(/\t/g) || []).length;
    const semis = (line.match(/;/g) || []).length;
    return tabs === 0 && semis === 0 && /\s{2,}/.test(line);
  }
  function smartSplitCSV(line) {
    return line.split(',').map(p => p.trim());
  }
  function freeformSplit(line) {
    if (/\s{2,}/.test(line)) {
      return line.split(/\s{2,}/).map(p => p.trim()).filter(Boolean);
    }
    const dateMatch = line.match(/^(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{2}-\d{2})/);
    const amountMatch = line.match(/([+\-]?\s?\d{1,3}(?:[ .]\d{3})*(?:[,.]\d{1,2})?)\s*€?\s*$/);
    if (dateMatch && amountMatch) {
      const middle = line.substring(dateMatch[0].length, line.length - amountMatch[0].length).trim();
      return [dateMatch[0], middle, amountMatch[1].trim()];
    }
    return null;
  }
  function isDate(s) {
    return /^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/.test(s) || /^\d{4}-\d{2}-\d{2}$/.test(s);
  }
  function normaliseDate(s) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split('-');
      return `${d}/${m}/${y}`;
    }
    return s.replace(/[\-.]/g, '/');
  }
  function isAmount(s) {
    if (!s) return false;
    // Strip €/EUR and trailing D/C indicators (Crédit Agricole style)
    let cleaned = s.replace(/€|EUR/gi, '').replace(/[\s]?[DC]$/i, '').trim();
    // Allow trailing minus (e.g. "1234,56-")
    if (/-$/.test(cleaned) && !/^-/.test(cleaned)) cleaned = '-' + cleaned.slice(0, -1);
    // Require a decimal separator with 2 digits — avoids matching card numbers
    // ("8626"), order references, etc. as amounts. Bank statements always show
    // amounts with centimes (30,00 / 1.234,56).
    return /^[+\-]?\d{1,3}([ .]\d{3})*[,.]\d{2}$/.test(cleaned) ||
           /^[+\-]?\d+[,.]\d{2}$/.test(cleaned);
  }
  function parseAmount(s) {
    let raw = String(s).replace(/€|EUR/gi, '').trim();
    // Trailing D/C marker (Débit/Crédit)
    let trailingSign = null;
    const dcMatch = raw.match(/[\s]?([DC])$/i);
    if (dcMatch) {
      trailingSign = dcMatch[1].toUpperCase() === 'D' ? -1 : 1;
      raw = raw.replace(/[\s]?[DC]$/i, '').trim();
    }
    // Trailing minus (e.g. "1234,56-")
    let trailingMinus = false;
    if (/-$/.test(raw) && !/^-/.test(raw)) {
      trailingMinus = true;
      raw = raw.slice(0, -1).trim();
    }
    let cleaned = raw.replace(/\s/g, '');
    const negative = cleaned.startsWith('-');
    cleaned = cleaned.replace(/^[+\-]/, '');
    if (cleaned.includes('.') && cleaned.includes(',')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes(',')) {
      cleaned = cleaned.replace(',', '.');
    }
    let v = parseFloat(cleaned);
    if (negative || trailingMinus) v = -v;
    if (trailingSign !== null) v = Math.abs(v) * trailingSign;
    return v;
  }

  // ---------- CATEGORISATION ----------
  function categorise(tx) {
    // 1. Manual override saved in localStorage
    const overrides = getCatOverrides();
    const key = libelleKey(tx.libelle);
    if (overrides[key]) {
      const cat = findCategoryById(overrides[key]);
      if (cat) return cat;
    }
    // 2. Keyword match (custom rules first, then defaults)
    const lib = tx.libelle.toLowerCase();
    for (const cat of getAllCategories()) {
      for (const kw of (cat.keywords || [])) {
        if (kw && lib.includes(kw.toLowerCase())) return cat;
      }
    }
    // 3. Fallback
    if (tx.amount > 0) {
      return DEFAULT_CATEGORIES.find(c => c.id === 'income');
    }
    return OTHER_CATEGORY;
  }

  // ---------- ANALYSIS ----------
  function runAnalysis() {
    const transactions = parseTransactions(dataInput.value);
    if (transactions.length === 0) return;

    transactions.forEach(tx => { tx.category = categorise(tx); });

    const totalIncome = transactions
      .filter(t => t.amount > 0)
      .reduce((s, t) => s + t.amount, 0);

    const totalExpenses = transactions
      .filter(t => t.amount < 0)
      .reduce((s, t) => s + Math.abs(t.amount), 0);

    const totalSavings = transactions
      .filter(t => t.category.id === 'savings' && t.amount < 0)
      .reduce((s, t) => s + Math.abs(t.amount), 0);

    const cashflow = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? ((totalSavings + Math.max(cashflow, 0)) / totalIncome) * 100 : 0;

    const categoryTotals = {};
    for (const tx of transactions) {
      if (tx.amount >= 0) continue;
      const key = tx.category.id;
      if (!categoryTotals[key]) {
        categoryTotals[key] = { label: tx.category.label, total: 0, count: 0, type: tx.category.type, color: tx.category.color || null };
      }
      categoryTotals[key].total += Math.abs(tx.amount);
      categoryTotals[key].count += 1;
    }

    // Fixed costs ratio (for health score)
    const fixedCosts = Object.values(categoryTotals)
      .filter(c => c.type === 'fixed')
      .reduce((s, c) => s + c.total, 0);
    const fees = Object.values(categoryTotals)
      .filter(c => c.type === 'fees')
      .reduce((s, c) => s + c.total, 0);

    // Subscriptions detection
    const subscriptions = detectSubscriptions(transactions);

    // Health score
    const health = computeHealthScore({
      savingsRate, totalIncome, fixedCosts, fees, totalSavings
    });

    lastAnalysis = {
      transactions, categoryTotals,
      income: totalIncome, expenses: totalExpenses,
      cashflow, savings: totalSavings, savingsRate,
      fixedCosts, fees, subscriptions, health
    };

    // Render in order
    renderAlerts(lastAnalysis);
    renderHealthScore(health);
    renderKPIs(totalIncome, totalExpenses, cashflow, savingsRate);
    renderKPIDeltas(lastAnalysis);
    renderPieChart(categoryTotals, totalExpenses);
    renderLineChart();
    renderBreakdown(categoryTotals, totalExpenses);
    renderTopExpenses(transactions);
    renderTransactions(transactions);
    renderSubscriptions(subscriptions);
    renderGoal();
    renderRecommendations(transactions, categoryTotals, totalIncome, totalExpenses, cashflow, totalSavings);

    dashboard.classList.remove('hidden');
    recoSection.classList.remove('hidden');
    populateCompareSelect();
    dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- SUBSCRIPTIONS DETECTION ----------
  function normaliseLibelle(s) {
    return s.toLowerCase()
      .replace(/\b\d{1,2}\/\d{1,2}\/?\d{0,4}\b/g, '')
      .replace(/\b\d{2,}\b/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 20);
  }

  function detectSubscriptions(transactions) {
    // Group expenses by (normalised libellé + similar amount)
    const groups = {};
    for (const t of transactions) {
      if (t.amount >= 0) continue;
      const key = normaliseLibelle(t.libelle);
      if (!key || key.length < 3) continue;
      if (!groups[key]) groups[key] = { libelle: t.libelle, items: [] };
      groups[key].items.push(t);
    }

    const subs = [];
    for (const key in groups) {
      const g = groups[key];
      if (g.items.length < 2) {
        // Could still be a subscription if libellé matches a known service
        const lib = g.libelle.toLowerCase();
        const isKnownSub = DEFAULT_CATEGORIES.find(c => c.id === 'subscription')
          .keywords.some(kw => lib.includes(kw));
        if (!isKnownSub) continue;
      }
      // Pick the most frequent amount
      const amounts = g.items.map(i => Math.abs(i.amount));
      const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
      // Are amounts similar (within 10%)?
      const allSimilar = amounts.every(a => Math.abs(a - avgAmount) / avgAmount < 0.15);
      if (!allSimilar && g.items.length < 2) continue;

      subs.push({
        libelle: cleanLibelle(g.libelle),
        rawKey: key,
        count: g.items.length,
        monthly: avgAmount,
        annual: avgAmount * 12,
        items: g.items,
        category: g.items[0].category ? g.items[0].category.label : 'Autres'
      });
    }
    // Sort by monthly amount desc
    subs.sort((a, b) => b.monthly - a.monthly);
    return subs;
  }

  function cleanLibelle(s) {
    return s.replace(/\s+/g, ' ').trim().slice(0, 40);
  }

  function detectCompetingServices(subscriptions) {
    const warnings = [];
    for (const group of COMPETING_SERVICES) {
      const matches = subscriptions.filter(sub => {
        const lib = sub.libelle.toLowerCase();
        return group.ids.some(id => lib.includes(id));
      });
      if (matches.length >= 2) {
        warnings.push({
          label: group.label,
          subs: matches,
          total: matches.reduce((s, m) => s + m.monthly, 0)
        });
      }
    }
    return warnings;
  }

  // ---------- HEALTH SCORE ----------
  function computeHealthScore({ savingsRate, totalIncome, fixedCosts, fees, totalSavings }) {
    // 40 pts: savings rate (0% → 0, 20%+ → 40)
    const savingsPts = Math.max(0, Math.min(40, (savingsRate / 20) * 40));

    // 30 pts: fixed costs / income ratio (>70% → 0, <30% → 30)
    let fixedPts = 0;
    if (totalIncome > 0) {
      const ratio = fixedCosts / totalIncome;
      if (ratio <= 0.30) fixedPts = 30;
      else if (ratio >= 0.70) fixedPts = 0;
      else fixedPts = 30 * (1 - (ratio - 0.30) / 0.40);
    } else {
      fixedPts = 0;
    }

    // 20 pts: presence of recurring savings (binary if savings > 0)
    const savingsRecurringPts = totalSavings > 0 ? 20 : 0;

    // 10 pts: no bank fees (full if 0, linear decay until >20€)
    let feesPts = 10;
    if (fees > 0 && fees <= 20) feesPts = 10 * (1 - fees / 20);
    else if (fees > 20) feesPts = 0;

    const total = Math.round(savingsPts + fixedPts + savingsRecurringPts + feesPts);
    let interpretation, level, advice;
    if (total >= 80) {
      interpretation = 'Excellent';
      level = 'pos';
      advice = 'Continuez ainsi. Pensez à diversifier vos placements long terme.';
    } else if (total >= 60) {
      interpretation = 'Bon';
      level = 'pos';
      advice = 'Solide. Optimisez les charges fixes pour gagner 10-15 points.';
    } else if (total >= 40) {
      interpretation = 'À surveiller';
      level = 'warn';
      advice = 'Augmentez le taux d\'épargne en automatisant un virement programmé en début de mois.';
    } else {
      interpretation = 'Fragile';
      level = 'neg';
      advice = 'Priorité : reconstituer une épargne de précaution (3 mois de dépenses).';
    }

    return {
      total,
      level,
      interpretation,
      advice,
      breakdown: [
        { label: 'Taux d\'épargne', value: Math.round(savingsPts), max: 40 },
        { label: 'Charges fixes / revenus', value: Math.round(fixedPts), max: 30 },
        { label: 'Épargne récurrente', value: Math.round(savingsRecurringPts), max: 20 },
        { label: 'Absence de frais', value: Math.round(feesPts), max: 10 }
      ]
    };
  }

  function renderHealthScore(health) {
    const valEl = $('#health-score-value');
    const interpEl = $('#health-interpretation');
    const breakdownEl = $('#health-breakdown');
    valEl.textContent = health.total;
    valEl.classList.remove('pos', 'warn', 'neg');
    valEl.classList.add(health.level);
    interpEl.innerHTML = `<strong>${escapeHTML(health.interpretation)}</strong> — ${escapeHTML(health.advice)}`;
    breakdownEl.innerHTML = health.breakdown.map(b => `
      <li><span>${escapeHTML(b.label)}</span><span class="pts">${b.value}/${b.max}</span></li>
    `).join('');
  }

  // ---------- ALERTS ----------
  function renderAlerts(analysis) {
    const container = $('#alerts-container');
    container.innerHTML = '';
    const alerts = [];

    // Compare with previous snapshot
    const history = getHistory();
    if (history.length > 0) {
      const prev = history[history.length - 1];
      // Compare category totals: detect rises > 20%
      const prevCats = prev.categoryTotals || {};
      for (const id in analysis.categoryTotals) {
        const curr = analysis.categoryTotals[id];
        const prevCat = prevCats[id];
        if (!prevCat || prevCat.total < 20) continue;
        const change = (curr.total - prevCat.total) / prevCat.total;
        if (change > 0.20) {
          alerts.push({
            type: 'warn',
            badge: '+' + Math.round(change * 100) + '%',
            text: `Hausse sur <strong>${escapeHTML(curr.label)}</strong> : ${fmt(prevCat.total)} → ${fmt(curr.total)}`
          });
        }
      }
      // New subscriptions
      const prevSubKeys = new Set((prev.subscriptions || []).map(s => s.rawKey));
      for (const sub of analysis.subscriptions) {
        if (!prevSubKeys.has(sub.rawKey)) {
          alerts.push({
            type: 'info',
            badge: 'NEW',
            text: `Nouvel abonnement détecté : <strong>${escapeHTML(sub.libelle)}</strong> (${fmt(sub.monthly)}/mois)`
          });
        }
      }
      // Cashflow drop
      if (prev.cashflow != null && analysis.cashflow < prev.cashflow - 200) {
        alerts.push({
          type: 'neg',
          badge: '↓',
          text: `Cash-flow en baisse de <strong>${fmt(prev.cashflow - analysis.cashflow)}</strong> vs mois précédent.`
        });
      }
    }

    // Competing services
    const competing = detectCompetingServices(analysis.subscriptions);
    for (const w of competing) {
      alerts.push({
        type: 'warn',
        badge: '⚠',
        text: `Services concurrents (${escapeHTML(w.label)}) : ${w.subs.map(s => escapeHTML(s.libelle)).join(', ')}. Total ${fmt(w.total)}/mois.`
      });
    }

    // Cashflow negative
    if (analysis.cashflow < 0) {
      alerts.unshift({
        type: 'neg',
        badge: '!',
        text: `Cash-flow négatif : <strong>${fmt(Math.abs(analysis.cashflow))}</strong> de dépassement.`
      });
    }

    // Excellent savings rate
    if (analysis.savingsRate >= 25) {
      alerts.push({
        type: 'pos',
        badge: '★',
        text: `Excellent taux d'épargne (${fmtPct(analysis.savingsRate)}). Maintenez le cap.`
      });
    }

    if (alerts.length === 0) {
      container.classList.add('hidden');
      return;
    }
    container.classList.remove('hidden');
    for (const a of alerts) {
      const el = document.createElement('div');
      el.className = `alert alert-${a.type}`;
      el.innerHTML = `<span class="alert-badge">${escapeHTML(a.badge)}</span><span>${a.text}</span>`;
      container.appendChild(el);
    }
  }

  // ---------- KPI ----------
  function renderKPIs(income, expenses, cashflow, savingsRate) {
    $('#kpi-income').textContent = fmt(income);
    $('#kpi-expenses').textContent = fmt(expenses);
    const cf = $('#kpi-cashflow');
    cf.textContent = fmtSigned(cashflow);
    cf.classList.remove('pos', 'neg');
    cf.classList.add(cashflow >= 0 ? 'pos' : 'neg');

    const sr = $('#kpi-savings-rate');
    sr.textContent = fmtPct(savingsRate);
    sr.classList.remove('pos', 'neg', 'warn');
    if (savingsRate >= 20) sr.classList.add('pos');
    else if (savingsRate >= 10) sr.classList.add('warn');
    else sr.classList.add('neg');
  }

  function renderKPIDeltas(analysis) {
    const history = getHistory();
    const targets = {
      income:    $('#kpi-income-delta'),
      expenses:  $('#kpi-expenses-delta'),
      cashflow:  $('#kpi-cashflow-delta'),
      savings:   $('#kpi-savings-delta')
    };
    Object.values(targets).forEach(el => { el.textContent = ''; el.classList.remove('pos', 'neg'); });
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setDelta(targets.income, analysis.income, prev.income, true);
    setDelta(targets.expenses, analysis.expenses, prev.expenses, false);
    setDelta(targets.cashflow, analysis.cashflow, prev.cashflow, true);
    setDelta(targets.savings, analysis.savingsRate, prev.savingsRate, true, true);
  }
  function setDelta(el, curr, prev, posIsGood, isPercent) {
    if (prev == null) return;
    const diff = curr - prev;
    if (Math.abs(diff) < 0.5 && !isPercent) return;
    if (isPercent && Math.abs(diff) < 0.1) return;
    const sign = diff > 0 ? '+' : '';
    const valStr = isPercent ? `${sign}${diff.toFixed(1)} pt` : `${sign}${fmt(diff).replace('€','€')}`;
    el.textContent = `${valStr} vs précédent`;
    const good = (diff > 0 && posIsGood) || (diff < 0 && !posIsGood);
    el.classList.add(good ? 'pos' : 'neg');
  }

  // ---------- BREAKDOWN ----------
  function renderBreakdown(catTotals, totalExpenses) {
    const container = $('#category-breakdown');
    container.innerHTML = '';
    const sorted = Object.values(catTotals).sort((a, b) => b.total - a.total);
    if (sorted.length === 0) {
      container.innerHTML = '<p class="help-text">Aucune dépense détectée.</p>';
      return;
    }
    const max = sorted[0].total;
    for (const cat of sorted) {
      const pct = totalExpenses > 0 ? (cat.total / totalExpenses) * 100 : 0;
      const fillPct = (cat.total / max) * 100;
      const row = document.createElement('div');
      row.className = 'bar-row';
      const fillStyle = cat.color ? `width:${fillPct}%;background:${cat.color}` : `width:${fillPct}%`;
      row.innerHTML = `
        <div class="bar-meta">
          <span class="label">${escapeHTML(cat.label)} <span class="amount">(${pct.toFixed(0)}%)</span></span>
          <span class="amount">${fmt(cat.total)}</span>
        </div>
        <div class="bar"><div class="bar-fill" style="${fillStyle}"></div></div>
      `;
      container.appendChild(row);
    }
  }

  // ---------- PIE CHART (SVG) ----------
  function renderPieChart(catTotals, totalExpenses) {
    const container = $('#pie-chart');
    container.innerHTML = '';
    const data = Object.values(catTotals).sort((a, b) => b.total - a.total);
    if (data.length === 0 || totalExpenses === 0) {
      container.innerHTML = '<p class="help-text">—</p>';
      return;
    }
    const size = 140, cx = size / 2, cy = size / 2, r = 60;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('aria-label', 'Répartition par catégorie');

    // Monochrome grayscale gradient
    const shades = ['#1c1917', '#44403c', '#57534e', '#78716c', '#a8a29e', '#d6d3d1', '#e7e5e4'];
    let angle = -Math.PI / 2;
    data.forEach((d, i) => {
      const slice = (d.total / totalExpenses) * Math.PI * 2;
      const x1 = cx + r * Math.cos(angle);
      const y1 = cy + r * Math.sin(angle);
      const x2 = cx + r * Math.cos(angle + slice);
      const y2 = cy + r * Math.sin(angle + slice);
      const largeArc = slice > Math.PI ? 1 : 0;
      const path = document.createElementNS(svgNS, 'path');
      const d3 = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      path.setAttribute('d', d3);
      path.setAttribute('fill', d.color || shades[i % shades.length]);
      path.setAttribute('stroke', 'var(--surface)');
      path.setAttribute('stroke-width', '1');
      svg.appendChild(path);
      angle += slice;
    });

    // Inner hole for donut look
    const hole = document.createElementNS(svgNS, 'circle');
    hole.setAttribute('cx', cx);
    hole.setAttribute('cy', cy);
    hole.setAttribute('r', r * 0.55);
    hole.setAttribute('fill', 'var(--surface)');
    svg.appendChild(hole);

    container.appendChild(svg);
  }

  // ---------- LINE CHART (SVG) ----------
  function renderLineChart() {
    const container = $('#line-chart');
    container.innerHTML = '';
    const history = getHistory();
    if (history.length < 2) {
      container.innerHTML = '<p class="help-text">Enregistrez au moins 2 analyses pour voir l\'évolution.</p>';
      return;
    }
    const recent = history.slice(-6);
    const w = 460, h = 180, pad = { l: 40, r: 12, t: 12, b: 24 };
    const innerW = w - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;
    const maxV = Math.max(...recent.map(p => Math.max(p.income || 0, p.expenses || 0)));
    const minV = Math.min(0, ...recent.map(p => Math.min(p.cashflow || 0)));
    const range = maxV - minV || 1;

    const xFor = (i) => pad.l + (recent.length === 1 ? innerW / 2 : (i / (recent.length - 1)) * innerW);
    const yFor = (v) => pad.t + innerH - ((v - minV) / range) * innerH;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('aria-label', 'Évolution sur les derniers mois');

    // Y axis baseline (0)
    const y0 = yFor(0);
    const baseline = document.createElementNS(svgNS, 'line');
    baseline.setAttribute('x1', pad.l); baseline.setAttribute('y1', y0);
    baseline.setAttribute('x2', pad.l + innerW); baseline.setAttribute('y2', y0);
    baseline.setAttribute('stroke', 'var(--border)');
    baseline.setAttribute('stroke-dasharray', '2 3');
    svg.appendChild(baseline);

    const series = [
      { key: 'income', label: 'Revenus', color: 'var(--pos)', dash: null },
      { key: 'expenses', label: 'Dépenses', color: 'var(--neg)', dash: null },
      { key: 'cashflow', label: 'Cash-flow', color: 'var(--text)', dash: '3 3' }
    ];
    for (const s of series) {
      const pts = recent.map((p, i) => `${xFor(i)},${yFor(p[s.key] || 0)}`).join(' ');
      const poly = document.createElementNS(svgNS, 'polyline');
      poly.setAttribute('points', pts);
      poly.setAttribute('fill', 'none');
      poly.setAttribute('stroke', s.color);
      poly.setAttribute('stroke-width', '1.5');
      if (s.dash) poly.setAttribute('stroke-dasharray', s.dash);
      svg.appendChild(poly);

      recent.forEach((p, i) => {
        const c = document.createElementNS(svgNS, 'circle');
        c.setAttribute('cx', xFor(i)); c.setAttribute('cy', yFor(p[s.key] || 0));
        c.setAttribute('r', '2.5');
        c.setAttribute('fill', s.color);
        const title = document.createElementNS(svgNS, 'title');
        title.textContent = `${s.label} — ${formatHistoryDate(p.date)} : ${fmt(p[s.key] || 0)}`;
        c.appendChild(title);
        svg.appendChild(c);
      });
    }

    // X axis labels
    recent.forEach((p, i) => {
      const t = document.createElementNS(svgNS, 'text');
      t.setAttribute('x', xFor(i));
      t.setAttribute('y', h - 6);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('font-size', '10');
      t.setAttribute('fill', 'var(--text-muted)');
      t.textContent = shortHistoryDate(p.date);
      svg.appendChild(t);
    });

    // Y axis labels (min, mid, max)
    [maxV, (maxV + minV) / 2, minV].forEach(v => {
      const t = document.createElementNS(svgNS, 'text');
      t.setAttribute('x', pad.l - 6);
      t.setAttribute('y', yFor(v) + 3);
      t.setAttribute('text-anchor', 'end');
      t.setAttribute('font-size', '9');
      t.setAttribute('fill', 'var(--text-muted)');
      t.textContent = Math.round(v) + '€';
      svg.appendChild(t);
    });

    // Legend
    const legend = document.createElementNS(svgNS, 'g');
    series.forEach((s, i) => {
      const lx = pad.l + i * 110;
      const ly = pad.t + 4;
      const sw = document.createElementNS(svgNS, 'rect');
      sw.setAttribute('x', lx); sw.setAttribute('y', ly - 6);
      sw.setAttribute('width', 8); sw.setAttribute('height', 2);
      sw.setAttribute('fill', s.color);
      legend.appendChild(sw);
      const tx = document.createElementNS(svgNS, 'text');
      tx.setAttribute('x', lx + 12); tx.setAttribute('y', ly);
      tx.setAttribute('font-size', '10');
      tx.setAttribute('fill', 'var(--text-muted)');
      tx.textContent = s.label;
      legend.appendChild(tx);
    });
    svg.appendChild(legend);

    container.appendChild(svg);
  }

  function formatHistoryDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function shortHistoryDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  }

  // ---------- TOP EXPENSES ----------
  function renderTopExpenses(transactions) {
    const tbody = $('#top-expenses-table tbody');
    tbody.innerHTML = '';
    const top = transactions
      .filter(t => t.amount < 0)
      .sort((a, b) => a.amount - b.amount)
      .slice(0, 5);
    if (top.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2" class="help-text">Aucune dépense.</td></tr>';
      return;
    }
    for (const t of top) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHTML(t.libelle)}</td><td class="num neg">${fmt(t.amount)}</td>`;
      tbody.appendChild(tr);
    }
  }

  // ---------- TRANSACTIONS (with inline category editing) ----------
  function renderTransactions(transactions) {
    const tbody = $('#transactions-table tbody');
    const filterSelect = $('#filter-category');

    const categories = Array.from(new Set(transactions.map(t => t.category.label))).sort();
    filterSelect.innerHTML = '<option value="">Toutes catégories</option>' +
      categories.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');

    function render(filter) {
      tbody.innerHTML = '';
      const filtered = filter ? transactions.filter(t => t.category.label === filter) : transactions;
      filtered.forEach((t, idx) => {
        const tr = document.createElement('tr');
        const amountClass = t.amount >= 0 ? 'pos' : 'neg';
        tr.innerHTML = `
          <td>${escapeHTML(t.date)}</td>
          <td>${escapeHTML(t.libelle)}</td>
          <td><span class="cat-tag" data-tx-idx="${idx}">${escapeHTML(t.category.label)}</span></td>
          <td class="num ${amountClass}">${fmtSigned(t.amount)}</td>
        `;
        tbody.appendChild(tr);
      });
      // Wire up click → dropdown editing
      tbody.querySelectorAll('.cat-tag').forEach(tag => {
        tag.addEventListener('click', () => openCategoryEditor(tag, filtered, transactions));
      });
    }
    render('');
    filterSelect.onchange = () => render(filterSelect.value);
  }

  function openCategoryEditor(tagEl, filteredList, allTransactions) {
    if (tagEl.classList.contains('editing')) return;
    const idx = parseInt(tagEl.dataset.txIdx, 10);
    const tx = filteredList[idx];
    if (!tx) return;
    const cats = [...getAllCategories(), OTHER_CATEGORY];
    const currentId = tx.category.id;
    const select = document.createElement('select');
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.label;
      if (c.id === currentId) opt.selected = true;
      select.appendChild(opt);
    });
    tagEl.classList.add('editing');
    tagEl.innerHTML = '';
    tagEl.appendChild(select);
    select.focus();
    const commit = () => {
      const newCat = findCategoryById(select.value);
      tx.category = newCat;
      setCatOverride(tx.libelle, newCat.id);
      // Recompute & re-render the dashboard with new category
      recategoriseAndRefresh(allTransactions);
    };
    select.addEventListener('change', commit);
    select.addEventListener('blur', () => {
      if (tagEl.classList.contains('editing')) {
        tagEl.classList.remove('editing');
        tagEl.textContent = tx.category.label;
      }
    });
  }

  function recategoriseAndRefresh(transactions) {
    transactions.forEach(tx => { tx.category = categorise(tx); });
    // Recompute categoryTotals
    const categoryTotals = {};
    for (const tx of transactions) {
      if (tx.amount >= 0) continue;
      const key = tx.category.id;
      if (!categoryTotals[key]) {
        categoryTotals[key] = { label: tx.category.label, total: 0, count: 0, type: tx.category.type, color: tx.category.color || null };
      }
      categoryTotals[key].total += Math.abs(tx.amount);
      categoryTotals[key].count += 1;
    }
    lastAnalysis.categoryTotals = categoryTotals;
    lastAnalysis.fixedCosts = Object.values(categoryTotals).filter(c => c.type === 'fixed').reduce((s, c) => s + c.total, 0);
    lastAnalysis.fees = Object.values(categoryTotals).filter(c => c.type === 'fees').reduce((s, c) => s + c.total, 0);
    lastAnalysis.subscriptions = detectSubscriptions(transactions);
    lastAnalysis.health = computeHealthScore(lastAnalysis);
    renderHealthScore(lastAnalysis.health);
    renderBreakdown(categoryTotals, lastAnalysis.expenses);
    renderPieChart(categoryTotals, lastAnalysis.expenses);
    renderTransactions(transactions);
    renderSubscriptions(lastAnalysis.subscriptions);
  }

  // ---------- SUBSCRIPTIONS RENDER ----------
  function renderSubscriptions(subs) {
    const container = $('#subscriptions-container');
    const summary = $('#subs-total-summary');
    container.innerHTML = '';
    if (!subs || subs.length === 0) {
      container.innerHTML = '<p class="help-text">Aucun abonnement détecté pour l\'instant.</p>';
      summary.textContent = '';
      return;
    }
    const totalMonthly = subs.reduce((s, x) => s + x.monthly, 0);
    const totalAnnual = totalMonthly * 12;

    // Totals
    const totals = document.createElement('div');
    totals.className = 'subs-totals';
    totals.innerHTML = `
      <div class="subs-total">
        <span class="subs-total-label">Total mensuel</span>
        <span class="subs-total-value">${fmt(totalMonthly)}</span>
      </div>
      <div class="subs-total">
        <span class="subs-total-label">Projection annuelle</span>
        <span class="subs-total-value">${fmt(totalAnnual)}</span>
      </div>
    `;
    container.appendChild(totals);
    summary.textContent = `${subs.length} abonnement${subs.length > 1 ? 's' : ''} · ${fmt(totalMonthly)}/mois`;

    // Competing services warnings
    const competing = detectCompetingServices(subs);
    for (const w of competing) {
      const el = document.createElement('div');
      el.className = 'subs-duplicate-warning';
      el.innerHTML = `<strong>${escapeHTML(w.label)}</strong> — vous payez plusieurs services concurrents : ${w.subs.map(s => `<em>${escapeHTML(s.libelle)}</em>`).join(', ')}. En garder un seul économiserait jusqu'à <strong>${fmt(w.total - Math.min(...w.subs.map(s => s.monthly)))}</strong>/mois.`;
      container.appendChild(el);
    }

    // List
    const list = document.createElement('div');
    list.className = 'subs-list';
    for (const sub of subs) {
      const row = document.createElement('div');
      row.className = 'sub-item';
      row.innerHTML = `
        <div>
          <div class="sub-name">${escapeHTML(sub.libelle)}</div>
          <div class="sub-meta">${escapeHTML(sub.category)} · ${sub.count} prélèvement${sub.count > 1 ? 's' : ''} détecté${sub.count > 1 ? 's' : ''}</div>
        </div>
        <div class="sub-amount">${fmt(sub.monthly)}/mois</div>
        <div class="sub-annual">${fmt(sub.annual)}/an</div>
      `;
      list.appendChild(row);
    }
    container.appendChild(list);
  }

  // ---------- GOAL ----------
  const goalForm = $('#goal-form');
  const goalAmountInput = $('#goal-amount');
  const goalMonthsInput = $('#goal-months');
  const goalResult = $('#goal-result');
  const goalClearBtn = $('#goal-clear');

  goalForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseFloat(goalAmountInput.value);
    const months = parseInt(goalMonthsInput.value, 10);
    if (!amount || !months || amount <= 0 || months <= 0) return;
    lsSet(LS.goal, { amount, months, savedAt: new Date().toISOString() });
    renderGoal();
  });
  goalClearBtn.addEventListener('click', () => {
    lsRemove(LS.goal);
    goalAmountInput.value = '';
    goalMonthsInput.value = '';
    goalResult.classList.remove('visible');
    goalResult.innerHTML = '';
  });

  function renderGoal() {
    const goal = lsGet(LS.goal, null);
    if (!goal) {
      goalResult.classList.remove('visible');
      goalResult.innerHTML = '';
      return;
    }
    goalAmountInput.value = goal.amount;
    goalMonthsInput.value = goal.months;
    const required = goal.amount / goal.months;
    const available = lastAnalysis ? Math.max(0, lastAnalysis.savings + Math.max(lastAnalysis.cashflow, 0)) : 0;
    const progressPct = Math.min(100, (available / required) * 100);
    let verdictClass = 'neg', verdictText;
    if (!lastAnalysis) {
      verdictClass = 'warn';
      verdictText = `Cible : <strong>${fmt(required)}/mois</strong>. Lancez une analyse pour voir votre progression.`;
    } else if (available >= required) {
      verdictClass = 'pos';
      verdictText = `Objectif tenable. Vous épargnez <strong>${fmt(available)}/mois</strong>, soit ${(available / required * 100).toFixed(0)}% de la cible (${fmt(required)}/mois).`;
    } else if (available >= required * 0.7) {
      verdictClass = 'warn';
      verdictText = `Objectif proche. Vous épargnez <strong>${fmt(available)}/mois</strong>, manque <strong>${fmt(required - available)}/mois</strong> pour atteindre la cible (${fmt(required)}/mois).`;
    } else {
      verdictClass = 'neg';
      verdictText = `Objectif difficile : vous épargnez <strong>${fmt(available)}/mois</strong>, soit ${(available / required * 100).toFixed(0)}% seulement de la cible (${fmt(required)}/mois). Réduisez les variables ou allongez la durée.`;
    }
    goalResult.classList.add('visible');
    goalResult.innerHTML = `
      <div class="goal-stats">
        <span>Objectif : <strong>${fmt(goal.amount)}</strong> en ${goal.months} mois</span>
        <span>À épargner : <strong>${fmt(required)}/mois</strong></span>
        <span>Réalisé ce mois : <strong>${fmt(available)}</strong></span>
      </div>
      <div class="goal-progress"><div class="goal-progress-fill ${verdictClass === 'pos' ? '' : verdictClass}" style="width:${progressPct}%"></div></div>
      <div class="goal-verdict ${verdictClass}">${verdictText}</div>
    `;
  }

  // ---------- CUSTOM CATEGORIES UI ----------
  const addCatBtn = $('#add-category-btn');
  const customCatForm = $('#custom-category-form');
  const ccName = $('#cc-name');
  const ccKeywords = $('#cc-keywords');
  const ccColor = $('#cc-color');
  const ccCancel = $('#cc-cancel');

  addCatBtn.addEventListener('click', () => {
    customCatForm.classList.remove('hidden');
    customCatForm.dataset.editing = '';
    ccName.value = '';
    ccKeywords.value = '';
    ccColor.value = '#0f172a';
    ccName.focus();
  });
  ccCancel.addEventListener('click', () => {
    customCatForm.classList.add('hidden');
    customCatForm.dataset.editing = '';
  });
  customCatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = ccName.value.trim();
    const kws = ccKeywords.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const color = ccColor.value;
    if (!name || kws.length === 0) return;
    const cats = getCustomCategories();
    const editingId = customCatForm.dataset.editing;
    if (editingId) {
      const idx = cats.findIndex(c => c.id === editingId);
      if (idx >= 0) cats[idx] = { ...cats[idx], label: name, keywords: kws, color };
    } else {
      const id = 'custom_' + Date.now();
      cats.push({ id, label: name, type: 'variable', keywords: kws, color });
    }
    setCustomCategories(cats);
    customCatForm.classList.add('hidden');
    customCatForm.dataset.editing = '';
    renderCustomCategoriesList();
    if (lastAnalysis) recategoriseAndRefresh(lastAnalysis.transactions);
  });

  function renderCustomCategoriesList() {
    const container = $('#custom-categories-list');
    container.innerHTML = '';
    const cats = getCustomCategories();
    if (cats.length === 0) {
      container.innerHTML = '<p class="help-text">Aucune catégorie personnalisée. Créez-en une pour affiner la classification.</p>';
      return;
    }
    for (const cat of cats) {
      const row = document.createElement('div');
      row.className = 'custom-cat-row';
      row.innerHTML = `
        <span class="swatch" style="background:${cat.color || '#0f172a'}"></span>
        <span><strong>${escapeHTML(cat.label)}</strong></span>
        <span class="kw">${escapeHTML((cat.keywords || []).join(', '))}</span>
        <span>
          <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${cat.id}">Éditer</button>
          <button class="btn btn-ghost btn-sm" data-action="delete" data-id="${cat.id}">Supprimer</button>
        </span>
      `;
      container.appendChild(row);
    }
    container.querySelectorAll('button[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = getCustomCategories().find(c => c.id === btn.dataset.id);
        if (!cat) return;
        customCatForm.classList.remove('hidden');
        customCatForm.dataset.editing = cat.id;
        ccName.value = cat.label;
        ccKeywords.value = (cat.keywords || []).join(', ');
        ccColor.value = cat.color || '#0f172a';
      });
    });
    container.querySelectorAll('button[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const cats = getCustomCategories().filter(c => c.id !== id);
        setCustomCategories(cats);
        renderCustomCategoriesList();
        if (lastAnalysis) recategoriseAndRefresh(lastAnalysis.transactions);
      });
    });
  }

  // ---------- HISTORY ----------
  function getHistory() {
    return lsGet(LS.history, []);
  }
  function setHistory(arr) {
    lsSet(LS.history, arr);
  }

  $('#save-snapshot').addEventListener('click', () => {
    if (!lastAnalysis) {
      alert('Lancez d\'abord une analyse.');
      return;
    }
    const snap = {
      id: 'snap_' + Date.now(),
      date: new Date().toISOString(),
      income: lastAnalysis.income,
      expenses: lastAnalysis.expenses,
      cashflow: lastAnalysis.cashflow,
      savings: lastAnalysis.savings,
      savingsRate: lastAnalysis.savingsRate,
      health: lastAnalysis.health.total,
      categoryTotals: lastAnalysis.categoryTotals,
      subscriptions: lastAnalysis.subscriptions.map(s => ({ rawKey: s.rawKey, libelle: s.libelle, monthly: s.monthly }))
    };
    const history = getHistory();
    history.push(snap);
    // Keep last 24
    if (history.length > 24) history.shift();
    setHistory(history);
    renderHistoryList();
    renderLineChart();
    populateCompareSelect();
  });

  $('#clear-history').addEventListener('click', () => {
    if (!confirm('Effacer tout l\'historique ?')) return;
    setHistory([]);
    renderHistoryList();
    renderLineChart();
    populateCompareSelect();
  });

  function renderHistoryList() {
    const container = $('#history-list');
    container.innerHTML = '';
    const history = getHistory();
    if (history.length === 0) {
      container.innerHTML = '<p class="help-text">Aucune analyse enregistrée. Cliquez sur « Enregistrer cette analyse » après une analyse.</p>';
      return;
    }
    // Show most recent first
    [...history].reverse().forEach(h => {
      const row = document.createElement('div');
      row.className = 'history-item';
      row.innerHTML = `
        <span class="date">${formatHistoryDate(h.date)}</span>
        <span class="metric">Revenus <strong>${fmt(h.income)}</strong></span>
        <span class="metric">Dépenses <strong>${fmt(h.expenses)}</strong></span>
        <span class="metric">Cash-flow <strong>${fmtSigned(h.cashflow)}</strong></span>
        <span class="metric">Score <strong>${h.health || '—'}/100</strong></span>
        <button class="btn btn-ghost btn-sm" data-id="${h.id}">Supprimer</button>
      `;
      container.appendChild(row);
    });
    container.querySelectorAll('button[data-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        setHistory(getHistory().filter(h => h.id !== btn.dataset.id));
        renderHistoryList();
        renderLineChart();
        populateCompareSelect();
      });
    });
  }

  function populateCompareSelect() {
    const sel = $('#compare-select');
    if (!sel) return;
    const history = getHistory();
    const current = sel.value;
    sel.innerHTML = '<option value="">Comparer avec…</option>' +
      [...history].reverse().map(h => `<option value="${h.id}">${formatHistoryDate(h.date)} — score ${h.health || '—'}</option>`).join('');
    sel.value = current || '';
  }

  $('#compare-select').addEventListener('change', (e) => {
    if (!lastAnalysis || !e.target.value) {
      // Reset deltas to default (compared with last)
      renderKPIDeltas(lastAnalysis);
      return;
    }
    const snap = getHistory().find(h => h.id === e.target.value);
    if (!snap) return;
    // Render KPI deltas against the chosen snapshot
    const targets = {
      income:    $('#kpi-income-delta'),
      expenses:  $('#kpi-expenses-delta'),
      cashflow:  $('#kpi-cashflow-delta'),
      savings:   $('#kpi-savings-delta')
    };
    Object.values(targets).forEach(el => { el.textContent = ''; el.classList.remove('pos', 'neg'); });
    setDelta(targets.income, lastAnalysis.income, snap.income, true);
    setDelta(targets.expenses, lastAnalysis.expenses, snap.expenses, false);
    setDelta(targets.cashflow, lastAnalysis.cashflow, snap.cashflow, true);
    setDelta(targets.savings, lastAnalysis.savingsRate, snap.savingsRate, true, true);
  });

  // ---------- EXPORTS ----------
  function exportCSV() {
    if (!lastAnalysis) return;
    const rows = [['Date', 'Libellé', 'Catégorie', 'Type', 'Montant']];
    for (const t of lastAnalysis.transactions) {
      rows.push([
        t.date,
        csvEscape(t.libelle),
        t.category.label,
        t.category.type,
        t.amount.toFixed(2).replace('.', ',')
      ]);
    }
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `budget-scanner-${dateStamp()}.csv`);
  }

  function csvEscape(s) {
    s = String(s || '');
    if (/[";\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  async function exportXLSX() {
    if (!lastAnalysis) return;
    const originalLabel = exportXlsxBtn.textContent;
    exportXlsxBtn.textContent = 'Génération…';
    exportXlsxBtn.disabled = true;
    try {
      await loadScript(CDN.xlsx);
      const XLSX = window.XLSX;
      const wb = XLSX.utils.book_new();

      // Sheet 1: Transactions
      const txData = [['Date', 'Libellé', 'Catégorie', 'Type', 'Montant (€)']];
      for (const t of lastAnalysis.transactions) {
        txData.push([t.date, t.libelle, t.category.label, t.category.type, t.amount]);
      }
      const txSheet = XLSX.utils.aoa_to_sheet(txData);
      XLSX.utils.book_append_sheet(wb, txSheet, 'Transactions');

      // Sheet 2: Synthèse
      const synth = [
        ['Indicateur', 'Valeur'],
        ['Revenus', lastAnalysis.income],
        ['Dépenses', lastAnalysis.expenses],
        ['Cash-flow', lastAnalysis.cashflow],
        ['Épargne', lastAnalysis.savings],
        ['Taux d\'épargne (%)', +lastAnalysis.savingsRate.toFixed(2)],
        ['Score santé', lastAnalysis.health.total]
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(synth), 'Synthèse');

      // Sheet 3: Catégories
      const catData = [['Catégorie', 'Type', 'Total (€)', 'Nb transactions']];
      Object.values(lastAnalysis.categoryTotals)
        .sort((a, b) => b.total - a.total)
        .forEach(c => catData.push([c.label, c.type, +c.total.toFixed(2), c.count]));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(catData), 'Catégories');

      // Sheet 4: Abonnements
      if (lastAnalysis.subscriptions.length > 0) {
        const subData = [['Libellé', 'Catégorie', 'Mensuel (€)', 'Annuel (€)', 'Occurrences']];
        lastAnalysis.subscriptions.forEach(s => {
          subData.push([s.libelle, s.category, +s.monthly.toFixed(2), +s.annual.toFixed(2), s.count]);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(subData), 'Abonnements');
      }

      XLSX.writeFile(wb, `budget-scanner-${dateStamp()}.xlsx`);
    } catch (err) {
      alert('Erreur Excel : ' + err.message);
    } finally {
      exportXlsxBtn.textContent = originalLabel;
      exportXlsxBtn.disabled = false;
    }
  }

  async function exportPDF() {
    if (!lastAnalysis) return;
    const originalLabel = exportPdfBtn.textContent;
    exportPdfBtn.textContent = 'Génération…';
    exportPdfBtn.disabled = true;
    try {
      await loadScript(CDN.html2canvas);
      await loadScript(CDN.jspdf);

      const dashboardEl = document.getElementById('dashboard');
      const recoEl = document.getElementById('recommendations');

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;

      pdf.setFontSize(18);
      pdf.text('Budget Scanner — Rapport', margin, 18);
      pdf.setFontSize(10);
      pdf.setTextColor(120);
      pdf.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, margin, 24);
      pdf.setTextColor(0);

      let cursorY = 32;
      // Force light background for clean PDF even in dark mode
      const currentTheme = document.documentElement.getAttribute('data-theme');
      document.documentElement.setAttribute('data-theme', 'light');
      await new Promise(r => setTimeout(r, 50));

      for (const el of [dashboardEl, recoEl]) {
        const canvas = await window.html2canvas(el, {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true
        });
        const imgData = canvas.toDataURL('image/png');
        const imgW = pageW - margin * 2;
        const imgH = (canvas.height * imgW) / canvas.width;
        if (cursorY + imgH > pageH - margin) {
          pdf.addPage();
          cursorY = margin;
        }
        pdf.addImage(imgData, 'PNG', margin, cursorY, imgW, imgH);
        cursorY += imgH + 8;
      }

      document.documentElement.setAttribute('data-theme', currentTheme);
      pdf.save(`budget-scanner-${dateStamp()}.pdf`);
    } catch (err) {
      alert('Erreur lors de la génération du PDF : ' + err.message);
    } finally {
      exportPdfBtn.textContent = originalLabel;
      exportPdfBtn.disabled = false;
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function dateStamp() {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  }

  // ---------- RECOMMENDATIONS ----------
  function renderRecommendations(transactions, catTotals, income, expenses, cashflow, savings) {
    const savingsList = $('#reco-savings');
    const gainsList   = $('#reco-gains');
    savingsList.innerHTML = '';
    gainsList.innerHTML = '';
    const recos = generateRecommendations(transactions, catTotals, income, expenses, cashflow, savings);
    if (recos.savings.length === 0) {
      savingsList.innerHTML = '<li>Aucune économie évidente détectée. Bonne maîtrise des dépenses.</li>';
    } else {
      for (const r of recos.savings) {
        const li = document.createElement('li');
        li.className = r.severity || 'savings';
        li.innerHTML = r.html;
        savingsList.appendChild(li);
      }
    }
    if (recos.gains.length === 0) {
      gainsList.innerHTML = '<li>Continuez sur cette voie.</li>';
    } else {
      for (const r of recos.gains) {
        const li = document.createElement('li');
        li.className = 'gain';
        li.innerHTML = r.html;
        gainsList.appendChild(li);
      }
    }
  }

  function generateRecommendations(transactions, catTotals, income, expenses, cashflow, savings) {
    const savingsRecos = [];
    const gainsRecos   = [];

    const subs = catTotals['subscription'];
    if (subs && subs.count >= 3) {
      savingsRecos.push({
        html: `<strong>Abonnements multiples</strong> — ${subs.count} prélèvements détectés pour <span class="amount">${fmt(subs.total)}</span>. Listez-les, gardez les essentiels. Une revue trimestrielle évite typiquement <span class="amount">${fmt(subs.total * 0.3)}</span> de gaspillage.`
      });
    }
    const resto = catTotals['restaurant'];
    if (resto && resto.total > 150) {
      savingsRecos.push({
        html: `<strong>Restaurants & livraisons</strong> — <span class="amount">${fmt(resto.total)}</span> sur la période. Réduire de 30% libère <span class="amount">${fmt(resto.total * 0.3)}</span>/mois.`
      });
    }
    const cash = catTotals['cash'];
    if (cash && cash.total > 100) {
      savingsRecos.push({
        html: `<strong>Retraits en espèces</strong> — <span class="amount">${fmt(cash.total)}</span> retirés. Les paiements en cash sont rarement suivis : pensez à les budgéter pour éviter les fuites.`
      });
    }
    const fees = catTotals['fees'];
    if (fees && fees.total > 5) {
      savingsRecos.push({
        severity: 'warning',
        html: `<strong>Frais bancaires</strong> — <span class="amount">${fmt(fees.total)}</span> de frais. Une banque en ligne (Boursorama, Revolut, Fortuneo) supprimerait probablement ces frais.`
      });
    }
    const shop = catTotals['shopping'];
    if (shop && shop.total > 200) {
      savingsRecos.push({
        html: `<strong>Shopping</strong> — <span class="amount">${fmt(shop.total)}</span> dépensés. Appliquez la règle des 48h avant tout achat non-essentiel > 50€.`
      });
    }
    const recurring = detectRecurringSmallCharges(transactions);
    if (recurring.length > 0) {
      const total = recurring.reduce((s, r) => s + r.total, 0);
      savingsRecos.push({
        html: `<strong>Prélèvements récurrents identifiés</strong> — ${recurring.length} libellé(s) avec montants répétés (${recurring.map(r => escapeHTML(r.libelle)).slice(0, 3).join(', ')}). Vérifiez s'ils sont tous encore utiles. Total : <span class="amount">${fmt(total)}</span>.`
      });
    }
    if (cashflow < 0) {
      savingsRecos.unshift({
        severity: 'warning',
        html: `<strong>Cash-flow négatif</strong> — Vos dépenses dépassent vos revenus de <span class="amount">${fmt(Math.abs(cashflow))}</span>. Priorité : réduire les variables (loisirs, restaurants, shopping).`
      });
    }
    const dormant = cashflow - savings;
    if (dormant > 200) {
      gainsRecos.push({
        html: `<strong>Trésorerie dormante</strong> — <span class="amount">${fmt(dormant)}</span> non placés. Un Livret A (3%) génère <span class="amount">${fmt(dormant * 0.03)}</span>/an sans risque ; un PEA/ETF (≈7% historique) jusqu'à <span class="amount">${fmt(dormant * 0.07)}</span>/an.`
      });
    }
    const sr = income > 0 ? ((savings + Math.max(cashflow, 0)) / income) * 100 : 0;
    if (sr < 10 && income > 0) {
      gainsRecos.push({
        html: `<strong>Taux d'épargne faible (${sr.toFixed(1)}%)</strong> — Cible recommandée : 20%. Automatisez un virement programmé en début de mois vers un livret dédié (méthode "pay yourself first").`
      });
    } else if (sr >= 20) {
      gainsRecos.push({
        html: `<strong>Excellent taux d'épargne (${sr.toFixed(1)}%)</strong> — Diversifiez : 30% liquidités (Livret A/LDDS), 70% long-terme (PEA, assurance-vie en UC).`
      });
    }
    if (cashflow > 500) {
      gainsRecos.push({
        html: `<strong>Capacité d'investissement</strong> — Avec <span class="amount">${fmt(cashflow)}</span>/mois d'excédent, un DCA mensuel sur un ETF Monde sur 10 ans à 7% donnerait ≈<span class="amount">${fmt(cashflow * 12 * 14)}</span> de capital.`
      });
    }
    const incomeTransactions = transactions.filter(t => t.amount > 0);
    if (incomeTransactions.length <= 2 && income > 0) {
      gainsRecos.push({
        html: `<strong>Revenus peu diversifiés</strong> — Une seule source détectée. Pistes de compléments : freelance sur compétence métier, location courte durée, contenus en ligne, micro-investissements en dividendes.`
      });
    }
    return { savings: savingsRecos, gains: gainsRecos };
  }

  function detectRecurringSmallCharges(transactions) {
    const groups = {};
    for (const t of transactions) {
      if (t.amount >= 0) continue;
      const key = t.libelle.toLowerCase().substring(0, 15).trim();
      if (!groups[key]) groups[key] = { libelle: t.libelle, amounts: [], total: 0 };
      groups[key].amounts.push(Math.abs(t.amount));
      groups[key].total += Math.abs(t.amount);
    }
    return Object.values(groups).filter(g => {
      if (g.amounts.length < 2) return false;
      const first = g.amounts[0];
      return g.amounts.every(a => Math.abs(a - first) < 0.01);
    });
  }

  // ---------- UTIL ----------
  function escapeHTML(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---------- INIT ----------
  initTheme();
  renderCustomCategoriesList();
  renderHistoryList();
  populateCompareSelect();
  renderGoal();
})();

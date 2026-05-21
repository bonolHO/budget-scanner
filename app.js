/* ============================================================
   Budget Scanner — Vanilla JS engine
   - Parses CSV / TSV / freeform bank statement text
   - Categorises transactions via keyword rules
   - Renders dashboard + recommendations
   - 100% client-side, no network calls
   ============================================================ */

(() => {
  'use strict';

  // ---------- CATEGORISATION RULES ----------
  // Each category has keywords matched (case-insensitive) against the libellé.
  // Order matters: first match wins.
  const CATEGORIES = [
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
28/03/2025	RESTAURANT SUSHI	-35,00`;

  // ---------- DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const dataInput     = $('#data-input');
  const analyzeBtn    = $('#analyze-btn');
  const parseFeedback = $('#parse-feedback');
  const loadSampleBtn = $('#load-sample');
  const fileInput     = $('#file-input');
  const dropZone      = $('#drop-zone');
  const dashboard     = $('#dashboard');
  const recoSection   = $('#recommendations');
  const exportCsvBtn  = $('#export-csv');
  const exportPdfBtn  = $('#export-pdf');

  // ---------- CDN URLS (pinned versions) ----------
  const CDN = {
    pdfjs:      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    pdfjsWorker:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    jspdf:      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    html2canvas:'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
  };

  let lastAnalysis = null;  // store last result for export

  // ---------- EVENTS ----------
  dataInput.addEventListener('input', updateParseFeedback);
  loadSampleBtn.addEventListener('click', () => {
    dataInput.value = SAMPLE_DATA;
    updateParseFeedback();
  });
  fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
  analyzeBtn.addEventListener('click', runAnalysis);
  exportCsvBtn.addEventListener('click', exportCSV);
  exportPdfBtn.addEventListener('click', exportPDF);

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
        // CSV, TXT, TSV, OFX, QIF — read as text and let parser handle
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
    // Configure worker
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = CDN.pdfjsWorker;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const allLines = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      // Group items by approximate Y position to reconstruct lines
      const lines = groupItemsIntoLines(content.items);
      allLines.push(...lines);
    }
    return allLines.join('\n');
  }

  function groupItemsIntoLines(items) {
    // pdf.js gives items with transform[5] = y position
    const rows = {};
    for (const item of items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      // Bucket by 3-pixel proximity to handle slight misalignment
      const bucket = Math.round(y / 3) * 3;
      if (!rows[bucket]) rows[bucket] = [];
      rows[bucket].push({ x: item.transform[4], str: item.str });
    }
    // Sort rows by Y descending (PDF coords are bottom-up), then by X ascending
    const sortedY = Object.keys(rows).map(Number).sort((a, b) => b - a);
    return sortedY.map(y => {
      const sorted = rows[y].sort((a, b) => a.x - b.x);
      // Insert tabs between distant chunks to preserve column structure
      let line = '';
      let lastX = -Infinity;
      for (const c of sorted) {
        if (lastX !== -Infinity && c.x - lastX > 20) line += '\t';
        else if (line) line += ' ';
        line += c.str;
        lastX = c.x + c.str.length * 5; // rough estimate
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
    // Extract <STMTTRN> blocks
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
  // Accepts CSV, TSV, semicolon-separated, or whitespace-aligned lines.
  // Detects: date (FR/ISO), libellé, montant (with +/-, comma or dot, € optional).
  function parseTransactions(raw) {
    if (!raw || !raw.trim()) return [];
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const transactions = [];

    for (const line of lines) {
      const tx = parseLine(line);
      if (tx) transactions.push(tx);
    }
    return transactions;
  }

  function parseLine(line) {
    // Skip obvious headers
    if (/^(date|libell|description|montant|amount|debit|credit)/i.test(line)) return null;

    // Try splitting by tab, semicolon, or comma
    let parts;
    if (line.includes('\t')) parts = line.split('\t').map(p => p.trim());
    else if (line.includes(';')) parts = line.split(';').map(p => p.trim());
    else if (countCommas(line) >= 2 && !looksLikeFreeform(line)) parts = smartSplitCSV(line);
    else parts = freeformSplit(line);

    if (!parts || parts.length < 2) return null;

    // Find date, amount, libellé among the parts
    let date = null, amount = null, libelleParts = [];
    for (const p of parts) {
      if (!date && isDate(p)) { date = normaliseDate(p); continue; }
      if (amount === null && isAmount(p)) { amount = parseAmount(p); continue; }
      if (p) libelleParts.push(p);
    }

    if (amount === null || isNaN(amount)) return null;

    const libelle = libelleParts.join(' ').replace(/\s+/g, ' ').trim();
    if (!libelle) return null;

    return {
      date: date || '',
      libelle,
      amount,
      raw: line
    };
  }

  function countCommas(s) { return (s.match(/,/g) || []).length; }

  function looksLikeFreeform(line) {
    // If the line is mostly whitespace-separated, not CSV
    const tabs = (line.match(/\t/g) || []).length;
    const semis = (line.match(/;/g) || []).length;
    return tabs === 0 && semis === 0 && /\s{2,}/.test(line);
  }

  function smartSplitCSV(line) {
    // Simple CSV split (no quoted field support beyond basics)
    return line.split(',').map(p => p.trim());
  }

  function freeformSplit(line) {
    // Split by 2+ spaces, else just by spaces and reconstruct
    if (/\s{2,}/.test(line)) {
      return line.split(/\s{2,}/).map(p => p.trim()).filter(Boolean);
    }
    // Fallback: try to identify date at start, amount at end
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
    // Output as DD/MM/YYYY for display, keep ISO internally if possible
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split('-');
      return `${d}/${m}/${y}`;
    }
    return s.replace(/[\-.]/g, '/');
  }

  function isAmount(s) {
    if (!s) return false;
    // Accepts: 1234,56 / 1 234,56 / -1234.56 / +1234,56 € / 1234.56€
    const cleaned = s.replace(/€|EUR/gi, '').trim();
    return /^[+\-]?\s?\d{1,3}([ .]\d{3})*([,.]\d{1,2})?$/.test(cleaned) ||
           /^[+\-]?\d+([,.]\d{1,2})?$/.test(cleaned);
  }

  function parseAmount(s) {
    let cleaned = s.replace(/€|EUR/gi, '').replace(/\s/g, '').trim();
    const negative = cleaned.startsWith('-');
    cleaned = cleaned.replace(/^[+\-]/, '');
    // If both . and , present: . is thousands separator, , is decimal
    if (cleaned.includes('.') && cleaned.includes(',')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes(',')) {
      cleaned = cleaned.replace(',', '.');
    }
    const v = parseFloat(cleaned);
    return negative ? -v : v;
  }

  // ---------- CATEGORISATION ----------
  function categorise(tx) {
    const lib = tx.libelle.toLowerCase();
    // Income heuristic: positive amount AND no specific category match for outflow
    for (const cat of CATEGORIES) {
      for (const kw of cat.keywords) {
        if (lib.includes(kw)) return cat;
      }
    }
    // Fallback: if positive amount, treat as income; else other
    if (tx.amount > 0) {
      return CATEGORIES.find(c => c.id === 'income');
    }
    return OTHER_CATEGORY;
  }

  // ---------- ANALYSIS ----------
  function runAnalysis() {
    const transactions = parseTransactions(dataInput.value);
    if (transactions.length === 0) return;

    // Categorise
    transactions.forEach(tx => { tx.category = categorise(tx); });

    // Aggregate
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

    // Category totals (expenses only)
    const categoryTotals = {};
    for (const tx of transactions) {
      if (tx.amount >= 0) continue;
      const key = tx.category.id;
      if (!categoryTotals[key]) {
        categoryTotals[key] = { label: tx.category.label, total: 0, count: 0, type: tx.category.type };
      }
      categoryTotals[key].total += Math.abs(tx.amount);
      categoryTotals[key].count += 1;
    }

    // Store for export
    lastAnalysis = {
      transactions, categoryTotals,
      income: totalIncome, expenses: totalExpenses,
      cashflow, savings: totalSavings, savingsRate
    };

    // Render
    renderKPIs(totalIncome, totalExpenses, cashflow, savingsRate);
    renderBreakdown(categoryTotals, totalExpenses);
    renderTopExpenses(transactions);
    renderTransactions(transactions);
    renderRecommendations(transactions, categoryTotals, totalIncome, totalExpenses, cashflow, totalSavings);

    dashboard.classList.remove('hidden');
    recoSection.classList.remove('hidden');
    dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

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
    // BOM for Excel compatibility with UTF-8
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `budget-scanner-${dateStamp()}.csv`);
  }

  function csvEscape(s) {
    s = String(s || '');
    if (/[";\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
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

      // Cover header
      pdf.setFontSize(18);
      pdf.text('Budget Scanner — Rapport', margin, 18);
      pdf.setFontSize(10);
      pdf.setTextColor(120);
      pdf.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, margin, 24);
      pdf.setTextColor(0);

      let cursorY = 32;
      for (const el of [dashboardEl, recoEl]) {
        const canvas = await window.html2canvas(el, {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true
        });
        const imgData = canvas.toDataURL('image/png');
        const imgW = pageW - margin * 2;
        const imgH = (canvas.height * imgW) / canvas.width;

        // If section doesn't fit on remaining page, start new page
        if (cursorY + imgH > pageH - margin) {
          pdf.addPage();
          cursorY = margin;
        }
        pdf.addImage(imgData, 'PNG', margin, cursorY, imgW, imgH);
        cursorY += imgH + 8;
      }

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

  // ---------- FORMATTING ----------
  const nf = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
  const fmt = (n) => nf.format(n);
  const fmtSigned = (n) => (n > 0 ? '+' : '') + nf.format(n);

  // ---------- RENDERING ----------
  function renderKPIs(income, expenses, cashflow, savingsRate) {
    $('#kpi-income').textContent = fmt(income);
    $('#kpi-expenses').textContent = fmt(expenses);
    const cf = $('#kpi-cashflow');
    cf.textContent = fmtSigned(cashflow);
    cf.classList.remove('pos', 'neg');
    cf.classList.add(cashflow >= 0 ? 'pos' : 'neg');

    const sr = $('#kpi-savings-rate');
    sr.textContent = `${savingsRate.toFixed(1)} %`;
    sr.classList.remove('pos', 'neg', 'warn');
    if (savingsRate >= 20) sr.classList.add('pos');
    else if (savingsRate >= 10) sr.classList.add('warn');
    else sr.classList.add('neg');
  }

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
      row.innerHTML = `
        <div class="bar-meta">
          <span class="label">${cat.label} <span class="amount">(${pct.toFixed(0)}%)</span></span>
          <span class="amount">${fmt(cat.total)}</span>
        </div>
        <div class="bar"><div class="bar-fill" style="width:${fillPct}%"></div></div>
      `;
      container.appendChild(row);
    }
  }

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

  function renderTransactions(transactions) {
    const tbody = $('#transactions-table tbody');
    const filterSelect = $('#filter-category');

    // Build filter options
    const categories = Array.from(new Set(transactions.map(t => t.category.label))).sort();
    filterSelect.innerHTML = '<option value="">Toutes catégories</option>' +
      categories.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');

    function render(filter) {
      tbody.innerHTML = '';
      const filtered = filter ? transactions.filter(t => t.category.label === filter) : transactions;
      for (const t of filtered) {
        const tr = document.createElement('tr');
        const amountClass = t.amount >= 0 ? 'pos' : 'neg';
        tr.innerHTML = `
          <td>${escapeHTML(t.date)}</td>
          <td>${escapeHTML(t.libelle)}</td>
          <td><span class="cat-tag">${escapeHTML(t.category.label)}</span></td>
          <td class="num ${amountClass}">${fmtSigned(t.amount)}</td>
        `;
        tbody.appendChild(tr);
      }
    }
    render('');
    filterSelect.onchange = () => render(filterSelect.value);
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

    // --- Subscriptions ---
    const subs = catTotals['subscription'];
    if (subs && subs.count >= 3) {
      savingsRecos.push({
        html: `<strong>Abonnements multiples</strong> — ${subs.count} prélèvements détectés pour <span class="amount">${fmt(subs.total)}</span>. Listez-les, gardez les essentiels. Une revue trimestrielle évite typiquement <span class="amount">${fmt(subs.total * 0.3)}</span> de gaspillage.`
      });
    }

    // --- Restaurants & food delivery ---
    const resto = catTotals['restaurant'];
    if (resto && resto.total > 150) {
      savingsRecos.push({
        html: `<strong>Restaurants & livraisons</strong> — <span class="amount">${fmt(resto.total)}</span> sur la période. Réduire de 30% libère <span class="amount">${fmt(resto.total * 0.3)}</span>/mois.`
      });
    }

    // --- Cash withdrawals ---
    const cash = catTotals['cash'];
    if (cash && cash.total > 100) {
      savingsRecos.push({
        html: `<strong>Retraits en espèces</strong> — <span class="amount">${fmt(cash.total)}</span> retirés. Les paiements en cash sont rarement suivis : pensez à les budgéter pour éviter les fuites.`
      });
    }

    // --- Bank fees ---
    const fees = catTotals['fees'];
    if (fees && fees.total > 5) {
      savingsRecos.push({
        severity: 'warning',
        html: `<strong>Frais bancaires</strong> — <span class="amount">${fmt(fees.total)}</span> de frais. Une banque en ligne (Boursorama, Revolut, Fortuneo) supprimerait probablement ces frais.`
      });
    }

    // --- Shopping impulsif ---
    const shop = catTotals['shopping'];
    if (shop && shop.total > 200) {
      savingsRecos.push({
        html: `<strong>Shopping</strong> — <span class="amount">${fmt(shop.total)}</span> dépensés. Appliquez la règle des 48h avant tout achat non-essentiel > 50€.`
      });
    }

    // --- Recurring identical amounts (potential forgotten subscriptions) ---
    const recurring = detectRecurringSmallCharges(transactions);
    if (recurring.length > 0) {
      const total = recurring.reduce((s, r) => s + r.total, 0);
      savingsRecos.push({
        html: `<strong>Prélèvements récurrents identifiés</strong> — ${recurring.length} libellé(s) avec montants répétés (${recurring.map(r => escapeHTML(r.libelle)).slice(0, 3).join(', ')}). Vérifiez s'ils sont tous encore utiles. Total : <span class="amount">${fmt(total)}</span>.`
      });
    }

    // --- Cashflow négatif ---
    if (cashflow < 0) {
      savingsRecos.unshift({
        severity: 'warning',
        html: `<strong>Cash-flow négatif</strong> — Vos dépenses dépassent vos revenus de <span class="amount">${fmt(Math.abs(cashflow))}</span>. Priorité : réduire les variables (loisirs, restaurants, shopping).`
      });
    }

    // ---------- GAINS ----------

    // Cash-flow positif non placé
    const dormant = cashflow - savings;
    if (dormant > 200) {
      gainsRecos.push({
        html: `<strong>Trésorerie dormante</strong> — <span class="amount">${fmt(dormant)}</span> non placés. Un Livret A (3%) génère <span class="amount">${fmt(dormant * 0.03)}</span>/an sans risque ; un PEA/ETF (≈7% historique) jusqu'à <span class="amount">${fmt(dormant * 0.07)}</span>/an.`
      });
    }

    // Savings rate
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

    // Side income potential
    if (cashflow > 500) {
      gainsRecos.push({
        html: `<strong>Capacité d'investissement</strong> — Avec <span class="amount">${fmt(cashflow)}</span>/mois d'excédent, un DCA mensuel sur un ETF Monde sur 10 ans à 7% donnerait ≈<span class="amount">${fmt(cashflow * 12 * 14)}</span> de capital.`
      });
    }

    // Income concentration → side income suggestion
    const incomeTransactions = transactions.filter(t => t.amount > 0);
    if (incomeTransactions.length <= 2 && income > 0) {
      gainsRecos.push({
        html: `<strong>Revenus peu diversifiés</strong> — Une seule source détectée. Pistes de compléments : freelance sur compétence métier, location courte durée, contenus en ligne, micro-investissements en dividendes.`
      });
    }

    return { savings: savingsRecos, gains: gainsRecos };
  }

  function detectRecurringSmallCharges(transactions) {
    // Group by libellé (first 15 chars), look for 2+ identical amounts
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
      // Identical amounts?
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
})();

# Budget Scanner

> Comprenez votre budget en 10 secondes. Outil d'analyse de relevés bancaires 100% local et privé.

Application web statique qui transforme vos transactions bancaires en tableau de bord clair, avec recommandations algorithmiques d'économies et d'optimisations financières.

## Caractéristiques

- **100% local** : aucune donnée n'est envoyée à un serveur. Tout le traitement se fait dans votre navigateur.
- **Multi-format** : import CSV, TSV, TXT, OFX, QIF et PDF de relevés bancaires.
- **Catégorisation automatique** : 15 catégories prédéfinies, 150+ marques françaises reconnues.
- **Dashboard minimaliste** : KPI, répartition par catégorie, top dépenses, transactions filtrables.
- **Recommandations** : détection automatique d'abonnements multiples, frais bancaires, trésorerie dormante, etc.
- **Export** : rapport PDF et données CSV en un clic.

## Stack technique

- HTML / CSS / JavaScript vanilla (aucun framework)
- pdf.js (chargé à la demande) pour l'extraction PDF
- jsPDF + html2canvas pour l'export PDF
- Zéro dépendance npm — déploiement statique pur

## Utilisation locale

Ouvrez `index.html` directement dans votre navigateur. C'est tout.

Pour servir via un serveur local :

```bash
npx serve .
# ou
python3 -m http.server 4173
```

## Déploiement

### Vercel

```bash
npx vercel --prod
```

Ou via l'interface : importez le repository GitHub sur [vercel.com/new](https://vercel.com/new).

### GitHub Pages

Activez Pages dans Settings → Pages → Source : `main` branch / root.

### Netlify

Drag & drop du dossier sur [app.netlify.com/drop](https://app.netlify.com/drop).

## Structure

```
.
├── index.html        Page principale (landing + outil + dashboard)
├── styles.css        Design minimaliste
├── app.js            Moteur : parser, catégorisation, exports
├── vercel.json       Configuration de déploiement Vercel
└── README.md
```

## Confidentialité

Aucune dépendance backend, aucun cookie, aucun tracking, aucun stockage. Les librairies externes (pdf.js, jsPDF, html2canvas) sont chargées depuis cdnjs uniquement à la demande, lors de l'import PDF ou de l'export.

## Licence

MIT

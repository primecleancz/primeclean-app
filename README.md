# PrimeClean — Systém správy úklidové firmy

Lokální Vite + React aplikace napojená na Supabase.

## 🚀 Spuštění

```bash
# 1. Přejdi do složky projektu
cd primeclean

# 2. Nainstaluj závislosti
npm install

# 3. Spusť dev server
npm run dev

# Aplikace poběží na: http://localhost:5173
```

## 👤 Demo přihlašovací údaje

| Role | Email | Heslo |
|------|-------|-------|
| Admin | admin@primeclean.cz | admin123 |
| Admin (tvůj účet) | info@primeclean.cz | (tvoje heslo z Supabase) |
| Zaměstnanec | jana@primeclean.cz | jana123 |
| Klient SVJ | klient@firma.cz | klient123 |
| Klient Airbnb | airbnb@test.cz | airbnb123 |

## 🗂️ Struktura projektu

```
primeclean/
├── index.html
├── package.json
├── vite.config.js
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx        ← React entry point
    ├── App.jsx         ← Root + Context + Routing
    ├── supabase.js     ← Supabase klient
    ├── ui.jsx          ← UI komponenty (Btn, Modal, Toast, ...)
    ├── Sidebar.jsx     ← Navigace
    ├── Login.jsx       ← Přihlašovací stránka
    └── pages.jsx       ← Všechny stránky (Dashboard, Zakázky, ...)
```

## 🗄️ Supabase

- **URL:** https://zkuexarumnixfoflrixj.supabase.co
- **Region:** EU Central (Frankfurt)
- **Tabulky:** zakazky, klienti, zamestnanci, faktury, sklad_polozky, pozadavky, wiki, opakovane_plany, smeny, profiles

## 📦 Závislosti

- `react` + `react-dom` — UI framework
- `@supabase/supabase-js` — databáze, auth, realtime
- `vite` + `@vitejs/plugin-react` — build tool

import { useEffect } from 'react'

// ── STYLES ────────────────────────────────────────────────────────────────────
export const S = {
  bg: '#0b0d12', s1: '#12151c', s2: '#181c25', s3: '#1e2330',
  border: '#252a36', accent: '#00e5a0', blue: '#4da6ff', warn: '#ffaa00', danger: '#ff3b5c',
  text: '#e8ecf5', muted: '#5a6278', muted2: '#8892aa',
  card: { background: '#12151c', border: '1px solid #252a36', borderRadius: 12, padding: 20 },
  stat: { background: '#12151c', border: '1px solid #252a36', borderRadius: 12, padding: '18px 20px' },
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
export const fmt = n => Number(n || 0).toLocaleString('cs-CZ') + ' Kč'
export const fmtD = d => d ? new Date(d).toLocaleDateString('cs-CZ') : '—'
export const ini = n => n?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
export const stavLbl = s => ({ probiha: 'Probíhá', naplanovano: 'Naplánováno', dokonceno: 'Dokončeno', storno: 'Storno' }[s] || s)
export const typLbl = t => ({ svj: 'SVJ', airbnb: 'Airbnb', stavba: 'Stavba' }[t] || t)
export const fakLbl = s => ({ uhrazena: 'Uhrazena', vystavena: 'Vystavena', po_splatnosti: 'Po splatnosti', storno: 'Storno' }[s] || s)

// ── BADGE ─────────────────────────────────────────────────────────────────────
export const Bdg = ({ c, children }) => {
  const cfg = {
    g: { bg: 'rgba(0,229,160,.13)', color: '#00e5a0' },
    b: { bg: 'rgba(77,166,255,.13)', color: '#4da6ff' },
    w: { bg: 'rgba(255,170,0,.13)', color: '#ffaa00' },
    r: { bg: 'rgba(255,59,92,.13)', color: '#ff3b5c' },
    m: { bg: 'rgba(90,98,120,.13)', color: '#8892aa' },
  }[c] || { bg: 'rgba(90,98,120,.13)', color: '#8892aa' }
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color }}>{children}</span>
}

export const stavBdg = s => { const m = { probiha: 'b', naplanovano: 'w', dokonceno: 'g', storno: 'r' }; return <Bdg c={m[s] || 'm'}>{stavLbl(s)}</Bdg> }
export const typBdg = t => { const m = { svj: 'b', airbnb: 'w', stavba: 'm' }; return <Bdg c={m[t] || 'm'}>{typLbl(t)}</Bdg> }
export const fakBdg = s => { const m = { uhrazena: 'g', vystavena: 'b', po_splatnosti: 'r', storno: 'm' }; return <Bdg c={m[s] || 'm'}>{fakLbl(s)}</Bdg> }

// ── BUTTON ────────────────────────────────────────────────────────────────────
export const Btn = ({ variant = 'ghost', sm, onClick, children, disabled, style = {} }) => {
  const v = {
    primary: { background: '#00e5a0', color: '#000', border: 'none' },
    ghost: { background: 'transparent', color: '#8892aa', border: '1px solid #252a36' },
    blue: { background: 'rgba(77,166,255,.12)', color: '#4da6ff', border: '1px solid rgba(77,166,255,.2)' },
    danger: { background: 'rgba(255,59,92,.1)', color: '#ff3b5c', border: '1px solid rgba(255,59,92,.25)' },
  }[variant] || {}
  return (
    <button onClick={onClick} disabled={disabled} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: sm ? '5px 11px' : '8px 16px', borderRadius: 8, fontSize: sm ? 12 : 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all .15s', whiteSpace: 'nowrap', opacity: disabled ? .5 : 1, ...v, ...style }}>
      {children}
    </button>
  )
}

// ── FIELD ─────────────────────────────────────────────────────────────────────
export const Field = ({ label, children }) => (
  <div>
    <div style={{ fontSize: 11, color: S.muted2, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
    {children}
  </div>
)

export const inputStyle = { width: '100%', background: S.s2, border: '1px solid ' + S.border, borderRadius: 8, color: S.text, padding: '8px 11px', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }

// ── MODAL ─────────────────────────────────────────────────────────────────────
export const Modal = ({ title, onClose, children, wide }) => (
  <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}>
    <div onClick={e => e.stopPropagation()} style={{ background: S.s1, border: '1px solid ' + S.border, borderRadius: 16, padding: 26, width: wide ? 680 : 500, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{title}</div>
        <Btn sm onClick={onClose}>✕</Btn>
      </div>
      {children}
    </div>
  </div>
)

// ── TOAST ─────────────────────────────────────────────────────────────────────
export const Toast = ({ msg, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [])
  const colors = { success: '#00e5a0', error: '#ff3b5c', warn: '#ffaa00', info: '#4da6ff' }
  const icons = { success: '✅', error: '❌', warn: '⚠️', info: 'ℹ️' }
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: colors[type] || '#4da6ff', color: '#000', padding: '12px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13, boxShadow: '0 8px 30px rgba(0,0,0,.4)', maxWidth: 380 }}>
      {icons[type]} {msg}
    </div>
  )
}

// ── SPINNER ───────────────────────────────────────────────────────────────────
export const Spinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: S.muted2, gap: 12 }}>
    <div style={{ width: 24, height: 24, border: `2px solid ${S.border}`, borderTop: `2px solid ${S.accent}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    <span style={{ fontSize: 13, color: S.muted2 }}>Načítám...</span>
  </div>
)

// ── PAGE HEADER ───────────────────────────────────────────────────────────────
export const PH = ({ title, sub, action }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
    <div>
      <div style={{ fontWeight: 800, fontSize: 24 }}>{title}</div>
      {sub && <div style={{ color: S.muted2, fontSize: 13, marginTop: 3 }}>{sub}</div>}
    </div>
    {action && <div>{action}</div>}
  </div>
)

// ── TABLE ─────────────────────────────────────────────────────────────────────
export const Tbl = ({ cols, rows }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>{cols.map((c, i) => <th key={i} style={{ fontSize: 11, color: S.muted, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', padding: '9px 13px', textAlign: 'left', borderBottom: '1px solid ' + S.border }}>{c}</th>)}</tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  </div>
)

export const TD = ({ children, bold, muted, accent }) => (
  <td style={{ padding: '11px 13px', fontSize: 13, borderBottom: '1px solid rgba(37,42,54,.5)', fontWeight: bold ? 600 : 'normal', color: accent ? S.accent : muted ? S.muted2 : S.text }}>
    {children}
  </td>
)

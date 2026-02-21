import { S, Bdg, ini } from './ui.jsx'

export default function Sidebar({ page, setPage, user, onLogout }) {
  const admin = [
    { s: 'Přehled' }, { id: 'dash', ic: '🏠', l: 'Dashboard' },
    { s: 'Provoz' }, { id: 'zakazky', ic: '📋', l: 'Zakázky' }, { id: 'opakovane', ic: '🔄', l: 'Opakované' },
    { id: 'pozadavky', ic: '💬', l: 'Požadavky' }, { id: 'kalendar', ic: '📅', l: 'Kalendář' },
    { s: 'Správa' }, { id: 'klienti', ic: '🏢', l: 'Klienti' }, { id: 'zamestnanci', ic: '👥', l: 'Zaměstnanci' },
    { s: 'Finance' }, { id: 'fakturace', ic: '🧾', l: 'Fakturace' }, { id: 'mzdy', ic: '💰', l: 'Mzdy' },
    { s: 'Ostatní' }, { id: 'sklad', ic: '📦', l: 'Sklad' }, { id: 'wiki', ic: '📚', l: 'Wiki' }, { id: 'nastaveni', ic: '⚙️', l: 'Nastavení' },
  ]
  const zam = [
    { s: 'Přehled' }, { id: 'z-prehled', ic: '🏠', l: 'Přehled' },
    { s: 'Práce' }, { id: 'z-zakazky', ic: '📋', l: 'Moje zakázky' }, { id: 'z-mzda', ic: '💰', l: 'Mzda' },
    { id: 'kalendar', ic: '📅', l: 'Kalendář' },
    { s: 'Účet' }, { id: 'z-profil', ic: '👤', l: 'Profil' },
  ]
  const klient = [
    { s: 'Přehled' }, { id: 'k-prehled', ic: '🏠', l: 'Přehled' },
    { s: 'Zakázky' }, { id: 'k-zakazky', ic: '📋', l: 'Zakázky' }, { id: 'k-pozadavky', ic: '💬', l: 'Požadavky' },
    { s: 'Finance' }, { id: 'k-faktury', ic: '🧾', l: 'Faktury' },
    { s: 'Účet' }, { id: 'k-profil', ic: '👤', l: 'Profil' },
  ]
  const menu = user.role === 'admin' ? admin : user.role === 'zamestnanec' ? zam : klient

  return (
    <div style={{ width: 240, background: S.s1, borderRight: '1px solid ' + S.border, display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100, overflowY: 'auto' }}>
      {/* Logo */}
      <div style={{ padding: '18px 14px', borderBottom: '1px solid ' + S.border, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 32, height: 32, background: S.accent, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: '#000', flexShrink: 0 }}>✦</div>
        <span style={{ fontSize: 18, fontWeight: 800 }}>PrimeClean</span>
      </div>

      {/* Menu items */}
      <div style={{ padding: '8px 10px', flex: 1 }}>
        {menu.map((m, i) => m.s
          ? <div key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: S.muted, textTransform: 'uppercase', padding: '12px 14px 3px' }}>{m.s}</div>
          : <button key={m.id} onClick={() => setPage(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: page === m.id ? S.accent : S.muted2, background: page === m.id ? 'rgba(0,229,160,.1)' : 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', transition: 'all .15s' }}>
            <span style={{ width: 18, textAlign: 'center', fontSize: 14 }}>{m.ic}</span>{m.l}
          </button>
        )}
      </div>

      {/* User info */}
      <div style={{ padding: '10px', borderTop: '1px solid ' + S.border }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', background: S.s2, borderRadius: 8, marginBottom: 6 }}>
          <div style={{ width: 30, height: 30, background: S.accent, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, color: '#000', flexShrink: 0 }}>{ini(user.name)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
            <Bdg c={user.role === 'admin' ? 'g' : user.role === 'zamestnanec' ? 'b' : 'w'}>{user.role}</Bdg>
          </div>
        </div>
        <button onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: S.danger, background: 'transparent', border: 'none', width: '100%', cursor: 'pointer' }}>
          <span>🚪</span> Odhlásit se
        </button>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { sb } from './supabase.js'
import { S, Bdg, Btn, Field, inputStyle } from './ui.jsx'

const DEMO = [
  { name: 'Martin Kovář — Admin', email: 'admin@primeclean.cz', password: 'admin123', role: 'admin' },
  { name: 'info@primeclean.cz — Admin', email: 'info@primeclean.cz', password: '', role: 'admin', note: 'vlastní heslo' },
  { name: 'Jana Nováková — Zaměstnanec', email: 'jana@primeclean.cz', password: 'jana123', role: 'zamestnanec' },
  { name: 'Bytový Správce — Klient', email: 'klient@firma.cz', password: 'klient123', role: 'klient' },
  { name: 'Airbnb Host Novák — Klient', email: 'airbnb@test.cz', password: 'airbnb123', role: 'klient' },
]

export default function Login({ onLogin }) {
  const [em, setEm] = useState('admin@primeclean.cz')
  const [pw, setPw] = useState('admin123')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const go = async () => {
    setLoading(true)
    setErr('')
    const { data, error } = await sb.auth.signInWithPassword({ email: em, password: pw })
    if (error) {
      setErr('Špatný email nebo heslo: ' + error.message)
      setLoading(false)
      return
    }
    const { data: profile, error: pe } = await sb.from('profiles').select('*').eq('id', data.user.id).single()
    if (pe || !profile) {
      setErr('Profil nenalezen. Kontaktujte administrátora.')
      await sb.auth.signOut()
      setLoading(false)
      return
    }
    onLogin({ ...profile, email: data.user.email })
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: S.bg }}>
      <div style={{ width: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 44, height: 44, background: S.accent, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: '#000' }}>✦</div>
            <span style={{ fontSize: 28, fontWeight: 800 }}>PrimeClean</span>
          </div>
          <div style={{ color: S.muted2, fontSize: 13 }}>Systém správy úklidové firmy</div>
        </div>

        {/* Card */}
        <div style={{ ...S.card, borderColor: 'rgba(0,229,160,.2)' }}>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 18 }}>Přihlásit se</div>

          {err && (
            <div style={{ background: 'rgba(255,59,92,.1)', border: '1px solid rgba(255,59,92,.3)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 13, color: S.danger }}>
              {err}
            </div>
          )}

          <div style={{ display: 'grid', gap: 12, marginBottom: 18 }}>
            <Field label="EMAIL">
              <input style={inputStyle} type="email" value={em} onChange={e => { setEm(e.target.value); setErr('') }} onKeyDown={e => e.key === 'Enter' && go()} />
            </Field>
            <Field label="HESLO">
              <input style={inputStyle} type="password" value={pw} onChange={e => { setPw(e.target.value); setErr('') }} onKeyDown={e => e.key === 'Enter' && go()} />
            </Field>
          </div>

          <Btn variant="primary" onClick={go} disabled={loading || !em || !pw} style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14 }}>
            {loading ? '⏳ Přihlašování...' : '→ Přihlásit se'}
          </Btn>

          {/* Demo accounts */}
          <div style={{ borderTop: '1px solid ' + S.border, marginTop: 20, paddingTop: 16 }}>
            <div style={{ fontSize: 10, color: S.muted, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', marginBottom: 8 }}>Demo účty (klikni pro vyplnění):</div>
            {DEMO.map((u, i) => (
              <div key={i}
                onClick={() => { if (u.password) { setEm(u.email); setPw(u.password); setErr('') } }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderRadius: 7, cursor: u.password ? 'pointer' : 'default', marginBottom: 3, opacity: u.password ? 1 : .6 }}
                onMouseEnter={e => { if (u.password) e.currentTarget.style.background = S.s2 }}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: S.muted2 }}>{u.note || u.email}</div>
                </div>
                <Bdg c={u.role === 'admin' ? 'g' : u.role === 'zamestnanec' ? 'b' : 'w'}>{u.role}</Bdg>
              </div>
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: S.muted }}>
          PrimeClean v1.0 · Supabase Backend · localhost:5173
        </div>
      </div>
    </div>
  )
}

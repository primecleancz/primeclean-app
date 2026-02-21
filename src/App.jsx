import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { sb } from './supabase.js'
import { S, Toast, Spinner } from './ui.jsx'
import Sidebar from './Sidebar.jsx'
import Login from './Login.jsx'
import {
  Dashboard, Zakazky, Klienti, Zamestnanci, Fakturace,
  Sklad, Mzdy, Pozadavky, Opakovane, Kalendar, Wiki,
  Nastaveni, Profil, ZamPrehled, KlientPrehled
} from './pages.jsx'

// ── CONTEXT ───────────────────────────────────────────────────────────────────
const Ctx = createContext(null)
export const useCtx = () => useContext(Ctx)

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [toast, setToast] = useState(null)

  // Global data (shared across pages via context)
  const [zakazky, setZakazky] = useState([])
  const [sklad, setSklad] = useState([])
  const [faktury, setFaktury] = useState([])
  const [klienti, setKlienti] = useState([])
  const [loading, setLoading] = useState(false)

  const showToast = useCallback((msg, type = 'info') => setToast({ msg, type }), [])

  // ── Session restore on load ──
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await sb.auth.getSession()
      if (session?.user) {
        const { data: profile } = await sb.from('profiles').select('*').eq('id', session.user.id).single()
        if (profile) {
          setUser({ ...profile, email: session.user.email })
          setPage(profile.role === 'admin' ? 'dash' : profile.role === 'zamestnanec' ? 'z-prehled' : 'k-prehled')
        } else {
          await sb.auth.signOut()
        }
      }
      setAuthLoading(false)
    }
    init()

    // Listen for auth state changes
    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null); setPage(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Load global context data after login ──
  useEffect(() => {
    if (!user) return
    const loadCtx = async () => {
      setLoading(true)
      const [{ data: zak }, { data: sk }, { data: fak }, { data: kl }] = await Promise.all([
        sb.from('zakazky').select('*').order('datum', { ascending: false }),
        sb.from('sklad_polozky').select('*').order('nazev'),
        sb.from('faktury').select('*').order('datum', { ascending: false }),
        sb.from('klienti').select('*').eq('aktivni', true).order('nazev'),
      ])
      setZakazky(zak || [])
      setSklad(sk || [])
      setFaktury(fak || [])
      setKlienti(kl || [])
      setLoading(false)
    }
    loadCtx()
  }, [user])

  // ── Realtime for global zakázky (dashboard) ──
  useEffect(() => {
    if (!user) return
    const ch = sb.channel('global-zakazky')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zakazky' }, async () => {
        const { data } = await sb.from('zakazky').select('*').order('datum', { ascending: false })
        setZakazky(data || [])
      })
      .subscribe()
    return () => sb.removeChannel(ch)
  }, [user])

  const doLogin = (profile) => {
    setUser(profile)
    setPage(profile.role === 'admin' ? 'dash' : profile.role === 'zamestnanec' ? 'z-prehled' : 'k-prehled')
    showToast(`Přihlášen jako ${profile.name}`, 'success')
  }

  const doLogout = async () => {
    await sb.auth.signOut()
    setUser(null); setPage(null)
    setZakazky([]); setSklad([]); setFaktury([]); setKlienti([])
  }

  // ── Loading screen ──
  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: S.bg, gap: 16 }}>
      <div style={{ width: 48, height: 48, background: S.accent, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 900, color: '#000' }}>✦</div>
      <Spinner />
      <div style={{ fontSize: 13, color: S.muted2 }}>Připojuji k Supabase…</div>
    </div>
  )

  // ── Login screen ──
  if (!user) return <Login onLogin={doLogin} />

  // ── Determine user's linked IDs ──
  // klientId is stored in pozice field for klient role (K001, K002...)
  const userKlientId = user.role === 'klient' ? user.pozice : null
  // zamId could be linked by email in future; for now use E001 for Jana
  const userZamId = user.role === 'zamestnanec' ? 'E001' : null

  // ── Page routing ──
  const pages = {
    // Admin pages
    'dash':         <Dashboard />,
    'zakazky':      <Zakazky role="admin" />,
    'opakovane':    <Opakovane />,
    'pozadavky':    <Pozadavky />,
    'kalendar':     <Kalendar />,
    'klienti':      <Klienti />,
    'zamestnanci':  <Zamestnanci />,
    'fakturace':    <Fakturace />,
    'mzdy':         <Mzdy />,
    'sklad':        <Sklad />,
    'wiki':         <Wiki />,
    'nastaveni':    <Nastaveni />,
    // Zaměstnanec pages
    'z-prehled':    <ZamPrehled user={user} />,
    'z-zakazky':    <Zakazky role="zamestnanec" userZamId={userZamId} />,
    'z-mzda':       <Mzdy zamId={userZamId} />,
    'z-profil':     <Profil user={user} />,
    // Klient pages
    'k-prehled':    <KlientPrehled user={user} klientId={userKlientId} />,
    'k-zakazky':    <Zakazky role="klient" userKlientId={userKlientId} />,
    'k-pozadavky':  <Pozadavky klientMode klientId={userKlientId} />,
    'k-faktury':    <Fakturace klientId={userKlientId} />,
    'k-profil':     <Profil user={user} />,
  }

  const currentPage = pages[page]

  return (
    <Ctx.Provider value={{ zakazky, setZakazky, sklad, setSklad, faktury, setFaktury, klienti, setKlienti, showToast, setPage, loading }}>
      <div style={{ display: 'flex', minHeight: '100vh', background: S.bg, color: S.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <Sidebar page={page} setPage={setPage} user={user} onLogout={doLogout} />
        <main style={{ marginLeft: 240, flex: 1, padding: '28px 32px', maxWidth: 1300, minHeight: '100vh' }}>
          {currentPage || (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: S.muted2 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>Stránka se připravuje</div>
            </div>
          )}
        </main>
      </div>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Ctx.Provider>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { sb } from './supabase.js'
import { useCtx } from './App.jsx'
import {
  S, fmt, fmtD, ini,
  stavLbl, typLbl, fakLbl,
  stavBdg, typBdg, fakBdg,
  Bdg, Btn, Field, inputStyle,
  Modal, Spinner, PH, Tbl, TD
} from './ui.jsx'

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
export function Dashboard() {
  const { zakazky, sklad, faktury, setPage, loading } = useCtx()
  const today = new Date().toISOString().slice(0, 10)

  const stats = [
    { l: 'Aktivní zakázky', v: zakazky.filter(z => z.stav === 'probiha').length, ic: '📋', pg: 'zakazky' },
    { l: 'Dnes naplánováno', v: zakazky.filter(z => z.datum === today).length, ic: '📅', pg: 'kalendar' },
    { l: 'Dokončeno celkem', v: zakazky.filter(z => z.stav === 'dokonceno').length, ic: '✅' },
    { l: 'Nízké zásoby', v: sklad.filter(s => s.qty <= s.min_qty).length, ic: '📦', pg: 'sklad' },
    { l: 'Nezaplacené faktury', v: faktury.filter(f => f.stav !== 'uhrazena' && f.stav !== 'storno').length, ic: '⚠️', pg: 'fakturace' },
    { l: 'Tržby (uhrazeno)', v: fmt(faktury.filter(f => f.stav === 'uhrazena').reduce((a, f) => a + f.castka, 0)), ic: '💰' },
  ]
  const dnes = zakazky.filter(z => z.datum === today)
  const nizke = sklad.filter(s => s.qty <= s.min_qty)
  const poSpl = faktury.filter(f => f.stav === 'po_splatnosti')

  if (loading) return <Spinner />
  return (
    <div>
      <PH title="Dashboard" sub={`Přehled provozu — ${fmtD(today)}`} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        {stats.map((s, i) => (
          <div key={i} style={{ ...S.stat, cursor: s.pg ? 'pointer' : 'default' }} onClick={() => s.pg && setPage(s.pg)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 10, color: S.muted2, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 6 }}>{s.l}</div>
                <div style={{ fontWeight: 800, fontSize: 26 }}>{s.v}</div>
              </div>
              <span style={{ fontSize: 22 }}>{s.ic}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        <div style={S.card}>
          <div style={{ fontWeight: 700, marginBottom: 14 }}>📅 Dnešní plán</div>
          {dnes.length === 0
            ? <div style={{ color: S.muted2, textAlign: 'center', padding: 30 }}>Dnes žádné zakázky</div>
            : <Tbl cols={['ID', 'Objekt', 'Pracovník', 'Čas', 'Stav']} rows={dnes.map(z => (
              <tr key={z.id}>
                <TD accent bold>{z.id}</TD>
                <TD>{z.objekt?.slice(0, 22)}…</TD>
                <TD muted>{z.zamestnanec?.split(' ')[0]}</TD>
                <TD muted>{z.cas}</TD>
                <td style={{ padding: '11px 13px', borderBottom: '1px solid rgba(37,42,54,.5)' }}>{stavBdg(z.stav)}</td>
              </tr>
            ))} />}
        </div>
        <div style={S.card}>
          <div style={{ fontWeight: 700, marginBottom: 14 }}>🔔 Upozornění</div>
          {nizke.length === 0 && poSpl.length === 0 && <div style={{ color: S.muted2, fontSize: 13 }}>Žádná upozornění ✓</div>}
          {poSpl.map(f => (
            <div key={f.id} style={{ display: 'flex', gap: 8, padding: '9px 0', borderBottom: '1px solid rgba(37,42,54,.5)', fontSize: 13 }}>
              <span>🔴</span><span style={{ color: S.muted2 }}>Faktura {f.id} po splatnosti ({fmt(f.castka)})</span>
            </div>
          ))}
          {nizke.length > 0 && (
            <div style={{ display: 'flex', gap: 8, padding: '9px 0', borderBottom: '1px solid rgba(37,42,54,.5)', fontSize: 13 }}>
              <span>🟡</span><span style={{ color: S.muted2 }}>Nízké zásoby: {nizke.map(s => s.nazev).join(', ')}</span>
            </div>
          )}
          {zakazky.filter(z => z.stav === 'dokonceno').slice(0, 2).map(z => (
            <div key={z.id} style={{ display: 'flex', gap: 8, padding: '9px 0', fontSize: 13 }}>
              <span>🟢</span><span style={{ color: S.muted2 }}>Dokončena {z.id}: {z.objekt?.slice(0, 28)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── ZAKÁZKY ───────────────────────────────────────────────────────────────────
export function Zakazky({ role = 'admin', userZamId, userKlientId }) {
  const { showToast, klienti } = useCtx()
  const [zakazky, setZakazky] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('vse')
  const [detail, setDetail] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    klient: '', klient_id: '', objekt: '', adresa: '',
    zamestnanec: 'Jana Nováková', zam_id: 'E001',
    datum: new Date().toISOString().slice(0, 10), cas: '', cena: '', instrukce: '', typ: 'svj'
  })

  const load = useCallback(async () => {
    setLoading(true)
    let q = sb.from('zakazky').select('*').order('datum', { ascending: false })
    if (role === 'zamestnanec' && userZamId) q = q.eq('zam_id', userZamId)
    if (role === 'klient' && userKlientId) q = q.eq('klient_id', userKlientId)
    const { data } = await q
    setZakazky(data || [])
    setLoading(false)
  }, [role, userZamId, userKlientId])

  useEffect(() => { load() }, [load])

  // Realtime
  useEffect(() => {
    const ch = sb.channel('zakazky-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zakazky' }, () => load())
      .subscribe()
    return () => sb.removeChannel(ch)
  }, [load])

  const filt = zakazky.filter(z => {
    const ms = (z.klient + z.id + z.objekt).toLowerCase().includes(search.toLowerCase())
    const mt = tab === 'vse' || z.stav === tab || (tab === 'dok' && z.stav === 'dokonceno')
    return ms && mt
  })

  const zmenStav = async (id, s) => {
    const { error } = await sb.from('zakazky').update({ stav: s }).eq('id', id)
    if (error) { showToast('Chyba: ' + error.message, 'error'); return }
    showToast(`Stav → ${stavLbl(s)}`, 'success')
    load()
    if (detail?.id === id) setDetail(p => ({ ...p, stav: s }))
  }

  const toggleCheck = async (z, cId) => {
    const newCl = (z.checklist || []).map(c => c.id === cId ? { ...c, done: !c.done } : c)
    await sb.from('zakazky').update({ checklist: newCl }).eq('id', z.id)
    load()
    if (detail?.id === z.id) setDetail(p => ({ ...p, checklist: newCl }))
  }

  const pridat = async () => {
    setSaving(true)
    const newId = `Z${String(Date.now()).slice(-5)}`
    const { error } = await sb.from('zakazky').insert({ ...form, id: newId, stav: 'naplanovano', cena: parseInt(form.cena) || 0, checklist: [] })
    if (error) showToast('Chyba: ' + error.message, 'error')
    else { showToast('Zakázka vytvořena ✓', 'success'); setShowNew(false); setForm(f => ({ ...f, klient: '', klient_id: '', objekt: '', adresa: '', cas: '', cena: '', instrukce: '' })) }
    setSaving(false)
  }

  const smazat = async (id, e) => {
    e.stopPropagation()
    if (!confirm('Smazat zakázku ' + id + '?')) return
    const { error } = await sb.from('zakazky').delete().eq('id', id)
    if (error) showToast('Chyba: ' + error.message, 'error')
    else { showToast('Zakázka smazána', 'warn'); load() }
  }

  const doneCnt = z => (z.checklist || []).filter(c => c.done).length

  return (
    <div>
      <PH
        title={role === 'zamestnanec' ? 'Moje zakázky' : role === 'klient' ? 'Zakázky' : 'Zakázky'}
        sub={`${filt.length} zakázek`}
        action={role === 'admin' && <Btn variant="primary" onClick={() => setShowNew(true)}>+ Nová zakázka</Btn>}
      />

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid ' + S.border, marginBottom: 20 }}>
        {[['vse', 'Všechny'], ['naplanovano', 'Naplánováno'], ['probiha', 'Probíhá'], ['dok', 'Dokončené']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: '9px 16px', fontSize: 13, fontWeight: tab === k ? 600 : 500, color: tab === k ? S.accent : S.muted2, background: 'none', border: 'none', borderBottom: `2px solid ${tab === k ? S.accent : 'transparent'}`, marginBottom: -1, cursor: 'pointer' }}>{l}</button>
        ))}
      </div>

      <div style={S.card}>
        <input style={{ ...inputStyle, marginBottom: 14 }} placeholder="🔍  Hledat podle ID, klienta nebo objektu…" value={search} onChange={e => setSearch(e.target.value)} />
        {loading ? <Spinner /> : filt.length === 0
          ? <div style={{ color: S.muted2, textAlign: 'center', padding: 30 }}>Žádné zakázky</div>
          : <Tbl
            cols={['ID', 'Klient', 'Objekt', ...(role !== 'klient' ? ['Pracovník'] : []), 'Datum', 'Čas', 'Cena', 'Chk', 'Stav', ...(role === 'admin' ? [''] : [])]}
            rows={filt.map(z => (
              <tr key={z.id} style={{ cursor: 'pointer' }} onClick={() => setDetail(z)}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <TD accent bold>{z.id}</TD>
                <TD bold>{z.klient?.slice(0, 16)}…</TD>
                <TD muted>{z.objekt?.slice(0, 20)}…</TD>
                {role !== 'klient' && <TD muted>{z.zamestnanec?.split(' ')[0]}</TD>}
                <TD>{fmtD(z.datum)}</TD>
                <TD muted>{z.cas || '—'}</TD>
                <TD bold>{fmt(z.cena)}</TD>
                <TD muted>{doneCnt(z)}/{(z.checklist || []).length}</TD>
                <td style={{ padding: '11px 13px', borderBottom: '1px solid rgba(37,42,54,.5)' }}>{stavBdg(z.stav)}</td>
                {role === 'admin' && (
                  <td style={{ padding: '11px 13px', borderBottom: '1px solid rgba(37,42,54,.5)' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {z.stav === 'naplanovano' && <Btn variant="blue" sm onClick={() => zmenStav(z.id, 'probiha')}>▶</Btn>}
                      {z.stav === 'probiha' && <Btn variant="primary" sm onClick={() => zmenStav(z.id, 'dokonceno')}>✓</Btn>}
                      <Btn variant="danger" sm onClick={e => smazat(z.id, e)}>🗑</Btn>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          />}
      </div>

      {/* Detail modal */}
      {detail && (
        <Modal title={`Zakázka ${detail.id}`} onClose={() => setDetail(null)} wide>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            {stavBdg(detail.stav)}{typBdg(detail.typ)}
            {role === 'admin' && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                {detail.stav === 'naplanovano' && <Btn variant="blue" sm onClick={() => zmenStav(detail.id, 'probiha')}>▶ Zahájit</Btn>}
                {detail.stav === 'probiha' && <Btn variant="primary" sm onClick={() => zmenStav(detail.id, 'dokonceno')}>✓ Dokončit</Btn>}
                {detail.stav !== 'storno' && <Btn variant="danger" sm onClick={() => zmenStav(detail.id, 'storno')}>Storno</Btn>}
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[['Klient', detail.klient], ['Objekt', detail.objekt], ['Adresa', detail.adresa || '—'], ['Zaměstnanec', detail.zamestnanec], ['Datum', fmtD(detail.datum)], ['Čas', detail.cas || '—'], ['Cena', fmt(detail.cena)], ['Typ', typLbl(detail.typ)]].map(([k, v]) => (
              <div key={k} style={{ background: S.s2, borderRadius: 7, padding: '9px 12px' }}>
                <div style={{ fontSize: 10, color: S.muted2, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase' }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 3 }}>{v}</div>
              </div>
            ))}
          </div>
          {detail.instrukce && <div style={{ background: S.s2, borderRadius: 7, padding: '10px 12px', fontSize: 13, color: S.muted2, marginBottom: 16 }}>📌 {detail.instrukce}</div>}
          {(detail.checklist || []).length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: S.muted2, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 8 }}>
                CHECKLIST — {doneCnt(detail)}/{(detail.checklist || []).length}
              </div>
              <div style={{ background: S.s2, borderRadius: 8, padding: '4px 12px' }}>
                {(detail.checklist || []).map(c => (
                  <div key={c.id} onClick={() => role !== 'klient' && toggleCheck(detail, c.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(37,42,54,.4)', cursor: role !== 'klient' ? 'pointer' : 'default' }}>
                    <div style={{ width: 18, height: 18, border: `2px solid ${c.done ? S.accent : S.border}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.done ? S.accent : 'transparent', fontSize: 11, fontWeight: 800, color: '#000', flexShrink: 0 }}>
                      {c.done && '✓'}
                    </div>
                    <span style={{ fontSize: 13, textDecoration: c.done ? 'line-through' : 'none', color: c.done ? S.muted2 : S.text }}>{c.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* New order modal */}
      {showNew && (
        <Modal title="Nová zakázka" onClose={() => setShowNew(false)}>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="KLIENT">
              <select style={inputStyle} value={form.klient_id} onChange={e => {
                const k = klienti.find(x => x.id === e.target.value)
                setForm(p => ({ ...p, klient_id: e.target.value, klient: k?.nazev || '' }))
              }}>
                <option value="">— vyber klienta —</option>
                {klienti.filter(k => k.aktivni).map(k => <option key={k.id} value={k.id}>{k.nazev}</option>)}
              </select>
            </Field>
            <Field label="TYP">
              <select style={inputStyle} value={form.typ} onChange={e => setForm(p => ({ ...p, typ: e.target.value }))}>
                <option value="svj">SVJ</option><option value="airbnb">Airbnb</option><option value="stavba">Stavba</option>
              </select>
            </Field>
            <Field label="OBJEKT / NÁZEV">
              <input style={inputStyle} value={form.objekt} onChange={e => setForm(p => ({ ...p, objekt: e.target.value }))} placeholder="např. Residence Park A – vchod 3" />
            </Field>
            <Field label="ADRESA">
              <input style={inputStyle} value={form.adresa} onChange={e => setForm(p => ({ ...p, adresa: e.target.value }))} placeholder="např. Korunní 88, Praha 2" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="DATUM">
                <input style={inputStyle} type="date" value={form.datum} onChange={e => setForm(p => ({ ...p, datum: e.target.value }))} />
              </Field>
              <Field label="ČAS">
                <input style={inputStyle} value={form.cas} onChange={e => setForm(p => ({ ...p, cas: e.target.value }))} placeholder="08:00–10:00" />
              </Field>
            </div>
            <Field label="CENA (Kč)">
              <input style={inputStyle} type="number" value={form.cena} onChange={e => setForm(p => ({ ...p, cena: e.target.value }))} placeholder="0" />
            </Field>
            <Field label="INSTRUKCE / POZNÁMKA">
              <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={form.instrukce} onChange={e => setForm(p => ({ ...p, instrukce: e.target.value }))} />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <Btn onClick={() => setShowNew(false)}>Zrušit</Btn>
            <Btn variant="primary" onClick={pridat} disabled={!form.klient || !form.objekt || saving}>
              {saving ? '⏳ Ukládám…' : 'Vytvořit zakázku'}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── KLIENTI ───────────────────────────────────────────────────────────────────
export function Klienti() {
  const { showToast } = useCtx()
  const [klienti, setKlienti] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [sel, setSel] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nazev: '', typ: 'svj', email: '', tel: '', ico: '', adresa: '', poznamka: '', aktivni: true })

  const load = async () => {
    setLoading(true)
    const { data } = await sb.from('klienti').select('*').order('nazev')
    setKlienti(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filt = klienti.filter(k => (k.nazev + k.email).toLowerCase().includes(search.toLowerCase()))

  const save = async () => {
    setSaving(true)
    if (sel) {
      const { error } = await sb.from('klienti').update(form).eq('id', sel.id)
      error ? showToast('Chyba: ' + error.message, 'error') : showToast('Klient upraven ✓', 'success')
    } else {
      const newId = `K${String(Date.now()).slice(-4)}`
      const { error } = await sb.from('klienti').insert({ ...form, id: newId })
      error ? showToast('Chyba: ' + error.message, 'error') : showToast('Klient přidán ✓', 'success')
    }
    setSaving(false); setModal(null); load()
  }

  const smazat = async (id, e) => {
    e.stopPropagation()
    if (!confirm('Smazat klienta?')) return
    const { error } = await sb.from('klienti').delete().eq('id', id)
    error ? showToast('Chyba', 'error') : showToast('Klient smazán', 'warn')
    load()
  }

  return (
    <div>
      <PH title="Klienti" sub={`${filt.length} klientů`}
        action={<Btn variant="primary" onClick={() => { setForm({ nazev: '', typ: 'svj', email: '', tel: '', ico: '', adresa: '', poznamka: '', aktivni: true }); setSel(null); setModal('form') }}>+ Nový klient</Btn>} />
      <div style={S.card}>
        <input style={{ ...inputStyle, marginBottom: 14 }} placeholder="🔍  Hledat…" value={search} onChange={e => setSearch(e.target.value)} />
        {loading ? <Spinner /> : <Tbl cols={['Název', 'Typ', 'Email', 'Telefon', 'IČO', 'Stav', '']}
          rows={filt.map(k => (
            <tr key={k.id} style={{ cursor: 'pointer' }} onClick={() => { setSel(k); setModal('detail') }}>
              <TD bold>{k.nazev}</TD>
              <td style={{ padding: '11px 13px', borderBottom: '1px solid rgba(37,42,54,.5)' }}>{typBdg(k.typ)}</td>
              <TD muted>{k.email}</TD><TD muted>{k.tel}</TD><TD muted>{k.ico || '—'}</TD>
              <td style={{ padding: '11px 13px', borderBottom: '1px solid rgba(37,42,54,.5)' }}><Bdg c={k.aktivni ? 'g' : 'm'}>{k.aktivni ? 'Aktivní' : 'Neaktivní'}</Bdg></td>
              <td style={{ padding: '11px 13px', borderBottom: '1px solid rgba(37,42,54,.5)' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Btn sm onClick={() => { setForm(k); setSel(k); setModal('form') }}>✏️</Btn>
                  <Btn variant="danger" sm onClick={e => smazat(k.id, e)}>🗑</Btn>
                </div>
              </td>
            </tr>
          ))} />}
      </div>
      {modal === 'form' && (
        <Modal title={sel ? 'Upravit klienta' : 'Nový klient'} onClose={() => setModal(null)}>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="NÁZEV"><input style={inputStyle} value={form.nazev} onChange={e => setForm(p => ({ ...p, nazev: e.target.value }))} /></Field>
            <Field label="TYP">
              <select style={inputStyle} value={form.typ} onChange={e => setForm(p => ({ ...p, typ: e.target.value }))}>
                <option value="svj">SVJ</option><option value="airbnb">Airbnb</option><option value="stavba">Stavba</option>
              </select>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="EMAIL"><input style={inputStyle} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></Field>
              <Field label="TELEFON"><input style={inputStyle} value={form.tel} onChange={e => setForm(p => ({ ...p, tel: e.target.value }))} /></Field>
            </div>
            <Field label="IČO"><input style={inputStyle} value={form.ico} onChange={e => setForm(p => ({ ...p, ico: e.target.value }))} /></Field>
            <Field label="ADRESA"><input style={inputStyle} value={form.adresa} onChange={e => setForm(p => ({ ...p, adresa: e.target.value }))} /></Field>
            <Field label="POZNÁMKA"><textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={form.poznamka} onChange={e => setForm(p => ({ ...p, poznamka: e.target.value }))} /></Field>
            <Field label="STAV">
              <select style={inputStyle} value={form.aktivni ? 'a' : 'n'} onChange={e => setForm(p => ({ ...p, aktivni: e.target.value === 'a' }))}>
                <option value="a">Aktivní</option><option value="n">Neaktivní</option>
              </select>
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <Btn onClick={() => setModal(null)}>Zrušit</Btn>
            <Btn variant="primary" onClick={save} disabled={!form.nazev || saving}>{saving ? '⏳ Ukládám…' : 'Uložit'}</Btn>
          </div>
        </Modal>
      )}
      {modal === 'detail' && sel && (
        <Modal title={sel.nazev} onClose={() => setModal(null)}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>{typBdg(sel.typ)}<Bdg c={sel.aktivni ? 'g' : 'm'}>{sel.aktivni ? 'Aktivní' : 'Neaktivní'}</Bdg></div>
          {[['Email', sel.email], ['Telefon', sel.tel], ['IČO', sel.ico || '—'], ['Adresa', sel.adresa]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(37,42,54,.5)' }}>
              <span style={{ color: S.muted2, fontSize: 13 }}>{k}</span><span style={{ fontWeight: 600, fontSize: 13 }}>{v}</span>
            </div>
          ))}
          {sel.poznamka && <div style={{ background: S.s2, borderRadius: 7, padding: '10px 12px', fontSize: 13, color: S.muted2, marginTop: 12 }}>💬 {sel.poznamka}</div>}
          <div style={{ marginTop: 14 }}><Btn onClick={() => { setForm(sel); setModal('form') }}>✏️ Upravit</Btn></div>
        </Modal>
      )}
    </div>
  )
}

// ── ZAMĚSTNANCI ───────────────────────────────────────────────────────────────
export function Zamestnanci() {
  const { showToast } = useCtx()
  const [zam, setZam] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [sel, setSel] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ jmeno: '', pozice: 'Pracovník úklidu', email: '', tel: '', hodinova: '', dostupnost: 'dostupny' })

  const load = async () => {
    setLoading(true)
    const { data } = await sb.from('zamestnanci').select('*').order('jmeno')
    setZam(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true)
    if (sel) {
      const { error } = await sb.from('zamestnanci').update({ ...form, hodinova: parseInt(form.hodinova) || 0 }).eq('id', sel.id)
      error ? showToast('Chyba: ' + error.message, 'error') : showToast('Zaměstnanec upraven ✓', 'success')
    } else {
      const newId = `E${String(Date.now()).slice(-4)}`
      const { error } = await sb.from('zamestnanci').insert({ ...form, id: newId, hodinova: parseInt(form.hodinova) || 0, aktivni: true, zakazky_mesic: 0 })
      error ? showToast('Chyba: ' + error.message, 'error') : showToast('Zaměstnanec přidán ✓', 'success')
    }
    setSaving(false); setModal(null); load()
  }

  const dostL = d => ({ dostupny: 'Dostupný', omezene: 'Omezeně', nedostupny: 'Nedostupný' }[d] || d)
  const dostC = d => ({ dostupny: 'g', omezene: 'w', nedostupny: 'r' }[d] || 'm')

  return (
    <div>
      <PH title="Zaměstnanci" sub={`${zam.length} pracovníků`}
        action={<Btn variant="primary" onClick={() => { setForm({ jmeno: '', pozice: 'Pracovník úklidu', email: '', tel: '', hodinova: '', dostupnost: 'dostupny' }); setSel(null); setModal('form') }}>+ Nový zaměstnanec</Btn>} />
      <div style={S.card}>
        {loading ? <Spinner /> : <Tbl cols={['Jméno', 'Pozice', 'Sazba', 'Zakázky/měs.', 'Dostupnost', '']}
          rows={zam.map(z => (
            <tr key={z.id} style={{ cursor: 'pointer' }} onClick={() => { setSel(z); setModal('detail') }}>
              <td style={{ padding: '11px 13px', borderBottom: '1px solid rgba(37,42,54,.5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, background: S.accent, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, color: '#000', flexShrink: 0 }}>{ini(z.jmeno)}</div>
                  <span style={{ fontWeight: 600 }}>{z.jmeno}</span>
                </div>
              </td>
              <TD muted>{z.pozice}</TD>
              <TD bold>{z.hodinova} Kč/h</TD>
              <TD>{z.zakazky_mesic}</TD>
              <td style={{ padding: '11px 13px', borderBottom: '1px solid rgba(37,42,54,.5)' }}><Bdg c={dostC(z.dostupnost)}>{dostL(z.dostupnost)}</Bdg></td>
              <td style={{ padding: '11px 13px', borderBottom: '1px solid rgba(37,42,54,.5)' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Btn sm onClick={() => { setForm({ ...z, hodinova: String(z.hodinova) }); setSel(z); setModal('form') }}>✏️</Btn>
                  <Btn variant="danger" sm onClick={async e => { e.stopPropagation(); if (!confirm('Smazat?')) return; await sb.from('zamestnanci').delete().eq('id', z.id); load() }}>🗑</Btn>
                </div>
              </td>
            </tr>
          ))} />}
      </div>
      {modal === 'form' && (
        <Modal title={sel ? 'Upravit zaměstnance' : 'Nový zaměstnanec'} onClose={() => setModal(null)}>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="JMÉNO"><input style={inputStyle} value={form.jmeno} onChange={e => setForm(p => ({ ...p, jmeno: e.target.value }))} /></Field>
            <Field label="POZICE"><input style={inputStyle} value={form.pozice} onChange={e => setForm(p => ({ ...p, pozice: e.target.value }))} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="EMAIL"><input style={inputStyle} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></Field>
              <Field label="TELEFON"><input style={inputStyle} value={form.tel} onChange={e => setForm(p => ({ ...p, tel: e.target.value }))} /></Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="HODINOVÁ SAZBA (Kč)"><input style={inputStyle} type="number" value={form.hodinova} onChange={e => setForm(p => ({ ...p, hodinova: e.target.value }))} /></Field>
              <Field label="DOSTUPNOST">
                <select style={inputStyle} value={form.dostupnost} onChange={e => setForm(p => ({ ...p, dostupnost: e.target.value }))}>
                  <option value="dostupny">Dostupný</option><option value="omezene">Omezeně</option><option value="nedostupny">Nedostupný</option>
                </select>
              </Field>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <Btn onClick={() => setModal(null)}>Zrušit</Btn>
            <Btn variant="primary" onClick={save} disabled={!form.jmeno || saving}>{saving ? '⏳ Ukládám…' : 'Uložit'}</Btn>
          </div>
        </Modal>
      )}
      {modal === 'detail' && sel && (
        <Modal title={sel.jmeno} onClose={() => setModal(null)}>
          <div style={{ marginBottom: 14 }}><Bdg c={dostC(sel.dostupnost)}>{dostL(sel.dostupnost)}</Bdg></div>
          {[['Email', sel.email], ['Telefon', sel.tel], ['Sazba', sel.hodinova + ' Kč/h'], ['Zakázky/měsíc', sel.zakazky_mesic]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(37,42,54,.5)' }}>
              <span style={{ color: S.muted2, fontSize: 13 }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop: 14 }}><Btn onClick={() => { setForm({ ...sel, hodinova: String(sel.hodinova) }); setModal('form') }}>✏️ Upravit</Btn></div>
        </Modal>
      )}
    </div>
  )
}

// ── FAKTURACE ─────────────────────────────────────────────────────────────────
export function Fakturace({ klientId }) {
  const { showToast } = useCtx()
  const [fak, setFak] = useState([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)

  const load = async () => {
    setLoading(true)
    let q = sb.from('faktury').select('*').order('datum', { ascending: false })
    if (klientId) q = q.eq('klient_id', klientId)
    const { data } = await q
    setFak(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [klientId])

  const zmenStav = async (id, s) => {
    const { error } = await sb.from('faktury').update({ stav: s }).eq('id', id)
    if (error) { showToast('Chyba', 'error'); return }
    showToast(s === 'uhrazena' ? 'Faktura uhrazena ✓' : 'Stav změněn', 'success')
    load()
    if (detail?.id === id) setDetail(p => ({ ...p, stav: s }))
  }

  const celkem = fak.reduce((a, f) => a + f.castka, 0)
  const uhrazeno = fak.filter(f => f.stav === 'uhrazena').reduce((a, f) => a + f.castka, 0)
  const pospl = fak.filter(f => f.stav === 'po_splatnosti').reduce((a, f) => a + f.castka, 0)

  return (
    <div>
      <PH title={klientId ? 'Moje faktury' : 'Fakturace'} sub={`${fak.length} faktur`} />
      {!klientId && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
          {[['Celkem', fmt(celkem), S.text], ['Uhrazeno', fmt(uhrazeno), S.accent], ['Po splatnosti', fmt(pospl), S.danger]].map(([l, v, c]) => (
            <div key={l} style={S.stat}>
              <div style={{ fontSize: 10, color: S.muted2, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 6 }}>{l}</div>
              <div style={{ fontWeight: 800, fontSize: 22, color: c }}>{v}</div>
            </div>
          ))}
        </div>
      )}
      <div style={S.card}>
        {loading ? <Spinner /> : <Tbl
          cols={['Číslo', ...(!klientId ? ['Klient'] : []), 'Datum', 'Splatnost', 'Celkem', 'Stav', ...(!klientId ? [''] : [])]}
          rows={fak.map(f => (
            <tr key={f.id} style={{ cursor: 'pointer' }} onClick={() => setDetail(f)}>
              <TD accent bold>{f.id}</TD>
              {!klientId && <TD bold>{f.klient?.slice(0, 16)}…</TD>}
              <TD>{fmtD(f.datum)}</TD>
              <td style={{ padding: '11px 13px', borderBottom: '1px solid rgba(37,42,54,.5)', color: f.stav === 'po_splatnosti' ? S.danger : S.muted2 }}>{fmtD(f.splatnost)}</td>
              <TD bold>{fmt(f.castka)}</TD>
              <td style={{ padding: '11px 13px', borderBottom: '1px solid rgba(37,42,54,.5)' }}>{fakBdg(f.stav)}</td>
              {!klientId && (
                <td style={{ padding: '11px 13px', borderBottom: '1px solid rgba(37,42,54,.5)' }} onClick={e => e.stopPropagation()}>
                  {f.stav !== 'uhrazena' && f.stav !== 'storno' && <Btn variant="primary" sm onClick={() => zmenStav(f.id, 'uhrazena')}>✓ Uhradit</Btn>}
                </td>
              )}
            </tr>
          ))}
        />}
      </div>
      {detail && (
        <Modal title={`Faktura ${detail.id}`} onClose={() => setDetail(null)}>
          <div style={{ marginBottom: 14 }}>{fakBdg(detail.stav)}</div>
          {[['Klient', detail.klient], ['Datum vystavení', fmtD(detail.datum)], ['Splatnost', fmtD(detail.splatnost)], ['Základ (bez DPH)', fmt(detail.bez_dph)], ['DPH 21 %', fmt(detail.dph)], ['Celkem s DPH', fmt(detail.castka)]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(37,42,54,.5)' }}>
              <span style={{ color: S.muted2, fontSize: 13 }}>{k}</span>
              <span style={{ fontWeight: 700 }}>{v}</span>
            </div>
          ))}
          {!klientId && detail.stav !== 'uhrazena' && detail.stav !== 'storno' && (
            <Btn variant="primary" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} onClick={() => zmenStav(detail.id, 'uhrazena')}>✓ Označit jako uhrazeno</Btn>
          )}
        </Modal>
      )}
    </div>
  )
}

// ── SKLAD ─────────────────────────────────────────────────────────────────────
export function Sklad() {
  const { showToast } = useCtx()
  const [sklad, setSkladData] = useState([])
  const [loading, setLoading] = useState(true)
  const [pm, setPm] = useState(null)
  const [pf, setPf] = useState({ typ: 'prijem', qty: '' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await sb.from('sklad_polozky').select('*').order('kat').order('nazev')
    setSkladData(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const nizke = sklad.filter(s => s.qty <= s.min_qty)

  const pohyb = async () => {
    setSaving(true)
    const q = parseInt(pf.qty) || 0
    const newQty = pf.typ === 'prijem' ? pm.qty + q : Math.max(0, pm.qty - q)
    const { error } = await sb.from('sklad_polozky').update({ qty: newQty }).eq('id', pm.id)
    if (error) showToast('Chyba: ' + error.message, 'error')
    else { showToast(`${pf.typ === 'prijem' ? '+' : '-'}${q} ${pm.jed} — ${pm.nazev}`, 'success'); setPm(null); load() }
    setSaving(false)
  }

  return (
    <div>
      <PH title="Sklad" sub="Zásoby čisticích prostředků" />
      {nizke.length > 0 && (
        <div style={{ background: 'rgba(255,59,92,.08)', border: '1px solid rgba(255,59,92,.25)', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: S.danger, display: 'flex', gap: 10, marginBottom: 18, alignItems: 'flex-start' }}>
          <span>⚠️</span>
          <div><strong>Nízké zásoby:</strong> {nizke.map(s => `${s.nazev} (${s.qty} ${s.jed})`).join(', ')}</div>
        </div>
      )}
      <div style={S.card}>
        {loading ? <Spinner /> : <Tbl cols={['Název', 'Kategorie', 'Množství', 'Min. stav', 'Cena/j.', 'Stav', '']}
          rows={sklad.map(s => (
            <tr key={s.id}>
              <TD bold>{s.nazev}</TD>
              <td style={{ padding: '11px 13px', borderBottom: '1px solid rgba(37,42,54,.5)' }}>
                <span style={{ background: S.s2, border: '1px solid ' + S.border, borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 600, color: S.muted2 }}>{s.kat}</span>
              </td>
              <td style={{ padding: '11px 13px', borderBottom: '1px solid rgba(37,42,54,.5)', fontWeight: 700, color: s.qty <= s.min_qty ? S.danger : S.text }}>{s.qty} {s.jed}</td>
              <TD muted>{s.min_qty} {s.jed}</TD>
              <TD>{s.cena} Kč</TD>
              <td style={{ padding: '11px 13px', borderBottom: '1px solid rgba(37,42,54,.5)' }}><Bdg c={s.qty <= s.min_qty ? 'r' : 'g'}>{s.qty <= s.min_qty ? 'Nízké' : 'OK'}</Bdg></td>
              <td style={{ padding: '11px 13px', borderBottom: '1px solid rgba(37,42,54,.5)' }}>
                <Btn variant="blue" sm onClick={() => { setPm(s); setPf({ typ: 'prijem', qty: '' }) }}>📦 Pohyb</Btn>
              </td>
            </tr>
          ))} />}
      </div>
      {pm && (
        <Modal title={`Pohyb skladu — ${pm.nazev}`} onClose={() => setPm(null)}>
          <div style={{ background: S.s2, borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
            Aktuální stav: <strong style={{ color: pm.qty <= pm.min_qty ? S.danger : S.accent }}>{pm.qty} {pm.jed}</strong> (min. {pm.min_qty})
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="TYP POHYBU">
              <select style={inputStyle} value={pf.typ} onChange={e => setPf(p => ({ ...p, typ: e.target.value }))}>
                <option value="prijem">Příjem (+)</option>
                <option value="vydej">Výdej (−)</option>
              </select>
            </Field>
            <Field label={`MNOŽSTVÍ (${pm.jed})`}>
              <input style={inputStyle} type="number" min="1" value={pf.qty} onChange={e => setPf(p => ({ ...p, qty: e.target.value }))} autoFocus />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <Btn onClick={() => setPm(null)}>Zrušit</Btn>
            <Btn variant="primary" onClick={pohyb} disabled={!pf.qty || saving}>{saving ? '⏳ Ukládám…' : 'Potvrdit pohyb'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── MZDY ──────────────────────────────────────────────────────────────────────
export function Mzdy({ zamId }) {
  const { showToast } = useCtx()
  const [zam, setZam] = useState([])
  const [stavM, setStavM] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      let q = sb.from('zamestnanci').select('*').order('jmeno')
      if (zamId) q = q.eq('id', zamId)
      const { data } = await q
      setZam((data || []).map(z => ({ ...z, h: Math.round(z.zakazky_mesic * 2.4), mzda: Math.round(z.zakazky_mesic * 2.4 * z.hodinova) })))
      setLoading(false)
    }
    load()
  }, [zamId])

  const mes = new Date().toLocaleString('cs-CZ', { month: 'long', year: 'numeric' })

  return (
    <div>
      <PH title={zamId ? 'Moje mzda' : 'Přehled mezd'} sub={mes.charAt(0).toUpperCase() + mes.slice(1)} />
      {!zamId && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
          {[['Mzdové náklady celkem', fmt(zam.reduce((a, m) => a + m.mzda, 0))], ['Hodin celkem', zam.reduce((a, m) => a + m.h, 0) + ' hod'], ['Počet pracovníků', zam.length]].map(([l, v]) => (
            <div key={l} style={S.stat}>
              <div style={{ fontSize: 10, color: S.muted2, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 6 }}>{l}</div>
              <div style={{ fontWeight: 800, fontSize: 22 }}>{v}</div>
            </div>
          ))}
        </div>
      )}
      <div style={S.card}>
        {loading ? <Spinner /> : <Tbl
          cols={[...(!zamId ? ['Jméno'] : []), 'Sazba/h', 'Hodin', 'Zakázky', 'Hrubá mzda', 'Stav', ...(!zamId ? [''] : [])]}
          rows={zam.map(m => (
            <tr key={m.id}>
              {!zamId && <TD bold>{m.jmeno}</TD>}
              <TD muted>{m.hodinova} Kč</TD>
              <TD>{m.h} hod</TD>
              <TD>{m.zakazky_mesic}</TD>
              <td style={{ padding: '11px 13px', borderBottom: '1px solid rgba(37,42,54,.5)', fontWeight: 800, color: S.accent, fontSize: 15 }}>{fmt(m.mzda)}</td>
              <td style={{ padding: '11px 13px', borderBottom: '1px solid rgba(37,42,54,.5)' }}>
                <Bdg c={(stavM[m.id] || 'v') === 'vyplaceno' ? 'g' : (stavM[m.id] || 'v') === 'schvaleno' ? 'b' : 'w'}>
                  {(stavM[m.id] || 'v') === 'vyplaceno' ? 'Vyplaceno' : (stavM[m.id] || 'v') === 'schvaleno' ? 'Schváleno' : 'Vypočítáno'}
                </Bdg>
              </td>
              {!zamId && (
                <td style={{ padding: '11px 13px', borderBottom: '1px solid rgba(37,42,54,.5)' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {!stavM[m.id] && <Btn variant="blue" sm onClick={() => { setStavM(p => ({ ...p, [m.id]: 'schvaleno' })); showToast('Mzda schválena', 'success') }}>✓ Schválit</Btn>}
                    {stavM[m.id] === 'schvaleno' && <Btn variant="primary" sm onClick={() => { setStavM(p => ({ ...p, [m.id]: 'vyplaceno' })); showToast('Mzda vyplacena ✓', 'success') }}>💰 Vyplatit</Btn>}
                  </div>
                </td>
              )}
            </tr>
          ))}
        />}
      </div>
    </div>
  )
}

// ── POŽADAVKY ─────────────────────────────────────────────────────────────────
export function Pozadavky({ klientMode, klientId }) {
  const { showToast } = useCtx()
  const [poz, setPoz] = useState([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ objekt: '', popis: '' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    let q = sb.from('pozadavky').select('*').order('created_at', { ascending: false })
    if (klientId) q = q.eq('klient_id', klientId)
    const { data } = await q
    setPoz(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [klientId])

  const stavL = s => ({ novy: 'Nový', prohlidka: 'Prohlídka', zakazka: 'Převedeno' }[s] || s)
  const stavC = s => ({ novy: 'w', prohlidka: 'b', zakazka: 'm' }[s] || 'm')

  const prevest = async p => {
    const newId = `Z${String(Date.now()).slice(-5)}`
    const { error } = await sb.from('zakazky').insert({
      id: newId, klient: p.klient, klient_id: p.klient_id, objekt: p.objekt,
      adresa: '—', zamestnanec: 'Jana Nováková', zam_id: 'E001',
      datum: new Date().toISOString().slice(0, 10), cas: '09:00–11:00',
      stav: 'naplanovano', cena: 0, typ: 'svj', instrukce: p.popis, checklist: []
    })
    if (error) { showToast('Chyba: ' + error.message, 'error'); return }
    await sb.from('pozadavky').update({ stav: 'zakazka', zakazka_id: newId }).eq('id', p.id)
    showToast(`Převedeno na zakázku ${newId} ✓`, 'success')
    load(); setDetail(null)
  }

  const odeslat = async () => {
    setSaving(true)
    const newId = `P${String(Date.now()).slice(-5)}`
    const { error } = await sb.from('pozadavky').insert({
      id: newId, klient: klientMode ? 'Bytový Správce s.r.o.' : 'Admin',
      klient_id: klientId || 'K001', ...form, stav: 'novy'
    })
    error ? showToast('Chyba: ' + error.message, 'error') : showToast('Požadavek odeslán ✓', 'success')
    setSaving(false); setShowNew(false); load()
  }

  return (
    <div>
      <PH title={klientMode ? 'Moje požadavky' : 'Požadavky'} sub={`${poz.length} požadavků`}
        action={<Btn variant="primary" onClick={() => { setForm({ objekt: '', popis: '' }); setShowNew(true) }}>+ Nový požadavek</Btn>} />
      <div style={S.card}>
        {loading ? <Spinner /> : poz.length === 0
          ? <div style={{ color: S.muted2, textAlign: 'center', padding: 30 }}>Žádné požadavky</div>
          : <Tbl cols={['ID', 'Klient', 'Objekt', 'Datum', 'Stav', ...(!klientMode ? [''] : [])]}
            rows={poz.map(p => (
              <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setDetail(p)}>
                <TD accent bold>{p.id}</TD>
                <TD bold>{p.klient}</TD>
                <TD muted>{p.objekt}</TD>
                <TD>{fmtD(p.datum || p.created_at)}</TD>
                <td style={{ padding: '11px 13px', borderBottom: '1px solid rgba(37,42,54,.5)' }}><Bdg c={stavC(p.stav)}>{stavL(p.stav)}</Bdg></td>
                {!klientMode && (
                  <td style={{ padding: '11px 13px', borderBottom: '1px solid rgba(37,42,54,.5)' }} onClick={e => e.stopPropagation()}>
                    {p.stav !== 'zakazka' && <Btn variant="primary" sm onClick={() => prevest(p)}>→ Zakázka</Btn>}
                  </td>
                )}
              </tr>
            ))}
          />}
      </div>
      {detail && (
        <Modal title={`Požadavek ${detail.id}`} onClose={() => setDetail(null)}>
          <Bdg c={stavC(detail.stav)}>{stavL(detail.stav)}</Bdg>
          <div style={{ fontSize: 13, color: S.muted2, margin: '12px 0 4px' }}>📍 {detail.objekt}</div>
          <div style={{ background: S.s2, borderRadius: 7, padding: '12px', fontSize: 13, color: S.muted2, marginBottom: 14 }}>{detail.popis}</div>
          {!klientMode && detail.stav !== 'zakazka' && (
            <Btn variant="primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => prevest(detail)}>→ Převést na zakázku</Btn>
          )}
        </Modal>
      )}
      {showNew && (
        <Modal title="Nový požadavek" onClose={() => setShowNew(false)}>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="OBJEKT / ADRESA"><input style={inputStyle} value={form.objekt} onChange={e => setForm(p => ({ ...p, objekt: e.target.value }))} placeholder="např. Apt. Vinohrady 12" /></Field>
            <Field label="POPIS POŽADAVKU"><textarea style={{ ...inputStyle, resize: 'vertical' }} rows={4} value={form.popis} onChange={e => setForm(p => ({ ...p, popis: e.target.value }))} placeholder="Popište co je potřeba…" /></Field>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <Btn onClick={() => setShowNew(false)}>Zrušit</Btn>
            <Btn variant="primary" disabled={!form.objekt || !form.popis || saving} onClick={odeslat}>{saving ? '⏳ Odesílám…' : 'Odeslat požadavek'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── OPAKOVANÉ ─────────────────────────────────────────────────────────────────
export function Opakovane() {
  const { showToast } = useCtx()
  const [plany, setPlany] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const { data } = await sb.from('opakovane_plany').select('*').order('klient')
    setPlany(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const toggle = async p => {
    await sb.from('opakovane_plany').update({ aktivni: !p.aktivni }).eq('id', p.id)
    showToast(p.aktivni ? 'Plán pozastaven' : 'Plán aktivován ✓', 'info')
    load()
  }

  const smazat = async id => {
    if (!confirm('Smazat opakovaný plán?')) return
    await sb.from('opakovane_plany').delete().eq('id', id)
    showToast('Plán smazán', 'warn')
    load()
  }

  return (
    <div>
      <PH title="Opakované plány" sub={`${plany.length} plánů`} />
      <div style={S.card}>
        {loading ? <Spinner /> : <Tbl cols={['Klient', 'Objekt', 'Frekvence', 'Zaměstnanec', 'Stav', '']}
          rows={plany.map(p => (
            <tr key={p.id}>
              <TD bold>{p.klient}</TD>
              <TD muted>{p.objekt}</TD>
              <td style={{ padding: '11px 13px', borderBottom: '1px solid rgba(37,42,54,.5)' }}>
                <span style={{ background: S.s2, border: '1px solid ' + S.border, borderRadius: 6, padding: '3px 9px', fontSize: 11, color: S.muted2 }}>{p.frekv}</span>
              </td>
              <TD muted>{p.zamestnanec}</TD>
              <td style={{ padding: '11px 13px', borderBottom: '1px solid rgba(37,42,54,.5)' }}><Bdg c={p.aktivni ? 'g' : 'm'}>{p.aktivni ? 'Aktivní' : 'Pozastaveno'}</Bdg></td>
              <td style={{ padding: '11px 13px', borderBottom: '1px solid rgba(37,42,54,.5)' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Btn sm onClick={() => toggle(p)}>{p.aktivni ? '⏸' : '▶'}</Btn>
                  <Btn variant="danger" sm onClick={() => smazat(p.id)}>🗑</Btn>
                </div>
              </td>
            </tr>
          ))} />}
      </div>
    </div>
  )
}

// ── KALENDÁŘ ──────────────────────────────────────────────────────────────────
export function Kalendar({ zamId }) {
  const [zakazky, setZakazky] = useState([])
  const [weekOffset, setWeekOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      let q = sb.from('zakazky').select('id,objekt,datum,cas,stav,zamestnanec')
      if (zamId) q = q.eq('zam_id', zamId)
      const { data } = await q
      setZakazky(data || [])
      setLoading(false)
    }
    load()
  }, [zamId])

  const days = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7)
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d })
  const todayStr = today.toISOString().slice(0, 10)
  const efd = d => zakazky.filter(e => e.datum === d.toISOString().slice(0, 10))
  const COLOR = { probiha: '#4da6ff', dokonceno: '#00e5a0', naplanovano: '#ffaa00', storno: '#ff3b5c' }

  return (
    <div>
      <PH
        title="Kalendář"
        sub={`${fmtD(week[0].toISOString())} – ${fmtD(week[6].toISOString())}`}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn sm onClick={() => setWeekOffset(p => p - 1)}>← Minulý</Btn>
            <Btn sm onClick={() => setWeekOffset(0)}>Dnes</Btn>
            <Btn sm onClick={() => setWeekOffset(p => p + 1)}>Další →</Btn>
          </div>
        }
      />
      {loading ? <Spinner /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8 }}>
          {week.map((d, i) => {
            const de = efd(d)
            const isToday = d.toISOString().slice(0, 10) === todayStr
            return (
              <div key={i}>
                <div style={{ padding: '8px', borderRadius: '8px 8px 0 0', background: isToday ? 'rgba(0,229,160,.1)' : S.s2, border: `1px solid ${isToday ? 'rgba(0,229,160,.3)' : S.border}`, borderBottom: 'none', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: S.muted2, fontWeight: 700 }}>{days[i]}</div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: isToday ? S.accent : S.text }}>{d.getDate()}</div>
                  {de.length > 0 && <div style={{ fontSize: 10, color: S.muted2 }}>{de.length}×</div>}
                </div>
                <div style={{ background: S.s1, border: `1px solid ${isToday ? 'rgba(0,229,160,.3)' : S.border}`, borderRadius: '0 0 8px 8px', minHeight: 100, padding: 4 }}>
                  {de.map(e => (
                    <div key={e.id} style={{ background: S.s2, borderRadius: 5, padding: '4px 6px', marginBottom: 3, borderLeft: `3px solid ${COLOR[e.stav] || '#888'}` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.objekt?.slice(0, 16)}</div>
                      <div style={{ fontSize: 9, color: S.muted2 }}>{e.cas || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── WIKI ──────────────────────────────────────────────────────────────────────
export function Wiki() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data } = await sb.from('wiki').select('*').order('kat').order('titulek')
      setItems(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const kats = [...new Set(items.map(w => w.kat))]

  return (
    <div>
      <PH title="Wiki — Znalostní báze" sub={`${items.length} článků`} />
      {loading ? <Spinner /> : kats.map(k => (
        <div key={k} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: S.muted2, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', marginBottom: 10 }}>{k}</div>
          {items.filter(w => w.kat === k).map(w => (
            <div key={w.id} style={{ ...S.card, marginBottom: 8, cursor: 'pointer', transition: 'border-color .15s' }}
              onClick={() => setDetail(w)}
              onMouseEnter={e => e.currentTarget.style.borderColor = S.accent}
              onMouseLeave={e => e.currentTarget.style.borderColor = S.border}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{w.titulek}</div>
              <div style={{ color: S.muted2, fontSize: 12 }}>{w.obsah?.slice(0, 80)}… <span style={{ color: S.accent }}>Číst →</span></div>
            </div>
          ))}
        </div>
      ))}
      {detail && (
        <Modal title={detail.titulek} onClose={() => setDetail(null)} wide>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <span style={{ background: S.s2, border: '1px solid ' + S.border, borderRadius: 6, padding: '3px 9px', fontSize: 11, color: S.muted2 }}>{detail.kat}</span>
          </div>
          <div style={{ background: S.s2, borderRadius: 8, padding: 16, fontSize: 13, lineHeight: 1.9, whiteSpace: 'pre-line', color: S.muted2 }}>{detail.obsah}</div>
          <div style={{ marginTop: 10, fontSize: 11, color: S.muted }}>Autor: {detail.autor} · {fmtD(detail.updated_at)}</div>
        </Modal>
      )}
    </div>
  )
}

// ── NASTAVENÍ ─────────────────────────────────────────────────────────────────
export function Nastaveni() {
  const { showToast } = useCtx()
  const [firma, setFirma] = useState({ nazev: 'PrimeClean s.r.o.', ico: '12345678', dic: 'CZ12345678', email: 'info@primeclean.cz', tel: '+420 800 123 456', adresa: 'Václavské nám. 1, Praha 1' })

  return (
    <div>
      <PH title="Nastavení" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 900 }}>
        <div style={S.card}>
          <div style={{ fontWeight: 700, marginBottom: 16 }}>🏢 Údaje firmy</div>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="NÁZEV FIRMY"><input style={inputStyle} value={firma.nazev} onChange={e => setFirma(p => ({ ...p, nazev: e.target.value }))} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="IČO"><input style={inputStyle} value={firma.ico} onChange={e => setFirma(p => ({ ...p, ico: e.target.value }))} /></Field>
              <Field label="DIČ"><input style={inputStyle} value={firma.dic} onChange={e => setFirma(p => ({ ...p, dic: e.target.value }))} /></Field>
            </div>
            <Field label="EMAIL"><input style={inputStyle} value={firma.email} onChange={e => setFirma(p => ({ ...p, email: e.target.value }))} /></Field>
            <Field label="TELEFON"><input style={inputStyle} value={firma.tel} onChange={e => setFirma(p => ({ ...p, tel: e.target.value }))} /></Field>
            <Field label="ADRESA"><input style={inputStyle} value={firma.adresa} onChange={e => setFirma(p => ({ ...p, adresa: e.target.value }))} /></Field>
          </div>
          <div style={{ marginTop: 16 }}><Btn variant="primary" onClick={() => showToast('Nastavení uloženo ✓', 'success')}>Uložit změny</Btn></div>
        </div>
        <div>
          <div style={{ ...S.card, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>🗄️ Supabase databáze</div>
            <div style={{ fontSize: 12, fontFamily: 'monospace', color: S.accent, background: S.s2, borderRadius: 6, padding: '8px 12px', marginBottom: 8, wordBreak: 'break-all' }}>zkuexarumnixfoflrixj.supabase.co</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Bdg c="g">● Připojeno</Bdg>
              <Bdg c="b">EU Central</Bdg>
            </div>
          </div>
          <div style={S.card}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>📊 Statistiky DB</div>
            {[['Tabulky', '11'], ['RLS politiky', 'Zapnuto'], ['Auth trigger', 'Aktivní'], ['Realtime', 'Zakázky']].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(37,42,54,.5)', fontSize: 13 }}>
                <span style={{ color: S.muted2 }}>{k}</span><span style={{ fontWeight: 600, color: S.accent }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── PROFIL ────────────────────────────────────────────────────────────────────
export function Profil({ user }) {
  const { showToast } = useCtx()
  const [form, setForm] = useState({ name: user.name || '', email: user.email || '' })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const { error } = await sb.from('profiles').update({ name: form.name }).eq('id', user.id)
    error ? showToast('Chyba při ukládání', 'error') : showToast('Profil uložen ✓', 'success')
    setSaving(false)
  }

  return (
    <div>
      <PH title="Profil" />
      <div style={{ ...S.card, maxWidth: 460 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, background: S.accent, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, color: '#000' }}>{ini(user.name)}</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{user.name}</div>
            <div style={{ color: S.muted2, fontSize: 13, marginBottom: 6 }}>{user.pozice}</div>
            <Bdg c={user.role === 'admin' ? 'g' : user.role === 'zamestnanec' ? 'b' : 'w'}>{user.role}</Bdg>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="JMÉNO / NÁZEV">
            <input style={inputStyle} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </Field>
          <Field label="EMAIL">
            <input style={{ ...inputStyle, opacity: .6 }} value={form.email} disabled />
          </Field>
          <Field label="ROLE">
            <input style={{ ...inputStyle, opacity: .6 }} value={user.role} disabled />
          </Field>
        </div>
        <div style={{ marginTop: 16 }}>
          <Btn variant="primary" onClick={save} disabled={saving}>{saving ? '⏳ Ukládám…' : 'Uložit profil'}</Btn>
        </div>
      </div>
    </div>
  )
}

// ── ZAMĚSTNANEC PŘEHLED ───────────────────────────────────────────────────────
export function ZamPrehled({ user }) {
  const { showToast } = useCtx()
  const [zakazky, setZakazky] = useState([])
  const [zamData, setZamData] = useState(null)
  const [smena, setSmena] = useState(null)
  const [timer, setTimer] = useState(0)

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().slice(0, 10)
      const { data: zak } = await sb.from('zakazky').select('*').eq('zam_id', 'E001').eq('datum', today)
      setZakazky(zak || [])
      const { data: zd } = await sb.from('zamestnanci').select('*').eq('email', user.email).single()
      setZamData(zd)
    }
    load()
  }, [user.email])

  useEffect(() => {
    if (!smena || smena.end) return
    const iv = setInterval(() => setTimer(p => p + 1), 1000)
    return () => clearInterval(iv)
  }, [smena])

  const zahajit = async () => {
    const now = new Date()
    setSmena({ start: now.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }), iso: now.toISOString() })
    setTimer(0)
    showToast('Směna zahájena ✓', 'success')
  }

  const ukoncit = async () => {
    const now = new Date()
    if (zamData) {
      const { data: { user: u } } = await sb.auth.getUser()
      await sb.from('smeny').insert({ zam_id: zamData.id, user_id: u?.id, zacatek: smena.iso, konec: now.toISOString() })
    }
    setSmena(p => ({ ...p, end: now.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) }))
    showToast('Směna ukončena a uložena ✓', 'success')
  }

  const ft = s => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  const mzda = zamData ? Math.round(zamData.zakazky_mesic * 2.4 * zamData.hodinova) : 0

  return (
    <div>
      <PH title={`Ahoj, ${user.name?.split(' ')[0]}! 👋`} sub={`Dnes — ${fmtD(new Date().toISOString())}`} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={{ ...S.card, borderColor: smena && !smena.end ? 'rgba(0,229,160,.3)' : S.border }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>⏱ Moje směna</div>
          {!smena ? (
            <><div style={{ color: S.muted2, fontSize: 13, marginBottom: 12 }}>Směna ještě nezačala</div><Btn variant="primary" onClick={zahajit}>▶ Zahájit směnu</Btn></>
          ) : !smena.end ? (
            <><div style={{ fontWeight: 800, fontSize: 30, color: S.accent, marginBottom: 4, fontFamily: 'monospace' }}>{ft(timer)}</div><div style={{ fontSize: 12, color: S.muted2, marginBottom: 12 }}>Zahájeno v {smena.start}</div><Btn variant="danger" onClick={ukoncit}>⏹ Ukončit směnu</Btn></>
          ) : (
            <div style={{ fontSize: 13, color: S.accent, fontWeight: 600 }}>✓ Směna: {smena.start} – {smena.end} (uložena)</div>
          )}
        </div>
        <div style={S.card}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>💰 Mzda orientačně</div>
          <div style={{ fontWeight: 800, fontSize: 28, color: S.accent }}>{fmt(mzda)}</div>
          {zamData && <div style={{ fontSize: 11, color: S.muted2, marginTop: 4 }}>{zamData.zakazky_mesic} zakázek · {(zamData.zakazky_mesic * 2.4).toFixed(1)}h · {zamData.hodinova} Kč/h</div>}
        </div>
      </div>
      <div style={S.card}>
        <div style={{ fontWeight: 700, marginBottom: 14 }}>📋 Dnešní zakázky</div>
        {zakazky.length === 0
          ? <div style={{ color: S.muted2, textAlign: 'center', padding: 20 }}>Dnes žádné zakázky</div>
          : <Tbl cols={['ID', 'Objekt', 'Čas', 'Stav']} rows={zakazky.map(z => (
            <tr key={z.id}>
              <TD accent bold>{z.id}</TD><TD bold>{z.objekt}</TD><TD muted>{z.cas}</TD>
              <td style={{ padding: '11px 13px' }}>{stavBdg(z.stav)}</td>
            </tr>
          ))} />}
      </div>
    </div>
  )
}

// ── KLIENT PŘEHLED ────────────────────────────────────────────────────────────
export function KlientPrehled({ user, klientId }) {
  const [zakazky, setZakazky] = useState([])
  const [faktury, setFaktury] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const kid = klientId || 'K001'
      const [{ data: zak }, { data: fak }] = await Promise.all([
        sb.from('zakazky').select('*').eq('klient_id', kid).order('datum', { ascending: false }).limit(6),
        sb.from('faktury').select('*').eq('klient_id', kid).not('stav', 'in', '("uhrazena","storno")')
      ])
      setZakazky(zak || [])
      setFaktury(fak || [])
      setLoading(false)
    }
    load()
  }, [klientId])

  if (loading) return <Spinner />

  return (
    <div>
      <PH title="Dobrý den! 👋" sub={user.name} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        {[['Probíhá', zakazky.filter(z => z.stav === 'probiha').length, 'b'], ['Naplánováno', zakazky.filter(z => z.stav === 'naplanovano').length, 'w'], ['Dokončeno', zakazky.filter(z => z.stav === 'dokonceno').length, 'g']].map(([l, v, c]) => (
          <div key={l} style={S.stat}>
            <div style={{ fontSize: 10, color: S.muted2, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 6 }}>{l}</div>
            <div style={{ fontWeight: 800, fontSize: 26 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 14 }}>📋 Poslední zakázky</div>
        {zakazky.length === 0
          ? <div style={{ color: S.muted2, textAlign: 'center', padding: 20 }}>Žádné zakázky</div>
          : <Tbl cols={['Objekt', 'Datum', 'Čas', 'Stav']} rows={zakazky.map(z => (
            <tr key={z.id}>
              <TD bold>{z.objekt}</TD>
              <TD>{fmtD(z.datum)}</TD>
              <TD muted>{z.cas || '—'}</TD>
              <td style={{ padding: '11px 13px', borderBottom: '1px solid rgba(37,42,54,.5)' }}>{stavBdg(z.stav)}</td>
            </tr>
          ))} />}
      </div>
      {faktury.map(f => (
        <div key={f.id} style={{ background: f.stav === 'po_splatnosti' ? 'rgba(255,59,92,.08)' : 'rgba(255,170,0,.08)', border: `1px solid ${f.stav === 'po_splatnosti' ? 'rgba(255,59,92,.25)' : 'rgba(255,170,0,.25)'}`, borderRadius: 8, padding: '12px 14px', fontSize: 13, color: f.stav === 'po_splatnosti' ? S.danger : S.warn, marginBottom: 8 }}>
          {f.stav === 'po_splatnosti' ? '🔴' : '⚠️'} Faktura {f.id} — {fmt(f.castka)} · splatnost {fmtD(f.splatnost)}
        </div>
      ))}
    </div>
  )
}

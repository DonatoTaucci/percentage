/* elimina-utente — chiusura di un account decisa da un amministratore.
 *
 * Tre cose, in quest'ordine, e l'ordine non è estetico:
 *   1. il database cancella le righe e registra la motivazione (in una
 *      transazione sola, con i controlli dentro la funzione SQL);
 *   2. si chiude l'account di accesso su Clerk;
 *   3. si avvisa la persona per email, dicendole perché.
 *
 * Prima i dati, poi la porta: chiuso l'account il token non varrebbe più e le
 * righe resterebbero senza nessuno autorizzato a toglierle. E l'email per
 * ultima perché è l'unico passo che non si può annullare: mandarla prima di
 * sapere se la cancellazione è riuscita significherebbe annunciare cose non
 * avvenute.
 *
 * Autorizzazione: come per benessere-ia, `verify_jwt` è disattivato e non
 * cambia niente. La funzione SQL rifiuta chiunque non sia amministratore, si
 * rifiuta di cancellare chi la invoca e si rifiuta di cancellare un altro
 * amministratore. Nessuno di questi controlli è nel browser.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const CLERK_SECRET = Deno.env.get('CLERK_SECRET_KEY') ?? '';
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const MITTENTE = Deno.env.get('MITTENTE_EMAIL') ?? '';
const MITTENTE_NOME = Deno.env.get('MITTENTE_NOME') ?? 'Work Balance';
const CONTATTO = Deno.env.get('CONTATTO_EMAIL') ?? 'donatotaucci@gmail.com';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function risposta(corpo: unknown, stato = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' },
  });
}

async function rpc(nome: string, args: unknown, auth: string, apikey: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey, Authorization: auth },
    body: JSON.stringify(args ?? {}),
  });
  if (!r.ok) return { ok: false, stato: r.status, dati: await r.text() };
  const testo = await r.text();
  return { ok: true, stato: r.status, dati: testo ? JSON.parse(testo) : null };
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/* Il messaggio è bilingue perché a questo punto le impostazioni della persona
   sono già state cancellate, quindi la sua lingua non la sappiamo più. */
function corpoEmail(motivo: string) {
  const m = esc(motivo);
  const testo =
    `Il tuo account Work Balance è stato chiuso da un amministratore.\n\n` +
    `Motivazione indicata:\n${motivo}\n\n` +
    `Insieme all'account sono stati eliminati dal server i tuoi turni, i check-in di benessere e le impostazioni. ` +
    `Quello che avevi salvato sul dispositivo resta lì finché non disinstalli l'applicazione o svuoti i dati del browser.\n\n` +
    `Se ritieni che la chiusura sia un errore puoi rispondere a ${CONTATTO}. ` +
    `Hai inoltre il diritto di presentare reclamo all'autorità di controllo del tuo Paese; in Italia è il Garante per la protezione dei dati personali (www.garanteprivacy.it).\n\n` +
    `— Work Balance\n\n` +
    `---\n\n` +
    `Your Work Balance account has been closed by an administrator.\n\n` +
    `Stated reason:\n${motivo}\n\n` +
    `Your shifts, wellbeing check-ins and settings have been deleted from the server along with the account. ` +
    `Anything saved on your device stays there until you uninstall the app or clear your browser data.\n\n` +
    `If you believe this is a mistake you can reply to ${CONTATTO}. ` +
    `You also have the right to lodge a complaint with your country's supervisory authority.\n`;

  const html =
    `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#1a1d23;max-width:34em">` +
    `<p>Il tuo account <strong>Work Balance</strong> è stato chiuso da un amministratore.</p>` +
    `<p><strong>Motivazione indicata:</strong></p>` +
    `<blockquote style="margin:0 0 16px;padding:10px 14px;border-left:3px solid #d0d5dd;background:#f6f7f9;white-space:pre-wrap">${m}</blockquote>` +
    `<p>Insieme all'account sono stati eliminati dal server i tuoi turni, i check-in di benessere e le impostazioni. Quello che avevi salvato sul dispositivo resta lì finché non disinstalli l'applicazione o svuoti i dati del browser.</p>` +
    `<p>Se ritieni che la chiusura sia un errore puoi rispondere a <a href="mailto:${esc(CONTATTO)}">${esc(CONTATTO)}</a>. Hai inoltre il diritto di presentare reclamo all'autorità di controllo del tuo Paese; in Italia è il Garante per la protezione dei dati personali.</p>` +
    `<hr style="border:none;border-top:1px solid #e4e7ec;margin:24px 0">` +
    `<p style="color:#667085;font-size:14px">Your <strong>Work Balance</strong> account has been closed by an administrator. Stated reason:</p>` +
    `<blockquote style="margin:0 0 16px;padding:10px 14px;border-left:3px solid #d0d5dd;background:#f6f7f9;white-space:pre-wrap;color:#667085;font-size:14px">${m}</blockquote>` +
    `<p style="color:#667085;font-size:14px">Your shifts, wellbeing check-ins and settings have been deleted from the server. If you believe this is a mistake, reply to ${esc(CONTATTO)}.</p>` +
    `</div>`;

  return { testo, html };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return risposta({ errore: 'metodo-non-consentito' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  const apikey = req.headers.get('apikey') ?? '';
  if (!auth || !apikey) return risposta({ errore: 'non-autenticato' }, 401);

  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return risposta({ errore: 'corpo-non-valido' }, 400);
  }

  const userId = String(corpo.user_id ?? '').slice(0, 200);
  const motivo = String(corpo.motivo ?? '').slice(0, 1000).trim();

  /* 1. Database: controlli, cancellazione e registro, in una transazione. */
  const esito = await rpc('elimina_utente', { p_user_id: userId, p_motivo: motivo }, auth, apikey);
  if (!esito.ok) {
    const stato = esito.stato === 401 || esito.stato === 403 ? 401 : 502;
    return risposta({ errore: stato === 401 ? 'non-autenticato' : 'database', dettaglio: esito.dati }, stato);
  }
  const d = esito.dati as { ok: boolean; motivo?: string; id?: number; email?: string };
  if (!d.ok) {
    return risposta({ errore: d.motivo ?? 'rifiutato' }, d.motivo === 'non-autorizzato' ? 403 : 400);
  }

  const note: string[] = ['righe: eliminate'];

  /* 2. L'account di accesso, che vive su Clerk. */
  let accountChiuso = false;
  if (!CLERK_SECRET) {
    note.push('clerk: CLERK_SECRET_KEY non impostata');
  } else {
    try {
      const r = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${CLERK_SECRET}` },
      });
      accountChiuso = r.ok;
      note.push(r.ok ? 'clerk: account chiuso' : `clerk: HTTP ${r.status}`);
    } catch (err) {
      note.push('clerk: ' + String(err).slice(0, 120));
    }
  }

  /* 3. L'avviso alla persona. Non è una cortesia: è la comunicazione della
        decisione, con la motivazione e con il modo per contestarla. */
  let emailInviata = false;
  if (!d.email) {
    note.push('email: indirizzo sconosciuto');
  } else if (!RESEND_KEY || !MITTENTE) {
    note.push('email: invio non configurato');
  } else {
    try {
      const { testo, html } = corpoEmail(motivo);
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
        body: JSON.stringify({
          from: `${MITTENTE_NOME} <${MITTENTE}>`,
          to: [d.email],
          reply_to: CONTATTO,
          subject: 'Il tuo account Work Balance è stato chiuso',
          text: testo,
          html,
        }),
      });
      emailInviata = r.ok;
      note.push(r.ok ? 'email: inviata' : `email: HTTP ${r.status} ${(await r.text()).slice(0, 120)}`);
    } catch (err) {
      note.push('email: ' + String(err).slice(0, 120));
    }
  }

  /* 4. Il registro si chiude con quello che è successo davvero. */
  await rpc('chiudi_eliminazione', {
    p_id: d.id, p_email_inviata: emailInviata, p_esito: note.join(' · '),
  }, auth, apikey).catch(() => { /* il registro c'è già, manca solo la coda */ });

  return risposta({
    ok: true,
    email: d.email ?? '',
    account_chiuso: accountChiuso,
    email_inviata: emailInviata,
    note: note.join(' · '),
  });
});

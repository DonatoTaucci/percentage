/* benessere-ia — la conversazione della sezione Benessere, lato server.
 *
 * Sta qui e non nel browser per tre motivi, in ordine di importanza:
 * la chiave dell'API non deve esistere sul dispositivo di nessuno; la quota
 * mensile va contata dove l'utente non può riscriverla; e le istruzioni date
 * al modello sono parte del prodotto, non un campo modificabile.
 *
 * Autenticazione: `verify_jwt` è disattivato di proposito, ma la funzione non
 * fa assolutamente nulla prima che il database abbia riconosciuto chi chiama.
 * Il token di Clerk viene inoltrato a PostgREST, che lo verifica con le chiavi
 * pubbliche di Clerk (Third-Party Auth) e ricava l'identità dal claim `sub`.
 * Un token assente, scaduto o inventato non arriva mai a consumare un credito,
 * perché consuma_credito_ia() risponde "non-autenticato" quando `sub` è vuoto.
 * La verifica sta dove stanno già le policy per riga: un posto solo.
 */

const MODELLO = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
const CHIAVE = Deno.env.get('GEMINI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';

/* Limiti di forma sul corpo della richiesta.
 *
 * La quota conta i messaggi, non i token: senza questi tetti un solo messaggio
 * da mezzo megabyte costerebbe come un mese intero di uso normale. Sono larghi
 * abbastanza da non farsi notare e stretti abbastanza da rendere prevedibile
 * il costo per credito. */
const MAX_MESSAGGI = 20;
const MAX_CARATTERI_MESSAGGIO = 2000;
const MAX_CARATTERI_RIEPILOGO = 4000;

const LINGUE: Record<string, string> = {
  it: 'italiano', en: 'inglese', es: 'spagnolo', fr: 'francese', de: 'tedesco',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function istruzioni(lingua: string): string {
  return [
    'Sei un assistente che aiuta un lavoratore a riflettere su carico di lavoro, stress, ansia da lavoro e prevenzione del burnout.',
    `Rispondi sempre in ${lingua}, con un tono diretto e concreto, senza retorica motivazionale.`,
    '',
    'Come lavori:',
    '- Parti dai dati reali dei turni che ti vengono forniti e citali quando sono rilevanti (ore, straordinari, giorni consecutivi, pause).',
    '- Dai al massimo 3 suggerimenti per risposta, ciascuno con un primo passo eseguibile entro la settimana.',
    '- Se una condizione dipende dall\'organizzazione del lavoro e non dalla persona, dillo esplicitamente invece di suggerire di "gestire meglio lo stress".',
    '- Fai una domanda di chiarimento solo quando la risposta cambierebbe davvero il consiglio.',
    '',
    'Limiti:',
    '- Non sei un medico né uno psicoterapeuta e non formuli diagnosi.',
    '- Se emergono segnali di sofferenza intensa o persistente, invita con naturalezza a rivolgersi al medico di base, a uno psicologo o al medico competente aziendale.',
    '- Se emergono riferimenti ad autolesionismo o pensieri suicidari, interrompi i consigli pratici, esprimi vicinanza e indica di contattare subito un servizio di emergenza (112) o il Telefono Amico (02 2327 2327).',
    '',
    'Non inventare dati che non ti sono stati forniti. Mantieni le risposte sotto le 250 parole salvo richiesta esplicita.',
  ].join('\n');
}

function risposta(corpo: unknown, stato = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' },
  });
}

/** Chiama una funzione del database con il token di chi ha fatto la richiesta. */
async function rpc(nome: string, args: unknown, auth: string, apikey: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey, Authorization: auth },
    body: JSON.stringify(args ?? {}),
  });
  if (!r.ok) return { ok: false, stato: r.status, dati: await r.text() };
  return { ok: true, stato: r.status, dati: await r.json() };
}

function taglia(s: unknown, max: number): string {
  return String(s ?? '').slice(0, max);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return risposta({ errore: 'metodo-non-consentito' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  const apikey = req.headers.get('apikey') ?? '';
  if (!auth || !apikey) return risposta({ errore: 'non-autenticato' }, 401);

  if (!CHIAVE) {
    // Detto per esteso: è l'errore che si incontra al primo avvio, e "500"
    // manderebbe a cercare il problema ovunque tranne dove sta.
    return risposta({ errore: 'chiave-mancante', dettaglio: 'GEMINI_API_KEY non è impostata nei secret della funzione.' }, 503);
  }

  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return risposta({ errore: 'corpo-non-valido' }, 400);
  }

  const lingua = LINGUE[String(corpo.lingua ?? 'it')] ?? 'italiano';
  const riepilogo = taglia(corpo.riepilogo, MAX_CARATTERI_RIEPILOGO);
  const grezzi = Array.isArray(corpo.messaggi) ? corpo.messaggi : [];
  const messaggi = grezzi
    .slice(-MAX_MESSAGGI)
    .map((m: Record<string, unknown>) => ({
      role: m?.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: taglia(m?.content, MAX_CARATTERI_MESSAGGIO) }],
    }))
    .filter((m) => m.parts[0].text.trim().length > 0);

  if (!messaggi.length) return risposta({ errore: 'nessun-messaggio' }, 400);

  /* 1. Il credito, prima di tutto. Identità e quota li decide il database. */
  const credito = await rpc('consuma_credito_ia', {}, auth, apikey);
  if (!credito.ok) {
    const stato = credito.stato === 401 || credito.stato === 403 ? 401 : 502;
    return risposta({ errore: stato === 401 ? 'non-autenticato' : 'database', dettaglio: credito.dati }, stato);
  }
  const c = credito.dati as { consentito: boolean; motivo?: string; usati?: number; limite?: number };
  if (!c.consentito) {
    return risposta({ errore: c.motivo ?? 'non-consentito', usati: c.usati ?? 0, limite: c.limite ?? 0 },
      c.motivo === 'non-autenticato' ? 401 : 429);
  }

  /* 2. Il modello. */
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELLO}:generateContent`;
  let dati: Record<string, any>;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': CHIAVE },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: istruzioni(lingua) + (riepilogo ? '\n\n---\n' + riepilogo : '') }] },
        contents: messaggi,
        generationConfig: {
          maxOutputTokens: 1200,
          temperature: 0.7,
          // Senza ragionamento intermedio: la risposta utile qui è corta e
          // basata su numeri già calcolati, e i token di pensiero si pagano.
          thinkingConfig: { thinkingBudget: 0 },
        },
        /* I filtri predefiniti di Google intercettano il vocabolario della
           sofferenza — sonno, esaurimento, crisi — che è esattamente il
           vocabolario di questa sezione. Alzati alla soglia alta restano
           attivi contro il contenuto davvero pericoloso senza bloccare una
           persona che sta descrivendo come sta. */
        safetySettings: [
          'HARM_CATEGORY_HARASSMENT',
          'HARM_CATEGORY_HATE_SPEECH',
          'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          'HARM_CATEGORY_DANGEROUS_CONTENT',
        ].map((category) => ({ category, threshold: 'BLOCK_ONLY_HIGH' })),
      }),
    });
    dati = await r.json();
    if (!r.ok) {
      return risposta({ errore: 'modello', dettaglio: dati?.error?.message ?? `HTTP ${r.status}` }, 502);
    }
  } catch (err) {
    return risposta({ errore: 'rete', dettaglio: String(err) }, 502);
  }

  /* 3. Il rifiuto per sicurezza non è un guasto: è un momento in cui una
        persona ha appena scritto qualcosa di pesante. Merita una frase, non
        un codice di errore. */
  const bloccoPrompt = dati?.promptFeedback?.blockReason;
  const candidato = dati?.candidates?.[0];
  const motivoFine = candidato?.finishReason;
  if (bloccoPrompt || motivoFine === 'SAFETY') {
    return risposta({
      bloccato: true,
      testo: 'Su questo non me la sento di rispondere con un consiglio pratico. Se stai passando un momento pesante, parlarne con qualcuno è la cosa che aiuta di più: il medico di base, uno psicologo, o il medico competente della tua azienda. Se hai bisogno subito: 112, oppure Telefono Amico 02 2327 2327.',
      usati: c.usati, limite: c.limite,
    });
  }

  const testo = (candidato?.content?.parts ?? [])
    .map((p: { text?: string }) => p?.text ?? '')
    .join('\n')
    .trim();

  if (!testo) {
    return risposta({ errore: 'risposta-vuota', dettaglio: motivoFine ?? '' }, 502);
  }

  /* 4. Consuntivo dei token: non blocca niente, serve a sapere quanto costa
        davvero un utente prima di decidere il prezzo dell'abbonamento. */
  const uso = dati?.usageMetadata ?? {};
  rpc('registra_token_ia', {
    p_in: uso.promptTokenCount ?? 0,
    p_out: (uso.candidatesTokenCount ?? 0) + (uso.thoughtsTokenCount ?? 0),
  }, auth, apikey).catch(() => { /* un consuntivo mancato non è un errore */ });

  return risposta({ testo, usati: c.usati, limite: c.limite, modello: MODELLO });
});

// Teste do cliente da API do MindBody. Roda com: node functions/lib/mindbodyApi.test.mjs
//
// NÃO CHAMA O MINDBODY. `fetch` é trocado por um dublê, e as respostas têm a FORMA documentada
// (OpenAPI https://api.mindbodyonline.com/public/v6/swagger/doc e as páginas Pagination /
// Handling Errors / Request Deduplication do portal). O que a documentação não confirma está
// listado como «NÃO VERIFICADO» em mindbodyApi.js — este teste prova a LÓGICA, não a API viva.
//
// Os valores de credencial abaixo são inventados para o teste; nenhum é real.
import {
  chamar, obterToken, paginar, mbFetch, acharOuCriarCliente, agendarUmaVez, cancelarAgendamento, remarcarAgendamento,
  estadoDosAgendamentos, linhaDoCliente, chaveTelefone, clienteCasa, _limparCacheDeTeste, MB_BASE,
} from "./mindbodyApi.js";

const falhas = [];
let n = 0;
const igual = (obtido, esperado, nome) => { n++; if (JSON.stringify(obtido) !== JSON.stringify(esperado)) falhas.push(`${nome}\n     esperado: ${JSON.stringify(esperado)}\n     obtido:   ${JSON.stringify(obtido)}`); };
const certo = (cond, nome) => { n++; if (!cond) falhas.push(nome); };

const SENHA = "senha-inventada-do-teste-7731";
const CHAVE = "chave-inventada-da-plataforma-4402";
const conn = { site_id: "-99", username: "staff.teste", password: SENHA };
const novoEnv = (kv) => ({ MINDBODY_API_KEY: CHAVE, ...(kv ? { RATE_LIMIT: kv } : {}) });
const resposta = (status, corpo) => new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
const emUmDia = () => new Date(Date.now() + 24 * 3600 * 1000).toISOString().replace("Z", "");   // "Expires" vem em UTC sem designador

// ── o dublê de fetch ──
let chamadas = [];
let rotas = [];
function montar(lista) {
  chamadas = []; rotas = lista;
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url);
    const c = { metodo: init.method || "GET", caminho: u.pathname.replace("/public/v6", ""), q: u.searchParams, headers: init.headers || {}, corpo: init.body ? JSON.parse(init.body) : null };
    chamadas.push(c);
    for (const r of rotas) {
      if (r.metodo === c.metodo && r.caminho === c.caminho) { const out = await r.responde(c); if (out !== undefined) return out; }
    }
    return resposta(404, { Error: { Message: `rota não prevista no teste: ${c.metodo} ${c.caminho}`, Code: "Unknown" } });
  };
}
const token = (nome = "tok-inventado-1") => ({ metodo: "POST", caminho: "/usertoken/issue", responde: () => resposta(200, { TokenType: "Bearer", AccessToken: nome, Expires: emUmDia(), User: { Id: 0, FirstName: "Site", LastName: "Owner", Type: "Owner" } }) });
const quantas = (metodo, caminho) => chamadas.filter((c) => c.metodo === metodo && c.caminho === caminho).length;

// ═══ 1. TOKEN: pedido uma vez, guardado, nunca em texto ═══════════════════════════════════════
{
  _limparCacheDeTeste();
  const env = novoEnv();
  montar([token(), { metodo: "GET", caminho: "/site/locations", responde: () => resposta(200, { PaginationResponse: { RequestedLimit: 200, RequestedOffset: 0, PageSize: 1, TotalResults: 1 }, Locations: [{ Id: 1, Name: "Astoria" }] }) }]);
  const a = await chamar(env, conn, { path: "/site/locations" });
  const b = await chamar(env, conn, { path: "/site/locations" });
  igual([a.ok, b.ok], [true, true], "duas chamadas autenticadas funcionam");
  igual(quantas("POST", "/usertoken/issue"), 1, "PLANTADO: o token é pedido UMA vez para duas chamadas (antes era um por chamada)");
  const h = chamadas.find((c) => c.caminho === "/site/locations").headers;
  igual([h["Api-Key"], h.SiteId, h.authorization], [CHAVE, "-99", "tok-inventado-1"], "cabeçalhos da doc: Api-Key, SiteId, authorization com o token cru");
  igual(chamadas[0].corpo, { Username: "staff.teste", Password: SENHA }, "usertoken/issue recebe Username/Password no corpo");
  igual(chamadas[0].headers.authorization, undefined, "o pedido de token não leva authorization");
}
{
  // KV: outro isolate (memória limpa) reaproveita o token guardado
  _limparCacheDeTeste();
  const guardado = new Map();
  const kv = { get: async (k) => guardado.get(k) || null, put: async (k, v) => { guardado.set(k, v); }, delete: async (k) => { guardado.delete(k); } };
  const env = novoEnv(kv);
  montar([token("tok-kv")]);
  await obterToken(env, conn);
  _limparCacheDeTeste();
  const t2 = await obterToken(env, conn);
  igual([t2.ok, t2.token, t2.do_cache, quantas("POST", "/usertoken/issue")], [true, "tok-kv", true, 1], "com KV, um isolate novo usa o token guardado sem pedir outro");
  certo(![...guardado.keys()].some((k) => k.includes("staff.teste") || k.includes("-99")), "PLANTADO: a chave do cache é hash — não carrega usuário nem site legíveis");
}
{
  // token do cache recusado (401) → pede outro UMA vez e repete a chamada
  _limparCacheDeTeste();
  const env = novoEnv();
  let emitidos = 0;
  montar([
    { metodo: "POST", caminho: "/usertoken/issue", responde: () => resposta(200, { AccessToken: `tok-${++emitidos}`, Expires: emUmDia() }) },
    { metodo: "GET", caminho: "/staff/staff", responde: (c) => (c.headers.authorization === "tok-1" ? resposta(401, { Error: { Message: "token expired", Code: "DeniedAccess" } }) : resposta(200, { PaginationResponse: { TotalResults: 0 }, StaffMembers: [] })) },
  ]);
  await obterToken(env, conn);                          // tok-1 entra no cache
  const r = await chamar(env, conn, { path: "/staff/staff" });
  igual([r.ok, emitidos, quantas("GET", "/staff/staff")], [true, 2, 2], "401 com token do cache → renova uma vez e a chamada passa");
}
{
  // login recusado: motivo próprio, código do MindBody, e não martela
  _limparCacheDeTeste();
  const env = novoEnv();
  montar([{ metodo: "POST", caminho: "/usertoken/issue", responde: () => resposta(403, { Error: { Message: `Staff not found for password ${SENHA}`, Code: "StaffMemberNotFound" } }) }]);
  const r1 = await chamar(env, conn, { path: "/site/locations" });
  const r2 = await chamar(env, conn, { path: "/site/locations" });
  igual([r1.ok, r1.status, r1.reason, r1.code], [false, 403, "login_recusado", "StaffMemberNotFound"], "403 no usertoken/issue → login_recusado com o código do MindBody");
  igual([r2.reason, quantas("POST", "/usertoken/issue")], ["login_recusado", 1], "login recusado não é repetido na chamada seguinte (a doc manda não repetir)");
  certo(!JSON.stringify([r1, r2]).includes(SENHA), "PLANTADO: a senha NUNCA aparece no detalhe, mesmo quando o servidor a devolve na mensagem de erro");
  igual(quantas("GET", "/site/locations"), 0, "sem token, a chamada de dados nem sai");
}

// ═══ 2. ERROS: cada falha com motivo, nenhuma vira vazio ══════════════════════════════════════
{
  _limparCacheDeTeste();
  const env = novoEnv();
  const semLogin = { site_id: "-99" };
  montar([{ metodo: "GET", caminho: "/x", responde: () => resposta(429, { Error: { Message: "Too many requests", Code: "TooManyRequests" } }) }]);
  igual((({ ok, status, reason, code }) => ({ ok, status, reason, code }))(await mbFetch(env, semLogin, { path: "/x" })), { ok: false, status: 429, reason: "limite_de_chamadas", code: "TooManyRequests" }, "429 → limite_de_chamadas");
  montar([{ metodo: "GET", caminho: "/x", responde: () => resposta(500, "<html>erro</html>") }]);
  igual((await mbFetch(env, semLogin, { path: "/x" })).reason, "mindbody_fora", "500 → mindbody_fora");
  montar([{ metodo: "GET", caminho: "/x", responde: () => resposta(400, { Error: { Message: "Client 11123123874 does not exist.", Code: "ClientNotFound" } }) }]);
  { const r = await mbFetch(env, semLogin, { path: "/x" }); igual([r.reason, r.code, r.detail], ["pedido_recusado", "ClientNotFound", "ClientNotFound: Client 11123123874 does not exist."], "400 com o formato { Error: { Message, Code } } da doc"); }
  montar([{ metodo: "GET", caminho: "/x", responde: () => resposta(200, "OK") }]);
  igual((await mbFetch(env, semLogin, { path: "/x" })).reason, "resposta_ilegivel", "PLANTADO: 200 com corpo que não é JSON é falha, não sucesso vazio");
  montar([{ metodo: "GET", caminho: "/x", responde: () => { throw new TypeError("fetch failed"); } }]);
  { const r = await mbFetch(env, semLogin, { path: "/x" }); igual([r.ok, r.status, r.reason], [false, 0, "rede"], "rede caída → { ok:false, reason:'rede' }, nada levanta"); }
  montar([{ metodo: "GET", caminho: "/x", responde: () => { const e = new Error("The operation was aborted"); e.name = "AbortError"; throw e; } }]);
  igual((await mbFetch(env, semLogin, { path: "/x", timeoutMs: 5 })).reason, "tempo_esgotado", "estouro de tempo → tempo_esgotado");
  igual((await mbFetch({}, semLogin, { path: "/x" })).reason, "sem_chave_da_plataforma", "sem MINDBODY_API_KEY nem tenta");
  igual((await mbFetch(env, {}, { path: "/x" })).reason, "sem_site", "sem site_id nem tenta");
  certo(MB_BASE === "https://api.mindbodyonline.com/public/v6", "base URL da doc");
}

// ═══ 3. PAGINAÇÃO ═════════════════════════════════════════════════════════════════════════════
{
  _limparCacheDeTeste();
  const env = novoEnv();
  const todos = Array.from({ length: 450 }, (_, i) => ({ Id: String(i + 1), FirstName: `C${i + 1}` }));
  const pagina = (c) => {
    const lim = Number(c.q.get("request.limit")), off = Number(c.q.get("request.offset"));
    const fatia = todos.slice(off, off + lim);
    return resposta(200, { PaginationResponse: { RequestedLimit: lim, RequestedOffset: off, PageSize: fatia.length, TotalResults: todos.length }, Clients: fatia });
  };
  montar([token(), { metodo: "GET", caminho: "/client/clients", responde: pagina }]);
  const r = await paginar(env, conn, { path: "/client/clients", chave: "Clients" });
  igual([r.ok, r.itens.length, r.total, r.paginas, r.truncado], [true, 450, 450, 3, false], "450 clientes em 3 páginas de 200");
  igual(chamadas.filter((c) => c.caminho === "/client/clients").map((c) => `${c.q.get("request.limit")}@${c.q.get("request.offset")}`), ["200@0", "200@200", "200@400"], "request.limit=200 (máximo da doc) e request.offset andando pelo que veio");
  igual(r.itens[449].Id, "450", "o último item é o último do conjunto");

  // lotes retomáveis (importação)
  const lote = await paginar(env, conn, { path: "/client/clients", chave: "Clients", maxPaginas: 1, offsetInicial: 200 });
  igual([lote.itens.length, lote.truncado, lote.proximo_offset, lote.itens[0].Id], [200, true, 400, "201"], "lote: retoma do offset, avisa que há mais e diz de onde continuar");

  // PLANTADO: a 2ª página falha → a leitura INTEIRA falha (não devolve 200 itens como se fossem todos)
  let vez = 0;
  montar([token(), { metodo: "GET", caminho: "/client/clients", responde: (c) => (++vez === 2 ? resposta(500, { Error: { Message: "boom", Code: "Unknown" } }) : pagina(c)) }]);
  _limparCacheDeTeste();
  const q = await paginar(env, conn, { path: "/client/clients", chave: "Clients" });
  igual([q.ok, q.reason, q.itens, q.lidos_antes_da_falha], [false, "mindbody_fora", undefined, 200], "PLANTADO: página 2 com erro → ok:false, sem lista parcial passando por lista inteira");

  // PLANTADO: 200 sem o campo esperado não é "lista vazia"
  montar([token(), { metodo: "GET", caminho: "/appointment/bookableitems", responde: () => resposta(200, { PaginationResponse: { TotalResults: 0 } }) }]);
  _limparCacheDeTeste();
  const s = await paginar(env, conn, { path: "/appointment/bookableitems", chave: "Availabilities" });
  igual([s.ok, s.reason], [false, "resposta_inesperada"], "PLANTADO: resposta sem o campo Availabilities é falha — nunca 'não tem horário'");

  // 200 com lista vazia de verdade É vazio
  montar([token(), { metodo: "GET", caminho: "/appointment/bookableitems", responde: () => resposta(200, { PaginationResponse: { RequestedLimit: 200, RequestedOffset: 0, PageSize: 0, TotalResults: 0 }, Availabilities: [] }) }]);
  _limparCacheDeTeste();
  const v = await paginar(env, conn, { path: "/appointment/bookableitems", chave: "Availabilities", query: { "request.sessionTypeIds": [11, 12] } });
  igual([v.ok, v.itens.length], [true, 0], "lista vazia com 200 é o único 'vazio' legítimo");
  igual(chamadas.find((c) => c.caminho === "/appointment/bookableitems").q.getAll("request.sessionTypeIds"), ["11", "12"], "lista em parâmetro de consulta vai como chave repetida (collectionFormat multi)");

  // servidor ignorando o offset
  montar([token(), { metodo: "GET", caminho: "/client/clients", responde: () => resposta(200, { Clients: todos.slice(0, 200) }) }]);
  _limparCacheDeTeste();
  igual((await paginar(env, conn, { path: "/client/clients", chave: "Clients" })).reason, "paginacao_ignorada", "mesma página duas vezes → falha, não laço infinito nem lista duplicada");
}

// ═══ 4. CLIENTE: por telefone/e-mail exatos — nunca pelo nome ═════════════════════════════════
const cliente = (Id, FirstName, LastName, extra = {}) => ({ Id: String(Id), UniqueId: Number(Id) + 9000, FirstName, LastName, Email: null, MobilePhone: null, HomePhone: null, WorkPhone: null, Active: true, ...extra });
const busca = (porTexto) => ({ metodo: "GET", caminho: "/client/clients", responde: (c) => {
  const t = c.q.get("request.searchText"), ids = c.q.getAll("request.clientIDs");
  const lista = ids.length ? (porTexto.__ids || []).filter((x) => ids.includes(x.Id)) : (porTexto[t] || []);
  return resposta(200, { PaginationResponse: { RequestedLimit: 200, RequestedOffset: 0, PageSize: lista.length, TotalResults: lista.length }, Clients: lista });
} });
{
  igual([chaveTelefone("+1 (929) 535-0191"), chaveTelefone("19295350191"), chaveTelefone("929.535.0191")], ["9295350191", "9295350191", "9295350191"], "três formatos do mesmo telefone → a mesma chave");
  igual(clienteCasa(cliente(1, "Maria", "Silva", { MobilePhone: "212-555-0000" }), { fone: "9295350191", email: "" }), null, "PLANTADO: nome igual e telefone diferente NÃO é a pessoa");

  // O caso da ligação: a busca por nome traz a "Maria Silva" errada PRIMEIRO; a certa é a do telefone.
  _limparCacheDeTeste();
  const env = novoEnv();
  const errada = cliente(100, "Maria", "Silva", { MobilePhone: "(212) 555-0000" });
  const certa = cliente(200, "Mariah", "Silvano", { HomePhone: "+1 (929) 535-0191" });
  montar([token(), busca({ "Maria Silva": [errada, certa] }), { metodo: "POST", caminho: "/client/addclient", responde: () => resposta(200, { Client: cliente(999, "X", "Y") }) }]);
  const r = await acharOuCriarCliente(env, conn, { nome: "Maria Silva", telefone: "929-535-0191" });
  igual([r.ok, r.client_id, r.criado, r.por], [true, "200", false, "telefone"], "PLANTADO: acha a cliente pelo TELEFONE (id 200), não o primeiro resultado da busca por nome (id 100)");
  igual(quantas("POST", "/client/addclient"), 0, "achou → não cria");

  // ninguém com aquele telefone → cria; NUNCA devolve o homônimo
  _limparCacheDeTeste();
  montar([token(), busca({ "Maria Silva": [errada] }), { metodo: "POST", caminho: "/client/addclient", responde: () => resposta(200, { Client: cliente(301, "Maria", "Silva") }) }]);
  const c2 = await acharOuCriarCliente(env, conn, { nome: "Maria Silva", telefone: "9295350191" });
  igual([c2.ok, c2.client_id, c2.criado], [true, "301", true], "PLANTADO: homônima com outro telefone não é reaproveitada — cria cadastro novo");
  igual(chamadas.find((x) => x.caminho === "/client/addclient").corpo, { FirstName: "Maria", LastName: "Silva", MobilePhone: "9295350191" }, "AddClient com FirstName/LastName (obrigatórios na doc) e o telefone");

  // por e-mail (campo que o searchText cobre, segundo a doc)
  _limparCacheDeTeste();
  montar([token(), busca({ "ana@exemplo.com": [cliente(400, "Ana", "Souza", { Email: "ANA@exemplo.com" })] })]);
  const c3 = await acharOuCriarCliente(env, conn, { nome: "Aninha", telefone: "", email: "Ana@Exemplo.com" });
  igual([c3.client_id, c3.por], ["400", "email"], "acha por e-mail, sem diferenciar maiúsculas");

  // ids do índice local: conferidos no MindBody antes de valer
  _limparCacheDeTeste();
  montar([token(), busca({ __ids: [cliente(500, "Luis", "T", { MobilePhone: "9295350191" }), cliente(501, "Outro", "Q", { MobilePhone: "2125550000" })] })]);
  const c4 = await acharOuCriarCliente(env, conn, { nome: "Louise", telefone: "+19295350191", idsConhecidos: ["500", "501"] });
  igual([c4.client_id, quantas("GET", "/client/clients")], ["500", 1], "índice local: confere os ids no MindBody e fica só com quem tem o telefone (nome mal-ouvido não atrapalha)");

  // PLANTADO: a busca falhou → NÃO cria cliente (cadastro duplicado no sistema do spa)
  _limparCacheDeTeste();
  montar([token(), { metodo: "GET", caminho: "/client/clients", responde: () => resposta(500, { Error: { Message: "db", Code: "SQLDBMaintenance" } }) }, { metodo: "POST", caminho: "/client/addclient", responde: () => resposta(200, { Client: cliente(998, "X", "Y") }) }]);
  const c5 = await acharOuCriarCliente(env, conn, { nome: "Maria Silva", telefone: "9295350191" });
  igual([c5.ok, c5.reason, quantas("POST", "/client/addclient")], [false, "mindbody_fora", 0], "PLANTADO: busca com erro → falha, e NENHUM cliente é criado às cegas");

  // sem telefone nem e-mail não há como identificar
  igual((await acharOuCriarCliente(env, conn, { nome: "Maria Silva" })).reason, "sem_contato", "PLANTADO: só com o nome não procura nem cria");

  // duplicata na criação (mesmo nome + e-mail) → pega o registro existente
  _limparCacheDeTeste();
  montar([token(), busca({}), { metodo: "POST", caminho: "/client/addclient", responde: () => resposta(400, { Error: { Message: "Client creation cannot result in duplicate client records.", Code: "InvalidClientCreation" } }) },
    { metodo: "GET", caminho: "/client/clientduplicates", responde: () => resposta(200, { PaginationResponse: { TotalResults: 1 }, ClientDuplicates: [{ Id: "777", UniqueId: 1, FirstName: "Ana", LastName: "Souza", Email: "ana@exemplo.com" }] }) }]);
  const c6 = await acharOuCriarCliente(env, conn, { nome: "Ana Souza", email: "ana@exemplo.com" });
  igual([c6.ok, c6.client_id, c6.criado], [true, "777", false], "InvalidClientCreation → o cadastro que já existe (clientduplicates)");

  // site exige campos que a agente não tem
  _limparCacheDeTeste();
  montar([token(), busca({}), { metodo: "POST", caminho: "/client/addclient", responde: () => resposta(400, { Error: { Message: "BirthDate is required", Code: "MissingRequiredFields" } }) }]);
  igual((await acharOuCriarCliente(env, conn, { nome: "Ana Souza", telefone: "9295350191" })).reason, "cliente_campos_obrigatorios", "site que exige mais campos → motivo próprio, não 'erro genérico'");
}

// ═══ 5. AGENDAMENTO IDEMPOTENTE ═══════════════════════════════════════════════════════════════
const pedido = { clientId: "200", sessionTypeId: 11, staffId: 100012, locationId: 1, inicioLocal: "2026-10-01T09:00:00", chave: "tenant@exemplo.com|req-abc" };
const appt = (extra = {}) => ({ Id: 555, Status: "Booked", StartDateTime: "2026-10-01T09:00:00", EndDateTime: "2026-10-01T10:00:00", Duration: 60, ClientId: "200", SessionTypeId: 11, StaffId: 100012, LocationId: 1, ...extra });
const agenda = (lista) => ({ metodo: "GET", caminho: "/appointment/staffappointments", responde: () => resposta(200, { PaginationResponse: { RequestedLimit: 200, RequestedOffset: 0, PageSize: lista().length, TotalResults: lista().length }, Appointments: lista() }) });
{
  _limparCacheDeTeste();
  const env = novoEnv();
  let criados = [];
  montar([token(), agenda(() => criados), { metodo: "POST", caminho: "/appointment/addappointment", responde: () => { criados = [appt()]; return resposta(200, { Appointment: appt() }); } }]);
  const a = await agendarUmaVez(env, conn, pedido);
  igual([a.ok, a.appointment_id, a.reutilizado], [true, 555, false], "primeiro pedido cria o agendamento");
  const corpo = chamadas.find((c) => c.caminho === "/appointment/addappointment").corpo;
  igual([corpo.ClientId, corpo.LocationId, corpo.SessionTypeId, corpo.StaffId, corpo.StartDateTime], ["200", 1, 11, 100012, "2026-10-01T09:00:00"], "corpo da doc: ClientId texto, ids numéricos, StartDateTime em hora LOCAL sem Z");
  certo(!/[0-9a-f]{8}-[0-9a-f]{4}-/.test(JSON.stringify(corpo)), "PLANTADO: nenhum UUID da Guileo vai no corpo do AddAppointment");
  const q = chamadas.find((c) => c.caminho === "/appointment/staffappointments").q;
  igual([q.get("request.clientId"), q.get("request.startDate"), q.get("request.endDate")], ["200", "2026-10-01", "2026-10-01"], "antes de criar, lê a agenda do cliente NAQUELE dia");

  // retry com a MESMA chave de pedido (a ElevenLabs re-tenta a ferramenta)
  const b = await agendarUmaVez(env, conn, pedido);
  igual([b.ok, b.appointment_id, b.reutilizado, b.por, quantas("POST", "/appointment/addappointment")], [true, 555, true, "chave_do_pedido", 1], "PLANTADO: o mesmo pedido de novo devolve o MESMO agendamento — 1 POST no total");

  // outro isolate, sem cache: a agenda do cliente mostra que já existe
  _limparCacheDeTeste();
  const c = await agendarUmaVez(env, conn, { ...pedido, chave: "outra-chave" });
  igual([c.ok, c.appointment_id, c.reutilizado, c.por, quantas("POST", "/appointment/addappointment")], [true, 555, true, "agenda_do_cliente", 1], "PLANTADO: sem cache, mesma cliente + mesma sessão + mesmo minuto = já existe → continua 1 POST");

  // um agendamento CANCELADO no mesmo horário não bloqueia um novo
  _limparCacheDeTeste();
  let lista = [appt({ Id: 444, Status: "Cancelled" })];
  montar([token(), agenda(() => lista), { metodo: "POST", caminho: "/appointment/addappointment", responde: () => resposta(200, { Appointment: appt({ Id: 556 }) }) }]);
  igual((await agendarUmaVez(env, conn, pedido)).appointment_id, 556, "agendamento cancelado naquele minuto não conta como 'já existe'");

  // a leitura de antes falhou → NÃO cria
  _limparCacheDeTeste();
  montar([token(), { metodo: "GET", caminho: "/appointment/staffappointments", responde: () => resposta(500, { Error: { Message: "x", Code: "Unknown" } }) }, { metodo: "POST", caminho: "/appointment/addappointment", responde: () => resposta(200, { Appointment: appt() }) }]);
  const d = await agendarUmaVez(env, conn, pedido);
  igual([d.ok, d.etapa, quantas("POST", "/appointment/addappointment")], [false, "conferir_antes_de_agendar", 0], "PLANTADO: não conseguiu olhar a agenda → não agenda (é assim que nasce a reserva dupla)");

  // o POST estourou o tempo MAS o agendamento entrou → relê e devolve sucesso
  _limparCacheDeTeste();
  lista = [];
  montar([token(), agenda(() => lista), { metodo: "POST", caminho: "/appointment/addappointment", responde: () => { lista = [appt({ Id: 557 })]; const e = new Error("aborted"); e.name = "AbortError"; throw e; } }]);
  const f = await agendarUmaVez(env, conn, pedido);
  igual([f.ok, f.appointment_id, f.por], [true, 557, "conferido_apos_falha"], "tempo esgotado no POST, mas a agenda mostra o horário → sucesso com o id real");

  // 409 da deduplicação do MindBody ("Identical request is still in progress")
  _limparCacheDeTeste();
  lista = [];
  montar([token(), agenda(() => lista), { metodo: "POST", caminho: "/appointment/addappointment", responde: () => { lista = [appt({ Id: 558 })]; return resposta(409, { Error: { Message: "Identical request is still in progress", Code: "Unknown" } }); } }]);
  igual((await agendarUmaVez(env, conn, pedido, { esperaMs: 0 })).appointment_id, 558, "409 (pedido idêntico em andamento) → relê a agenda e devolve o agendamento do primeiro pedido");

  // horário que não dá
  _limparCacheDeTeste();
  montar([token(), agenda(() => []), { metodo: "POST", caminho: "/appointment/addappointment", responde: () => resposta(400, { Error: { Message: "The time requested is not a valid booking time.", Code: "InvalidBookingTime" } }) }]);
  const g = await agendarUmaVez(env, conn, pedido);
  igual([g.ok, g.reason, g.horario_tomado, g.code], [false, "horario_indisponivel", true, "InvalidBookingTime"], "InvalidBookingTime → horario_indisponivel (a agente oferece outro), com o código do MindBody");

  igual((await agendarUmaVez(env, conn, { ...pedido, staffId: null })).reason, "pedido_incompleto", "sem StaffId não tenta");
  igual((await agendarUmaVez(env, conn, { ...pedido, inicioLocal: "amanhã às 10" })).reason, "pedido_incompleto", "PLANTADO: fala crua ('amanhã às 10') NUNCA chega ao MindBody como StartDateTime");
  igual(quantas("POST", "/appointment/addappointment"), 1, "os dois pedidos incompletos acima não geraram POST");
}

// ═══ 6. CANCELAR · REMARCAR · ESTADO ══════════════════════════════════════════════════════════
{
  _limparCacheDeTeste();
  const env = novoEnv();
  montar([token(), { metodo: "POST", caminho: "/appointment/updateappointment", responde: () => resposta(200, { Appointment: appt({ Status: "Cancelled" }) }) }]);
  const a = await cancelarAgendamento(env, conn, 555);
  igual([a.ok, a.status, chamadas.at(-1).corpo], [true, "Cancelled", { AppointmentId: 555, Execute: "cancel" }], "cancelar = updateappointment com Execute:'cancel'");
  montar([token(), { metodo: "POST", caminho: "/appointment/updateappointment", responde: () => resposta(200, { Appointment: appt({ Status: "Booked" }) }) }]);
  igual((await cancelarAgendamento(env, conn, 555)).reason, "cancelamento_nao_confirmado", "PLANTADO: 200 com Status ainda 'Booked' NÃO é cancelamento");

  montar([token(), { metodo: "POST", caminho: "/appointment/updateappointment", responde: () => resposta(200, { Appointment: appt({ StartDateTime: "2026-10-02T14:00:00" }) }) }]);
  const r = await remarcarAgendamento(env, conn, 555, { inicioLocal: "2026-10-02T14:00:00", staffId: 100099 });
  igual([r.ok, chamadas.at(-1).corpo], [true, { AppointmentId: 555, StartDateTime: "2026-10-02T14:00:00", StaffId: 100099 }], "remarcar = updateappointment com StartDateTime local (+ StaffId quando muda)");
  montar([token(), { metodo: "POST", caminho: "/appointment/updateappointment", responde: () => resposta(200, { Appointment: appt() }) }]);
  igual((await remarcarAgendamento(env, conn, 555, { inicioLocal: "2026-10-02T14:00:00" })).reason, "remarcacao_nao_confirmada", "PLANTADO: 200 devolvendo o horário ANTIGO não é remarcação");

  montar([token(), agenda(() => [appt({ Id: 1, Status: "Cancelled" }), appt({ Id: 2, Status: "Booked" }), appt({ Id: 99, Status: "Booked" })])]);
  const e = await estadoDosAgendamentos(env, conn, { ids: [1, 2, 3], inicio: "2026-09-28", fim: "2027-03-30" });
  igual([e.ok, [...e.porId.keys()], e.porId.get(1).Status, e.porId.has(3)], [true, [1, 2], "Cancelled", false], "estado: só os ids pedidos; quem não veio (3) fica FORA do mapa, sem status inventado");
  igual(chamadas.at(-1).q.getAll("request.appointmentIds"), ["1", "2", "3"], "consulta por appointmentIds");
}

// ═══ 7. linha de importação ═══════════════════════════════════════════════════════════════════
{
  igual(linhaDoCliente(cliente(10, "Ana", "Souza", { MobilePhone: "(929) 535-0191", Email: " ANA@Exemplo.com ", BirthDate: "1990-05-04T00:00:00", SendPromotionalTexts: true })),
    { mb_id: "10", nome: "Ana Souza", telefone: "(929) 535-0191", email: "ana@exemplo.com", nascimento: "1990-05-04", ativo: true, aceita_sms: true, aceita_email: false }, "cliente do MindBody → linha do CRM");
  igual(linhaDoCliente(cliente(11, "Bia", ".", { HomePhone: "2125550000", BirthDate: "0001-01-01T00:00:00" })),
    { mb_id: "11", nome: "Bia", telefone: "2125550000", email: "", nascimento: null, ativo: true, aceita_sms: false, aceita_email: false }, "PLANTADO: data-base 0001-01-01 não vira aniversário; sobrenome '.' não entra no nome; sem consentimento marcado = não consentiu");
  igual(linhaDoCliente({ FirstName: "Sem", LastName: "Id" }), null, "cliente sem Id não entra");
}

for (const f of falhas) console.log(`❌ ${f}`);
console.log(falhas.length ? `\n${falhas.length} de ${n} caso(s) falharam — o cliente da API do MindBody está errado` : `✅ mindbodyApi · ${n} casos · token em cache, paginação sem meia-lista, erro com motivo, cliente por telefone/e-mail, agendamento idempotente`);
if (falhas.length) process.exit(1);

# Contexto do Projeto - Essencial Saúde (27/02/2026)

## STATUS ATUAL: Sistema estável em produção — múltiplas features implementadas

---

## RESOLUÇÕES RECENTES (27/02/2026):

### 1. Slot cancelado continuava bloqueado na recepção
- **Problema:** Ao cancelar um agendamento duplicado, o horário ficava bloqueado impedindo novo cadastro.
- **Solução em `frontend/src/app/recepcao/calendario/page.js`:**
  - Em `handleOpenModal`, agendamentos com status `CANCELADO` são tratados como slot vazio (abre formulário de novo agendamento em vez de mostrar detalhes).
  ```javascript
  const agendamentoAtivo = agendamento?.status === 'CANCELADO' ? null : agendamento;
  ```

### 2. Intervalos de 20 minutos não apareciam na recepção
- **Problema:** Grade da recepção estava hard-coded para 30 minutos, ignorando configuração real do médico.
- **Solução:**
  - Adicionado estado `slotsPorMedico` (objeto keyed por medicoId) que busca slots reais via `/api/medicos/:id/disponiveis`.
  - Função `medicoTemSlot(medicoId, hora)` verifica por médico se tem slot disponível ou agendamento naquele horário.
  - Células de médicos sem aquele slot aparecem como cinza/bloqueado (não clicável).
  ```javascript
  const medicoTemSlot = (medicoId, hora) => {
    const slots = slotsPorMedico[medicoId] || [];
    const temSlotLivre = slots.includes(hora);
    const temAgendamento = agendamentos.some(a => a.medico_id === medicoId && a.horario.startsWith(hora));
    return temSlotLivre || temAgendamento;
  };
  ```

### 3. Status AUSENTE para pacientes que saem da clínica
- **Fluxo:** PRESENTE → CHAMAR → EM_ATENDIMENTO → AUSENTE → CHAMAR NOVAMENTE → EM_ATENDIMENTO
- **Backend (`AgendamentoController.js`):** Em `alterarStatus`, quando status = AUSENTE, envia WhatsApp: "você foi chamado mas não estava disponível".
- **Frontend `medico/page.js`:**
  - Filtro da fila inclui AUSENTE
  - Badge laranja para AUSENTE na lista
  - Botão "😕 PACIENTE AUSENTE" no card EM_ATENDIMENTO
  - Botão "🔁 CHAMAR NOVAMENTE" para pacientes AUSENTE
- **Frontend `recepcao/calendario`:** Estilização laranja para status AUSENTE.

### 4. Encaixe de Urgência
- **Fluxo:** Recepção cria ENCAIXE → auto-PRESENTE → notifica fila via WhatsApp → TV mostra overlay → todos os painéis atualizam via socket.
- **Backend:**
  - Novo método `encaixar` em `AgendamentoController.js`: cria com tipo_consulta=ENCAIXE, status=PRESENTE, horário atual (fuso Brasil), notifica todos os pacientes em espera via WhatsApp.
  - Emite evento socket `encaixe-adicionado`.
  - Nova rota `POST /api/agendamentos/encaixe` em `backend/src/routes/agendamentos.js`.
  - `Agendamento.js` (model): `listarParaTv` atualizado para incluir `a.tipo_consulta` no SELECT.
- **Frontend `recepcao/calendario`:** Modal de encaixe com seletor de médico + nome do paciente. Botão 🚨 na barra superior.
- **Frontend `medico/page.js`:**
  - Badge 🚨 URGENTE e borda vermelha para ENCAIXE.
  - ENCAIXE aparece no topo da fila (acima dos CONFIRMADO/PRESENTE por horário).
  - **Removido** o modal de encaixe (foi movido para recepção).
- **Frontend `tv/page.js`:**
  - Estado `avisoEncaixe` para overlay vermelho 12 segundos.
  - Listener `encaixe-adicionado`: atualiza dados, mostra overlay, toca alerta sonoro, fala via TTS.
  - Badge 🚨 URGENTE vermelho na fila da TV para tipo_consulta=ENCAIXE.

### 5. NPS nunca estava sendo enviado
- **Problema:** O código de envio do NPS nunca foi implementado — só existia o comentário `// Futuramente mandar zap pro gerente`.
- **Solução em `AgendamentoController.js`:**
  - Envio do link NPS adicionado em **dois lugares**:
    1. Em `alterarStatus` quando status = CONCLUIDO (delay 3s)
    2. Em `enviarProntuario` após envio do PDF (delay 3s)
  ```javascript
  const linkNps = `${process.env.FRONTEND_URL}/feedback/${id}`;
  const msgNps = `⭐ *PESQUISA DE SATISFAÇÃO*\n...\n👉 ${linkNps}`;
  setTimeout(() => { whatsappService.enviarMensagem(whatsapp, msgNps) }, 3000);
  ```

### 6. Tamanho do nome dos pacientes na TV
- Reduzido progressivamente de `2vw` até `1vw` (xs) após pedidos do usuário.
- Arquivo: `frontend/src/app/tv/page.js`

### 7. Confirmação: agenda pública sincronizada com recepção
- `buscarHorariosDisponiveis` consulta o banco em tempo real excluindo status `!= 'CANCELADO'`.
- Qualquer agendamento feito pela recepção (CONFIRMADO) imediatamente remove o horário da agenda pública.
- **Nenhuma alteração necessária** — já estava correto.

---

## STATUS ATUAL: Baileys implementado, problema de logs no servidor

### O QUE FOI FEITO:
1. **Migração completa de whatsapp-web.js para Baileys** - O código foi totalmente reescrito
2. **Teste local funcionando** - Mensagens foram enviadas com sucesso no ambiente local
3. **Deploy no servidor** - Código atualizado no servidor de produção
4. **Dependências instaladas** - `@whiskeysockets/baileys`, `pino`, `qrcode`

### PROBLEMA ATUAL (PENDENTE):
- **No celular**: Mostra dispositivo conectado
- **No frontend**: Mostra "conectado" quando atualiza a página
- **Nos logs do backend**: Nunca aparece `[WhatsAppService] PRONTO! WhatsApp conectado.`
- **Resultado**: Mensagens NÃO estão sendo enviadas

O evento `connection === 'open'` parece não estar sendo disparado corretamente, mesmo que a conexão esteja estabelecida. Foram adicionados logs de debug para investigar.

---

## ARQUIVOS IMPORTANTES ALTERADOS:

### 1. backend/src/services/whatsapp/whatsappService.js
- Reescrito completamente para usar Baileys
- Usa `@whiskeysockets/baileys` ao invés de `whatsapp-web.js`
- Correção do 9º dígito via `onWhatsApp()` que retorna o JID correto
- Tratamento de erro 515 (Stream Errored) após pareamento
- Logs de debug adicionados para investigar conexão

### 2. backend/src/app.js
- Novos endpoints: `/api/whatsapp/reconnect`, `/api/whatsapp/status`, `/api/whatsapp/enviar`
- Graceful shutdown implementado
- Envia status atual para clientes socket ao conectar

### 3. backend/src/config/database.js
- Alterado para suportar tanto `DB_NAME` (produção) quanto `DB_DATABASE` (local)
- Linha: `database: process.env.DB_NAME || process.env.DB_DATABASE`

### 4. frontend/src/app/admin/page.js
- Painel de conexão WhatsApp com exibição de QR Code
- Socket.IO para receber status em tempo real

### 5. backend/package.json
- Adicionadas dependências: `@whiskeysockets/baileys`, `pino`, `qrcode`
- Removida: `whatsapp-web.js` (implícito)

---

## MAPA DE ENVIO DE MENSAGENS:

| Arquivo | Linha | Função |
|---------|-------|--------|
| `app.js` | 82 | Endpoint teste `/api/whatsapp/enviar` |
| `MedicoController.js` | 47 | Notifica pacientes quando médico atrasa |
| `AgendamentoController.js` | 65 | Confirmação ao criar agendamento |
| `AgendamentoController.js` | 193 | Confirmação ao confirmar agendamento |
| `AgendamentoController.js` | 267 | Notificação mudança de status |
| `AgendamentoController.js` | 320 | Notifica próximo da fila |
| `AgendamentoController.js` | 362 | Envia prontuário (arquivo) |
| `confirmacaoService.js` | 76 | Régua cobrança (cron hora/hora) |
| `npsService.js` | 46 | Pesquisa NPS (comentado no app.js) |
| `followupService.js` | 41 | Follow-up 15 dias |
| `mercadoPagoService.js` | 177 | Notificação pagamento |

---

## CONFIGURAÇÃO DO SERVIDOR:

### Variáveis de ambiente (.env no servidor):
```
DB_USER=admin_saude
DB_HOST=localhost
DB_NAME=essencial_saude
DB_PASSWORD=Essencial2026Strong!
DB_PORT=5432
```

### Processos PM2:
- `backend-api` - porta 5000
- `frontend-next` - Next.js

### Comandos úteis:
```bash
# Reiniciar backend
pm2 restart backend-api

# Ver logs
pm2 logs backend-api --lines 50

# Limpar sessão do WhatsApp
rm -rf /var/www/essencialsaude/backend/whatsapp-session-baileys
pm2 restart backend-api

# Atualizar código
cd /var/www/essencialsaude && git pull && pm2 restart backend-api
```

---

## PARA CONTINUAR DEBUGANDO:

1. **Ver logs em tempo real:**
```bash
pm2 logs backend-api
```

2. **Escanear QR e verificar se aparece:**
```
========================================
[WhatsAppService] PRONTO! WhatsApp conectado.
========================================
```

3. **Se conectar mas não logar**, o problema está no evento `connection === 'open'` do Baileys

4. **Testar envio manual:**
```bash
curl -X POST http://localhost:5000/api/whatsapp/enviar \
  -H "Content-Type: application/json" \
  -d '{"numero":"5587999478492","mensagem":"Teste"}'
```

---

## OUTROS ERROS CONHECIDOS:

### Erro: `column a.criado_em does not exist`
- Arquivo: `confirmacaoService.js`
- O código local usa `created_at`, servidor pode ter versão antiga
- Verificar se o pull foi feito corretamente

---

## REPOSITÓRIO:
- GitHub: `https://github.com/Fabioararipina/essencialsaude.git`
- Branch: `main`

## ÚLTIMO COMMIT:
- `debug: mais logs no connection open` (f8b5ac2)

---

## RESOLUÇÕES RECENTES (05/03/2026) — TV / FireTV zoom após rebuild:

### Problema: Zoom excessivo no FireTV após rebuild do Next.js
- Após qualquer rebuild/reload da página `/tv`, o Silk browser ficava com zoom excessivo
- Causa: viewport meta tag não estava sendo forçada, deixando o Silk aplicar zoom próprio

### Solução aplicada em `frontend/src/app/tv/page.js`:
1. **Viewport meta forçada via JS** no `useEffect` inicial:
   ```js
   meta.setAttribute('content', 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no');
   ```
2. **Parâmetro `?safe=N` restaurado** — controla o padding sem redeploy:
   - `/tv?safe=0` → sem padding (conteúdo encostado nas bordas)
   - `/tv?safe=1` → margem mínima
   - `/tv?safe=3` → padrão (equivale a `3vh 4vw`)
   - `/tv?safe=5` → margem maior

### Também corrigido em `frontend/src/app/tv/firetv/page.js`:
- Mesma viewport meta forçada via JS
- Scale limitado a `Math.min(sx, sy, 1)` para evitar escala > 1

### Página em uso no Fire TV da clínica:
- **`/tv`** (não `/tv/firetv` — esta é alternativa, não está em uso)

---

## RESOLUÇÕES RECENTES (26/02/2026) — TV / FireTV:

### Problema: Painel TV cortando conteúdo no FireTV (Amazon Silk)
- Browser do FireTV tem zoom interno que corta bordas da página
- `zoom` CSS não funciona no Silk
- `speechSynthesis` existe mas não emite som no Silk

### Solução aplicada em `frontend/src/app/tv/page.js`:

1. **Layout com `vw`/`vh` em vez de `px` fixo** — todos os tamanhos de fonte e espaçamentos usam unidades relativas à viewport, garantindo que o conteúdo caiba em qualquer resolução

2. **Padding fixo de segurança** (`3vh 4vw`) no container raiz — evita que o conteúdo encoste nas bordas (safe area para overscan)

3. **Fullscreen automático** — ao carregar a página, tenta entrar em fullscreen via `requestFullscreen` / `webkitRequestFullscreen`, eliminando a barra de endereço do browser

4. **TTS (voz) para FireTV corrigido:**
   - Detecta browser Silk pelo `userAgent` (`/Silk|AFTM|AFTB|AFTS|AFTT|AFTRS|AFTEK/i`)
   - Se for Silk → pula o `speechSynthesis` e usa **Google Translate TTS** como fallback
   - URL: `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=TEXTO&tl=pt-BR&client=gtx`
   - No Chrome → continua usando `speechSynthesis` nativo

5. **Vídeos dos slides não cortam mais:**
   - Removido atributo `loop` do elemento `<video>`
   - Adicionado `onEnded` que avança para o próximo slide ao terminar naturalmente
   - `duracao` cadastrado no admin continua funcionando como timeout máximo de segurança

### Página extra criada:
- `frontend/src/app/tv/firetv/page.js` — versão alternativa com design fixo 1920×1080 + `transform: scale()` automático. URL: `/tv/firetv`

### Como ajustar safe area sem redeploy:
```
/tv?safe=5   → 5% de padding (padrão)
/tv?safe=3   → margem menor
/tv?safe=7   → margem maior
```

---

## RESOLUÇÕES RECENTES (16/01/2026):

### 1. Sistema Restaurado e Fotos/Mídias Funcionando
- **Problema Inicial:** Após alterações de limite de upload e tentativas de correção de CORS, o sistema apresentava "Network Error" e as fotos dos médicos/mídias da TV não carregavam (erro 404). O backend também estava em loop de crash.
- **Causa Raiz:**
    - O backend falhava devido a um `TypeError` (`Cannot read properties of undefined (reading 'numero)`) no `backend/src/app.js` ao processar requisições de WhatsApp malformadas.
    - O Nginx estava com sua configuração de site duplicada (`conflicting server name`), ignorando as correções e não servindo corretamente os arquivos `/uploads/` do frontend, gerando 404.
- **Solução:**
    1.  **Restauração do Código:** `git reset --hard` e `git push --force` para o commit estável `2205024`.
    2.  **Correção do Backend:** Adicionada validação para `req.body` em `backend/src/app.js` no endpoint `/api/whatsapp/enviar` para evitar o crash.
    3.  **Correção do Nginx:**
        -   Conteúdo do arquivo `/etc/nginx/sites-available/essencialsaude` foi limpo e substituído pela configuração correta e única.
        -   Adicionado o bloco `location /uploads/` no `server` do `portal.primeatende.com.br` para que o Nginx servisse as mídias estáticas diretamente do diretório `/var/www/essencialsaude/backend/uploads/`.
        -   Recarga do Nginx (`nginx -t && systemctl reload nginx`) para aplicar as mudanças.
- **Status:** Sistema completamente funcional, fotos e mídias carregando, backend estável.
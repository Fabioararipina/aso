# Contexto do Projeto - Essencial Saúde (15/01/2026)

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

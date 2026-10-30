# Agente Dra. Thaís Campregher — Templates de mensagens

Status: **rascunho dos textos**. O código do agente NÃO está neste repositório
(`aso`); está no servidor Hetzner e ainda não foi trazido para o GitHub.
Este arquivo só organiza os textos pedidos, para aplicar quando tivermos o código.

Pendências (nada disso foi feito ainda):
- [ ] Trazer o código do agente da Dra. Thaís (e o do Dr. Weilker, usado como modelo) para o GitHub.
- [ ] Receber as imagens que o Fábio vai gerar (lembrete de consulta e outras).
- [ ] Aplicar os templates no código do agente e testar o envio.

## Variáveis sugeridas
`{nome}` paciente · `{data}` · `{hora}` · `{secretaria}` = Fernanda · `{valor_avaliacao}` = R$ 100,00

## Fluxo de agendamento

### 1. CONTATO_INICIAL — apresentação e pedido de confirmação
Olá! 🙂
Meu nome é Fernanda, sou secretária da Dra Thais Campregher.
Podemos confirmar sua consulta?

### 2. CONFIRMACAO_CURTA — reforço se não houver resposta
Olá podemos confirmar 👆🏻🦷⁉️

### 3. AGENDAMENTO — secretária inicia o agendamento
Bom dia, meu nome é Fernanda, sou secretária da Dra Thais Campregher e vou agendar sua consulta 🦷🦷🦷

### 4. VALOR_AVALIACAO — custo da avaliação
A avaliação tem um custo de R$100,00.
Esse valor deve ser pago antecipadamente via pix, para garantir seu agendamento. Se você fechar o tratamento com a Dra. Thaís, ele é revertido integralmente e descontado do valor do tratamento proposto.

### 5. ORCAMENTO — orçamento só presencial
Orçamentos são feitos somente presencialmente no consultório, direto com a Dra Thais.

### 6. AVISO_PRAZO — vaga reservada até o fim do expediente
Olá, boa tarde, aqui é Fernanda, secretária da Dra Thais Campregher. Passando para avisar que seu agendamento estará disponível até o final do expediente de hoje (18:00). Agradecemos desde já sua compreensão.

### 7. CANCELAMENTO_SEM_RETORNO
Olá, devido à falta de retorno sua consulta está cancelada. Aguardamos seu retorno para reagendar uma nova data 😷😷😷

## Lembretes

### 8. LEMBRETE_SEMANA
Bom dia, passando para lembrar que você tem consulta essa semana 🦷🦷🦷

Caso surja algum imprevisto ou seja necessária qualquer alteração, pedimos a gentileza de nos avisar com antecedência para que possamos reorganizar nossa agenda da melhor forma.
🙏🏻🌻

### 9. LEMBRETE_DIA  (com imagem — aguardando arte, modelo Dr. Weilker)
Olá, passando para lembrar que você tem consulta hoje 🦷🦷🦷

### 10. ATENCAO_GRIPE
ATENÇÃO 🤧🤧🤧
Caso você apresente alguns desses sintomas, como coriza, e possa estar gripado ou resfriado, nos comunique para reagendarmos sua consulta. 🙏🏻

### 11. ENDERECO_E_ESTACIONAMENTO
Nosso endereço: SMART CENTER 🏠
Rua José Caballero 15, sala 14 — Gonzaga, Santos/SP

Temos convênio com estacionamento 🚘 PASCUAL PARKING, na Rua Luis de Farias 59, ao lado da segunda entrada do Smart Center.

Caso surja algum imprevisto ou seja necessária qualquer alteração, pedimos a gentileza de nos avisar com antecedência para que possamos reorganizar nossa agenda da melhor forma.

Será um prazer recebê-lo(a). Até breve!

### 12. AGRADECIMENTO
Obrigada, até amanhã!!! ☺️

## Retorno / recall

### 13. RETORNO_PERIODICO
Boa tarde, tudo bem? 😊

Aqui é a Fernanda, da equipe da Dra. Thaís Campregher.

Estamos entrando em contato porque já está na hora do seu retorno para acompanhamento da saúde bucal. As consultas periódicas são essenciais para avaliar seus dentes e gengivas, fazer a limpeza e prevenir problemas antes que apareçam.

Vamos agendar o seu horário? Me diga quais dias e períodos ficam melhores para você e eu encaixo na agenda da Dra. Thaís.

Qualquer dúvida, é só me chamar por aqui. Será um prazer te receber novamente! 🦷✨

Atenciosamente,
Fernanda
Equipe Dra. Thaís Campregher

## Pontos para decidir (minha opinião)
- **Saudação fixa ("Bom dia"/"Boa tarde")**: os textos têm horário fixo. Se o agente enviar fora do horário, soa errado. Melhor usar `{saudacao}` calculada pela hora do envio.
- **Mensagem 7 (cancelamento)**: é seca para quem só esqueceu de responder. Sugiro suavizar e dar um prazo antes de cancelar.
- **Mensagem 6**: diz "até as 18:00 de hoje"; se enviada tarde, perde o sentido. Definir horário mínimo de envio.
- **Gênero**: "recebê-lo(a)" fica bom, mas se o cadastro tiver sexo dá para personalizar.
- **Endereço**: confirmar o texto "Gonzaga Santos SP" (bairro Gonzaga, Santos/SP) antes de publicar.
- **Se usar a API oficial da Meta**: mensagens enviadas pelo consultório fora da janela de 24h exigem templates aprovados pela Meta. Com Baileys isso não se aplica, mas há risco de bloqueio do número.

const db = require('../config/database');

async function setupDatabase() {
  try {
    console.log('🔄 Verificando e criando tabelas do banco de dados...');

    // 1. Tabela Pacientes
    await db.query(`
      CREATE TABLE IF NOT EXISTS pacientes (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        whatsapp VARCHAR(20),
        email VARCHAR(255),
        cpf VARCHAR(20),
        data_nascimento DATE,
        endereco TEXT,
        convenio VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Tabela "pacientes" verificada.');

    // 2. Tabela Medicos
    await db.query(`
      CREATE TABLE IF NOT EXISTS medicos (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        especialidade VARCHAR(255),
        foto_path VARCHAR(255),
        crm VARCHAR(50) DEFAULT '00000',
        valor_consulta NUMERIC(10, 2) DEFAULT 150.00,
        atraso_minutos INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Tabela "medicos" verificada.');

    // 3. Tabela Agendamentos
    await db.query(`
      CREATE TABLE IF NOT EXISTS agendamentos (
        id SERIAL PRIMARY KEY,
        paciente_id INTEGER REFERENCES pacientes(id),
        medico_id INTEGER REFERENCES medicos(id),
        data_consulta DATE NOT NULL,
        horario TIME NOT NULL,
        tipo_consulta VARCHAR(50) DEFAULT 'PRIMEIRA_VEZ',
        valor NUMERIC(10, 2),
        observacoes TEXT,
        status VARCHAR(50) DEFAULT 'PENDENTE',
        inicio_atendimento TIMESTAMP,
        atualizado_em TIMESTAMP DEFAULT NOW(),
        nps_enviado BOOLEAN DEFAULT FALSE,
        nps_nota INTEGER,
        nps_comentario TEXT,
        prontuario_path VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Tabela "agendamentos" verificada.');

    // 4. Tabela Horarios Medicos
    await db.query(`
      CREATE TABLE IF NOT EXISTS horarios_medicos (
        id SERIAL PRIMARY KEY,
        medico_id INTEGER REFERENCES medicos(id) ON DELETE CASCADE,
        dia_semana INTEGER, -- 0=Domingo, 1=Segunda...
        hora_inicio TIME NOT NULL,
        hora_fim TIME NOT NULL,
        data_especifica DATE,
        duracao_consulta INTEGER DEFAULT 30
      );
    `);
    console.log('✅ Tabela "horarios_medicos" verificada.');

     // 5. Tabela Bloqueios Agenda
    await db.query(`
      CREATE TABLE IF NOT EXISTS bloqueios_agenda (
        id SERIAL PRIMARY KEY,
        medico_id INTEGER REFERENCES medicos(id) ON DELETE CASCADE,
        data_inicio DATE NOT NULL,
        data_fim DATE NOT NULL,
        motivo VARCHAR(255)
      );
    `);
    console.log('✅ Tabela "bloqueios_agenda" verificada.');

    console.log('🏁 Setup do banco de dados concluído com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao configurar banco de dados:', error);
    process.exit(1);
  }
}

setupDatabase();

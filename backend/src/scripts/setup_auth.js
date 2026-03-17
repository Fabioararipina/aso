/**
 * Script de configuração inicial do sistema de autenticação.
 * Executa apenas uma vez para criar a tabela de usuários e o admin padrão.
 *
 * USO: node src/scripts/setup_auth.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const db = require('../config/database');
const bcrypt = require('bcrypt');

async function setup() {
  console.log('🔧 Configurando autenticação...');

  // Cria tabela de usuários
  await db.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id         SERIAL PRIMARY KEY,
      nome       VARCHAR(100) NOT NULL,
      usuario    VARCHAR(50)  UNIQUE NOT NULL,
      senha_hash VARCHAR(255) NOT NULL,
      perfil     VARCHAR(20)  NOT NULL CHECK (perfil IN ('ADMIN', 'RECEPCAO', 'MEDICO', 'TV')),
      medico_id  INTEGER REFERENCES medicos(id) ON DELETE SET NULL,
      ativo      BOOLEAN DEFAULT true,
      criado_em  TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ Tabela "usuarios" criada (ou já existia).');

  // Atualiza a constraint se a tabela já existia sem o perfil 'TV'
  try {
    await db.query(`
      ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_perfil_check;
      ALTER TABLE usuarios ADD CONSTRAINT usuarios_perfil_check
        CHECK (perfil IN ('ADMIN', 'RECEPCAO', 'MEDICO', 'TV'));
    `);
    console.log('✅ Constraint de perfil atualizada (incluindo TV).');
  } catch (err) {
    console.log('ℹ️  Constraint de perfil já está atualizada.');
  }

  // Verifica se já existe um admin
  const existing = await db.query(
    "SELECT id FROM usuarios WHERE perfil = 'ADMIN' AND ativo = true"
  );
  if (existing.rows.length > 0) {
    console.log('ℹ️  Já existe um usuário ADMIN. Nada a criar.');
    process.exit(0);
  }

  // Cria usuário admin padrão
  const senhaHash = await bcrypt.hash('admin123', 10);
  await db.query(
    `INSERT INTO usuarios (nome, usuario, senha_hash, perfil)
     VALUES ($1, $2, $3, $4)`,
    ['Administrador', 'admin', senhaHash, 'ADMIN']
  );

  console.log('');
  console.log('✅ Usuário admin criado com sucesso!');
  console.log('   Login: admin');
  console.log('   Senha: admin123');
  console.log('');
  console.log('⚠️  IMPORTANTE: Troque a senha após o primeiro acesso!');
  console.log('');

  process.exit(0);
}

setup().catch((err) => {
  console.error('❌ Erro ao configurar autenticação:', err.message);
  process.exit(1);
});

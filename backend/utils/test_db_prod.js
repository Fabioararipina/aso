// backend/utils/test_db_prod.js
const { Client } = require('pg');
const path = require('path');
// require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); // Não é necessário, estamos usando os valores diretamente para o teste

// Use os NOVOS valores fornecidos pelo usuário diretamente para este teste
const DB_USER = 'admin_saude';
const DB_HOST = 'localhost'; // IMPORTANTE: Este é 'localhost'. Para produção, este deve ser o endereço IP real do seu servidor DB.
const DB_NAME = 'essencial_saude';
const DB_PASSWORD = 'Essencial2026Strong!'; // Nova senha
const DB_PORT = 5432;

const config = {
    user: DB_USER,
    host: DB_HOST,
    database: DB_NAME,
    password: DB_PASSWORD,
    port: DB_PORT,
};

async function testDbConnection() {
    console.log('Attempting to connect to PostgreSQL database with NEW credentials...');
    console.log('Using config (password omitted for security):');
    console.log(`  User: ${config.user}`);
    console.log(`  Host: ${config.host}`);
    console.log(`  Database: ${config.database}`);
    console.log(`  Port: ${config.port}`);

    // *** IMPORTANTE: DB_HOST está definido como 'localhost'.
    // *** Para um servidor de produção, este provavelmente precisa ser o endereço IP real
    // *** ou hostname do seu servidor de banco de dados PostgreSQL, e não 'localhost'.
    // *** Se o seu banco de dados estiver em uma máquina diferente ou um container Docker,
    // *** 'localhost' se referirá à própria máquina do backend, não ao servidor DB.

    const client = new Client(config);

    try {
        await client.connect();
        console.log('Successfully connected to the database!');
    } catch (err) {
        console.error('Failed to connect to the database:');
        console.error(`  Error message: ${err.message}`);
        console.error(`  Error code: ${err.code}`); // Ex: '28P01' para falha de autenticação de senha
        console.error('Por favor, verifique seu DB_USER, DB_PASSWORD, DB_HOST, DB_PORT e DB_NAME.');
        console.error('Se DB_HOST for "localhost" em um servidor de produção, certifique-se de que o banco de dados está rodando na mesma máquina e está acessível.');
    } finally {
        if (client && client.end) {
            await client.end();
        }
        console.log('Database connection closed.');
    }
}

testDbConnection();
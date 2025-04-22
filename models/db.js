const oracledb = require('oracledb');
oracledb.initOracleClient({ libDir: 'C:\\Users\\AIT\\Documents\\instantclient_21_13\\instantclient_23_7' });  // << ruta on has descomprimit

require('dotenv').config();

// Inicialitza Oracle Client (Thick mode)
try {
  oracledb.initOracleClient({ libDir: 'C:\\Users\\AIT\\Documents\\instantclient_21_13\\instantclient_23_7' });  // <-- Canvia això per la teva ruta
} catch (err) {
  console.error('❌ Error inicialitzant Oracle Client:', err);
}

const connectDB = async () => {
  try {
    const connection = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      connectString: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
    });    

    console.log('✅ Connexió a la base de dades establerta correctament');
    return connection;
  } catch (err) {
    console.error('❌ Error establint la connexió amb la base de dades:', err);
    throw err;  // Propaga l'error perquè es pugui gestionar més amunt
  }
};

module.exports = connectDB;

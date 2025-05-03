const oracledb = require('oracledb');
require('dotenv').config();

// Inicialitza Oracle Client (Thick mode)
try {
  oracledb.initOracleClient({ libDir: process.env.LIB_DIR });
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

const db = require('../models/db');
const oracledb = require('oracledb');
const xlsx = require('xlsx');


const getUsuaris = async (req, res) => {
  let connection;
  try {
    connection = await db();
    const result = await connection.execute(
      `SELECT USUARI AS "usuari", CONTRASENYA AS "contrasenya" FROM ECPU_USUARIS`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // Si no hi ha resultats, retornem un error 404
    if (result.rows.length === 0) {
      return res.status(404).send('No s\'han trobat usuaris');
    }

    // Retornem les dades dels usuaris
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('❌ Error obtenint els usuaris:', error);
    res.status(500).send('❌ Error en obtenir els usuaris');
  } finally {
    if (connection) await connection.close();
  }
};

module.exports = {
    getUsuaris
};

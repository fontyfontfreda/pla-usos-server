const db = require('./db');
const bcrypt = require('bcryptjs');

/**
 * Busca un usuari a la base de dades pel seu nom d'usuari
 * @param {string} username
 * @returns {Promise<object|null>}
 */
const findUserByUsername = async (username) => {
  let connection;
  try {
    connection = await db();
    const result = await connection.execute(
      `SELECT ID, USUARI AS "user", CONTRASENYA AS "password" FROM ECPU_USUARIS WHERE USUARI = :username`,
      [username],
      { outFormat: require('oracledb').OUT_FORMAT_OBJECT }
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('❌ Error buscant l\'usuari:', error);
    throw error;
  } finally {
    if (connection) await connection.close();
  }
};

/**
 * Crea un nou usuari a la base de dades
 * @param {string} username
 * @param {string} password
 * @returns {Promise<object>}
 */
const createUser = async (username, password) => {
  let connection;
  try {
    connection = await db();

    // Generar hash de la contrasenya
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    const result = await connection.execute(
      `INSERT INTO ECPU_USUARIS (USUARI, CONTRASENYA) VALUES (:username, :password) RETURNING ID INTO :id`,
      {
        username,
        password: hashedPassword,
        id: { dir: require('oracledb').BIND_OUT, type: require('oracledb').NUMBER }
      },
      { autoCommit: true }
    );

    return { id: result.outBinds.id[0], username };
  } catch (error) {
    console.error('❌ Error creant l\'usuari:', error);
    throw error;
  } finally {
    if (connection) await connection.close();
  }
};

module.exports = { findUserByUsername, createUser };

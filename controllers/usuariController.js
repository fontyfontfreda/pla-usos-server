const db = require("../models/db");
const oracledb = require("oracledb");
const xlsx = require("xlsx");

const bcrypt = require("bcryptjs");

const getUsuaris = async (req, res) => {
  let connection;
  try {    
    connection = await db();
    const result = await connection.execute(
      `SELECT USUARI AS "usuari", CONTRASENYA AS "contrasenya", ROL as "rol", DESCRIPCIO as "rol_descripcio" FROM 
        ECPU_USUARIS u
        JOIN ECPU_ROL r on r.codi = u.rol
        WHERE ID > 1`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    // Si no hi ha resultats, retornem un error 404
    if (result.rows.length === 0) {
      return res.status(404).send("No s'han trobat usuaris");
    }

    // Retornem les dades dels usuaris
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("❌ Error obtenint els usuaris:", error);
    res.status(500).send("❌ Error en obtenir els usuaris");
  } finally {
    if (connection) await connection.close();
  }
};

const getRols = async (req, res) => {
  let connection;
  try {
    connection = await db();
    const result = await connection.execute(
      `SELECT CODI AS "codi", DESCRIPCIO AS "descripcio" FROM ECPU_ROL WHERE CODI <> 1`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    // Si no hi ha resultats, retornem un error 404
    if (result.rows.length === 0) {
      return res.status(404).send("No s'han trobat rols");
    }

    // Retornem les dades dels rols
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("❌ Error obtenint els rols:", error);
    res.status(500).send("❌ Error en obtenir els rols");
  } finally {
    if (connection) await connection.close();
  }
};

const updateContrasenya = async (req, res) => {
  let connection;
  try {
    if (req.user.rol > 2) {
      return res.status(401).json({ message: 'No disposa de permisos per realitzar aquesta operació.'});
    }

    const { usuari } = req.params;
    const { novaContrasenya } = req.body;

    if (!novaContrasenya) {
      return res.status(400).send("Falta la nova contrasenya.");
    }

    // Encriptar la nova contrasenya
    const hashedPassword = await bcrypt.hash(novaContrasenya, 10);

    connection = await db();
    const result = await connection.execute(
      `UPDATE ECPU_USUARIS SET CONTRASENYA = :contrasenya WHERE USUARI = :usuari`,
      {
        contrasenya: hashedPassword,
        usuari: usuari,
      },
      { autoCommit: true },
    );

    if (result.rowsAffected === 0) {
      return res.status(404).send("Usuari no trobat.");
    }

    res.status(200).send("Contrasenya actualitzada correctament.");
  } catch (error) {
    console.error("❌ Error actualitzant contrasenya:", error);
    res.status(500).send("Error actualitzant la contrasenya.");
  } finally {
    if (connection) await connection.close();
  }
};

const updateRol = async (req, res) => {
  let connection;
  try {
    if (req.user.rol > 2) {
      return res.status(401).json({ message: 'No disposa de permisos per realitzar aquesta operació.'});
    }

    const { usuari } = req.params;
    const { nouRol } = req.body;

    if  (nouRol == 1){
      return res.status(400).send("Bon intent, crac!");
    }

    if (!nouRol) {
      return res.status(400).send("Falta el nou rol.");
    }

    connection = await db();
    const result = await connection.execute(
      `UPDATE ECPU_USUARIS SET ROL = :rol WHERE USUARI = :usuari`,
      {
        rol: nouRol,
        usuari: usuari,
      },
      { autoCommit: true },
    );

    if (result.rowsAffected === 0) {
      return res.status(404).send("Usuari no trobat.");
    }

    res.status(200).send("Rol actualitzat correctament.");
  } catch (error) {
    console.error("❌ Error actualitzant el rol:", error);
    res.status(500).send("Error actualitzant el rol.");
  } finally {
    if (connection) await connection.close();
  }
};

// Esborrar usuari
const deleteUsuari = async (req, res) => {
  let connection;
  try {
    if (req.user.rol > 2) {
      return res.status(401).json({ message: 'No disposa de permisos per realitzar aquesta operació.'});
    }
    const { usuari } = req.params;

    connection = await db();
    const result = await connection.execute(
      `DELETE FROM ECPU_USUARIS WHERE USUARI = :usuari`,
      {
        usuari: usuari,
      },
      { autoCommit: true },
    );

    if (result.rowsAffected === 0) {
      return res.status(404).send("Usuari no trobat.");
    }

    res.status(200).send("Usuari esborrat correctament.");
  } catch (error) {
    console.error("❌ Error esborrant usuari:", error);
    res.status(500).send("Error esborrant l'usuari.");
  } finally {
    if (connection) await connection.close();
  }
};

module.exports = {
  getUsuaris,
  deleteUsuari,
  updateContrasenya,
  getRols,
  updateRol
};

const db = require("../models/db");
const oracledb = require("oracledb");

const getLinkPlaEspecial = async (req, res) => {
  let connection;

  try {
    connection = await db();

    const result = await connection.execute(
      `
      SELECT c.LINK_PLA_ESPECIAL AS "link"
      FROM ecpu_configuracio c
      `,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // Si només esperes un registre
    res.status(200).json(result.rows[0] || null);

  } catch (error) {
    console.error("❌ Error obtenint l'enllaç:", error);
    res.status(500).send("❌ Error en obtenir l'enllaç");
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error tancant la connexió:", err);
      }
    }
  }
};


const updateLinkPlaEspecial = async (req, res) => {
  let connection;
  try {
     if (req.user.rol > 2) {
      return res.status(401).json({ message: 'No disposa de permisos per realitzar aquesta operació.'});
    }
    const { link } = req.body;

    connection = await db();
    
    const result = await connection.execute(
        `UPDATE ecpu_configuracio SET LINK_PLA_ESPECIAL = :link`,
        {
          link: link
        },
        { autoCommit: true }
      );

      if (result.rowsAffected === 0) {
        return res.status(404).send('Enllaç no actualitzat.');
      }

      res.status(200).send('Enllaç actualitzat correctament.');
  } catch (error) {
    console.error('❌ Error actualitzant l\'enllaç:', error);
    res.status(500).send('Error actualitzant l\'enllaç.');
  } finally {
    if (connection) await connection.close();
  }
};

module.exports = {
  getLinkPlaEspecial,
  updateLinkPlaEspecial
};

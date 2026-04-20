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

module.exports = {
  getLinkPlaEspecial,
};

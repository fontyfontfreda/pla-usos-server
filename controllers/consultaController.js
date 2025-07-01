const db = require('../models/db');
const oracledb = require('oracledb');

const getConsultes = async (req, res) => {
    let connection;
    try {
      connection = await db();
  
      const result = await connection.execute(
        `SELECT c.ID AS "id",
          c.DOMCOD AS "DOMCOD",
          c.DNI_INTERESSAT AS  "dni_interessat",
          c.NOM_INTERESSAT AS  "nom_interessat",
          c. ACTUACIO_INTERESSAT AS "actuacio_interessat",
          a.ADRECA AS "adreca",
          c.IS_ALTRES AS "is_altres",
          g.descripcio AS "grup",
          s.descripcio AS "subgrup",
          ac.descripcio AS "activitat",
          c.descripcio_altres AS "descripcio_altres",
          c.is_valid AS "is_valid",
          co.descripcio AS "condicio",
          c.valor_condicio AS "valor_condicio",
          to_char(c.created_at, 'dd-mm-yyyy') AS "data"
          FROM ecpu_consulta c
          LEFT JOIN ecpu_adreca a ON a.DOMCOD = c.DOMCOD
          LEFT JOIN ecpu_grup_activitat g ON g.codi = c.GRUP_ID
          LEFT JOIN ecpu_subgrup_activitat s ON s.id = c.subgrup_id
          LEFT JOIN ecpu_descripcio_activitat ac ON ac.id = c.activitat_id
          LEFT JOIN ecpu_condicio co ON co.id = c.condicio_id
          ORDER BY c.CREATED_AT DESC
          `,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
  
      // Convertim els LOBs a string
      const rows = await Promise.all(result.rows.map(async row => {
        if (row.descripcio_altres && row.descripcio_altres instanceof require('stream').Readable) {
          row.descripcio_altres = await lobToString(row.descripcio_altres);
        }
        return row;
      }));
  
      if (rows.length === 0) {
        return res.status(404).send('No s\'ha trobat cap consulta');
      }
  
      res.status(200).json(rows);
    } catch (error) {
      console.error('❌ Error obtenint les consultes:', error);
      res.status(500).send('❌ Error en obtenir les consultes');
    } finally {
      if (connection) await connection.close();
    }
  };
  
  // Funció per convertir LOB en string
  function lobToString(lob) {
    return new Promise((resolve, reject) => {
      let data = '';
      lob.setEncoding('utf8');
      lob.on('data', chunk => data += chunk);
      lob.on('end', () => resolve(data));
      lob.on('error', err => reject(err));
    });
  }
  


module.exports = {
    getConsultes
};

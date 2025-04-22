const oracledb = require('oracledb');
oracledb.initOracleClient({ libDir: 'C:\\Users\\AIT\\Documents\\instantclient_21_13\\instantclient_23_7' });  // << ruta on has descomprimit
const db = require('../models/db'); // Connecta amb Oracle

const getZones = async (req, res) => {
  let connection;
  try {
    connection = await db();

    const result = await connection.execute(`
      SELECT 
        z.CODI AS codi_zona,
        z.DESCRIPCIO AS descripcio_zona,
        (SELECT ez.CODI || '.' || ea.CODI 
         FROM ECPU_AREA_TRACTAMENT ea 
         JOIN ECPU_ZONA ez ON ez.ID = ea.ID_ZONA 
         WHERE ea.ID = a.ID) AS codi_area,
        a.DESCRIPCIO AS descripcio_area
      FROM 
        ECPU_ZONA z
      LEFT JOIN 
        ECPU_AREA_TRACTAMENT a ON z.ID = a.ID_ZONA
      ORDER BY z.ID
    `, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });

    const rows = result.rows;

    if (!rows || rows.length === 0) {
      return res.status(404).send('No s\'han trobat zones ni àrees');
    }

    const agrupat = [];
    rows.forEach(row => {
      let zona = agrupat.find(z => z.codi_zona === row.CODI_ZONA);

      if (!zona) {
        zona = {
          codi_zona: row.CODI_ZONA,
          descripcio_zona: row.DESCRIPCIO_ZONA,
          arees: []
        };
        agrupat.push(zona);
      }

      if (row.CODI_AREA && row.DESCRIPCIO_AREA) {
        zona.arees.push({
          codi_area: row.CODI_AREA,
          descripcio_area: row.DESCRIPCIO_AREA
        });
      }
    });

    res.status(200).json(agrupat);

  } catch (error) {
    console.error('❌ Error obtenint les zones/àrees:', error);
    res.status(500).send('❌ Error en obtenir les zones/àrees');
  } finally {
    if (connection) await connection.close();
  }
};

const createZona = async (req, res) => {
  let connection;
  try {
    const zona  = req.body.zona;

    if (!zona) {
      return res.status(400).send('Falten dades: zona');
    }

    connection = await db();

    const result = await connection.execute(
      `INSERT INTO ECPU_ZONA (CODI, DESCRIPCIO) VALUES (:codi, :descripcio)`,
      {
        codi: zona.codi_zona,
        descripcio: zona.descripcio_zona
      },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).send('No s\'ha pogut crear la zona');
    }

    res.status(200).send('Zona creada correctament');
  } catch (error) {
    console.error('❌ Error creant la zona:', error);
    res.status(500).send('Error al crear la zona');
  } finally {
    if (connection) await connection.close();
  }
};

const createArea = async (req, res) => {
  let connection;
  try {
    const area  = req.body.area;

    if (!area) {
      return res.status(400).send('Falten dades: area');
    }

    connection = await db();

    const zonaCodi = +area.codi_area.split(".")[0];
    const areaCodi = +area.codi_area.split(".")[1];

    const zonaResult = await connection.execute(
      `SELECT id FROM ECPU_ZONA WHERE CODI = :codi`,
      { codi: zonaCodi },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (zonaResult.rows.length === 0) {
      return res.status(404).send('No s\'ha trobat la zona');
    }

    const zonaId = zonaResult.rows[0].ID;

    const insertResult = await connection.execute(
      `INSERT INTO ECPU_AREA_TRACTAMENT (ID_ZONA, CODI, DESCRIPCIO) VALUES (:id_zona, :codi, :descripcio)`,
      {
        id_zona: zonaId,
        codi: areaCodi,
        descripcio: area.descripcio_area
      },
      { autoCommit: true }
    );

    if (insertResult.rowsAffected === 0) {
      return res.status(404).send('No s\'ha pogut crear l\'àrea');
    }

    res.status(200).send('Àrea creada correctament');
  } catch (error) {
    console.error('❌ Error creant l\'àrea:', error);
    res.status(500).send('Error al crear l\'àrea');
  } finally {
    if (connection) await connection.close();
  }
};

const deleteZona = async (req, res) => {
  let connection;
  try {
    const { codi_zona } = req.body;

    if (!codi_zona) {
      return res.status(400).send('Falten dades: codi_zona');
    }

    if (isNaN(codi_zona)) {
      return res.status(400).send('El codi ha de ser numèric');
    }

    connection = await db();

    const result = await connection.execute(
      `DELETE FROM ECPU_ZONA WHERE codi = :codi`,
      { codi: codi_zona },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).send('No s\'ha trobat la zona especificada');
    }

    res.status(200).send('Zona eliminada correctament');
  } catch (error) {
    console.error('❌ Error eliminant la zona:', error);
    if (error.errorNum === 2292) { // Oracle FK constraint violation
      res.status(500).send('No s\'ha pogut eliminar, hi han activitats amb condicions o àrees relacionades amb aquesta zona');
    } else {
      res.status(500).send('Error en eliminar la zona');
    }
  } finally {
    if (connection) await connection.close();
  }
};

const deleteArea = async (req, res) => {
  let connection;
  try {
    const { codi_area } = req.body;

    if (!codi_area || typeof codi_area !== 'string' || !codi_area.includes('.')) {
      return res.status(400).send('Format incorrecte. Ha de ser "codi_zona.codi_area"');
    }

    const [codiZona, codiArea] = codi_area.split('.');

    if (!codiZona || !codiArea) {
      return res.status(400).send('Falten dades: codi_zona o codi_area');
    }

    const zona = parseInt(codiZona, 10);
    const area = parseInt(codiArea, 10);

    if (isNaN(zona) || isNaN(area)) {
      return res.status(400).send('Els codis han de ser numèrics');
    }

    connection = await db();

    const zonaResult = await connection.execute(
      `SELECT ID FROM ECPU_ZONA WHERE CODI = :codi`,
      { codi: zona },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (zonaResult.rows.length === 0) {
      return res.status(404).send('No s\'ha trobat la zona');
    }

    const zonaId = zonaResult.rows[0].ID;

    const deleteResult = await connection.execute(
      `DELETE FROM ECPU_AREA_TRACTAMENT WHERE CODI = :codi AND ID_ZONA = :id_zona`,
      { codi: area, id_zona: zonaId },
      { autoCommit: true }
    );

    if (deleteResult.rowsAffected === 0) {
      return res.status(404).send('No s\'ha trobat l\'àrea o la zona especificada');
    }

    res.status(200).send('Àrea eliminada correctament');
  } catch (error) {
    console.error('❌ Error eliminant l\'àrea:', error);
    if (error.errorNum === 2292) {
      res.status(500).send('No s\'ha pogut eliminar, hi han activitats amb condicions relacionades amb aquesta àrea');
    } else {
      res.status(500).send('Error en eliminar l\'àrea');
    }
  } finally {
    if (connection) await connection.close();
  }
};

module.exports = {
  getZones,
  createZona,
  createArea,
  deleteZona,
  deleteArea
};

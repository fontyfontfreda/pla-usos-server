const db = require('../models/db');
const oracledb = require('oracledb');
const xlsx = require('xlsx');

const processCondicionsUpload = async (req, res) => {
  let connection;
  try {
    if (!req.file) {
      return res.status(400).send('No s\'ha proporcionat cap fitxer');
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    connection = await db();

    let zonaActCondId = 1;
    let areaActCondId = 1;

    for (const [i, row] of data.entries()) {
      if (i === 0) continue; // Salta la fila de capçaleres

      const EPIGRAF_PEU = row[0]?.toString().trim();
      const Z1 = row[1]?.toString().trim();
      const A11 = row[2]?.toString().trim();
      const A12 = row[3]?.toString().trim();
      const A13 = row[4]?.toString().trim();
      const A14 = row[5]?.toString().trim();
      const A15 = row[6]?.toString().trim();
      const A16 = row[7]?.toString().trim();
      const Z2 = row[8]?.toString().trim();
      const A21 = row[9]?.toString().trim();
      const Z3 = row[10]?.toString().trim();
      const Z4 = row[11]?.toString().trim();

      if (!EPIGRAF_PEU || !Z1 || !A11 || !A12 || !A13 || !A14 || !A15 || !A16 || !Z2 || !A21 || !Z3 || !Z4) continue;

      const [CODI1, CODI2, CODI3] = EPIGRAF_PEU.split('.');

      // Busca ID de l'epígraf
      const epigrafResult = await connection.execute(
        `SELECT ID FROM ECPU_EPIGRAF 
         WHERE CODI1 = :c1 AND CODI2 = :c2 AND CODI3 = :c3`,
        { c1: CODI1, c2: CODI2, c3: CODI3 },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const ID_EPIGRAF = epigrafResult.rows[0]?.ID;
      if (!ID_EPIGRAF) continue;

      //-------------ZONES-------------
      const zones = [Z1, Z2, Z3, Z4];

      for (let i = 0; i < zones.length; i++) {
        const zona = zones[i];
        if (!zona) continue;

        const condicions = zona.split(' - ');

        for (const condicio of condicions) {
          let condicioID = null;
          let valor = null;

          const regex = /^(\d+)(?:\((\d+)\))?$/;
          const match = condicio.trim().match(regex);

          if (match) {
            condicioID = parseInt(match[1], 10);
            valor = match[2] ? parseInt(match[2], 10) : null;
          } else {
            console.error(`⚠️ Format de condició no vàlid: '${condicio}'`);
            continue;
          }

          try {
            await connection.execute(
              `INSERT INTO ECPU_ZONA_ACTIVITAT_CONDICIO_TEST (ID, ZONA_ID, EPIGRAF_ID, CONDICIO_ID, VALOR)
         VALUES (:id, :zona, :epigraf, :condicio, :valor)`,
              {
                id: zonaActCondId,
                zona: i + 1,
                epigraf: ID_EPIGRAF,
                condicio: condicioID,
                valor: valor
              }
            );
            zonaActCondId++;
          } catch (e) {
            console.error("❌ Error a l'INSERT:", e);
          }
        }
      }

      //-------------ÀREES-------------
      const arees = [A11, A12, A13, A14, A15, A16, A21];

      for (let i = 0; i < arees.length; i++) {
        const area = arees[i];
        if (!area) continue;

        const condicions = area.split(' - ');

        for (const condicio of condicions) {
          let condicioID = null;
          let valor = null;

          const regex = /^(\d+)(?:\((\d+)\))?$/;
          const match = condicio.trim().match(regex);

          if (match) {
            condicioID = parseInt(match[1], 10);
            valor = match[2] ? parseInt(match[2], 10) : null;
          } else {
            console.error(`⚠️ Format de condició no vàlid: '${condicio}'`);
            continue;
          }

          try {
            await connection.execute(
              `INSERT INTO ECPU_AREA_ACTIVITAT_CONDICIO_TEST (ID, AREA_ID, EPIGRAF_ID, CONDICIO_ID, VALOR)
         VALUES (:id, :area, :epigraf, :condicio, :valor)`,
              {
                id: areaActCondId,
                area: i + 1,
                epigraf: ID_EPIGRAF,
                condicio: condicioID,
                valor: valor
              }
            );
            areaActCondId++;
          } catch (e) {
            console.error("❌ Error a l'INSERT:", e);
          }
        }
      }

    }
    await connection.commit();
    res.send('✅ Dades de condicions importades correctament');
  } catch (error) {
    console.error('❌ Error processant l\'Excel de condicions:', error);
    res.status(500).send('❌ Error en processar el fitxer');
  } finally {
    if (connection) await connection.close();
  }
};

const processEpigrafUpload = async (req, res) => {
  let connection;
  try {
    if (!req.file) {
      return res.status(400).send('No s\'ha proporcionat cap fitxer');
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    const created_at = '05/07/25 12:10:54,914931000'

    connection = await db();

    for (const [i, row] of data.entries()) {
      if (i === 0) continue; // Salta la fila de capçaleres

      const GRUP = row[0]?.toString().trim();
      const SUBGRUP = row[1]?.toString().trim();
      const DESCRIPCIO = row[2]?.toString().trim();
      const EPIGRAF_PEU = row[3]?.toString().trim();

      if (!GRUP || !SUBGRUP || !DESCRIPCIO || !EPIGRAF_PEU) continue;

      const [CODI1, CODI2, CODI3] = EPIGRAF_PEU.split('.');

      // Busca ID de l'epígraf
      const epigrafResult = await connection.execute(
        `SELECT ID FROM ECPU_EPIGRAF 
         WHERE CODI1 = :c1 AND CODI2 = :c2 AND CODI3 = :c3`,
        { c1: CODI1, c2: CODI2, c3: CODI3 },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const ID_EPIGRAF = epigrafResult.rows[0]?.ID;
      if (!ID_EPIGRAF) continue;

      // ============ GRUP ============
      let codiGrup;

      const grupResult = await connection.execute(
        `SELECT CODI FROM ECPU_GRUP_ACTIVITAT_TEST WHERE DESCRIPCIO = :descripcio`,
        { descripcio: GRUP },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (grupResult.rows.length > 0) {
        codiGrup = grupResult.rows[0].CODI;
      } else {
        const nextCodiResult = await connection.execute(
          `SELECT NVL(MAX(CODI), 0) + 1 AS NEXT_CODI FROM ECPU_GRUP_ACTIVITAT_TEST`,
          {},
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        codiGrup = nextCodiResult.rows[0].NEXT_CODI;

        await connection.execute(
          `INSERT INTO ECPU_GRUP_ACTIVITAT_TEST (CODI, DESCRIPCIO, CREATED_AT)
           VALUES (:codi, :descripcio, :created_at)`,
          { codi: codiGrup, descripcio: GRUP, created_at: created_at }
        );
      }

      // ============ SUBGRUP ============
      let idSubgrup;

      const subgrupResult = await connection.execute(
        `SELECT ID FROM ECPU_SUBGRUP_ACTIVITAT_TEST 
         WHERE DESCRIPCIO = :descripcio AND CODI = :codi`,
        { descripcio: SUBGRUP, codi: CODI2 },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (subgrupResult.rows.length > 0) {
        idSubgrup = subgrupResult.rows[0].ID;
      } else {
        const nextIdSubgrupResult = await connection.execute(
          `SELECT NVL(MAX(ID), 0) + 1 AS NEXT_ID FROM ECPU_SUBGRUP_ACTIVITAT_TEST`,
          {},
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        idSubgrup = nextIdSubgrupResult.rows[0].NEXT_ID;

        await connection.execute(
          `INSERT INTO ECPU_SUBGRUP_ACTIVITAT_TEST (ID, CODI, DESCRIPCIO, CODI_GRUP_ACTIVITAT, CREATED_AT)
           VALUES (:id, :codi, :descripcio, :grup, :created_at)`,
          { id: idSubgrup, codi: CODI2, descripcio: SUBGRUP, grup: codiGrup, created_at: created_at }
        );
      }

      // ============ DESCRIPCIO ============
      let idDescripcio;

      const nextIdDescripcioResult = await connection.execute(
        `SELECT NVL(MAX(ID), 0) + 1 AS NEXT_ID FROM ECPU_DESCRIPCIO_ACTIVITAT_TEST`,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      idDescripcio = nextIdDescripcioResult.rows[0].NEXT_ID;

      await connection.execute(
        `INSERT INTO ECPU_DESCRIPCIO_ACTIVITAT_TEST 
          (ID, ID_SUBGRUP_ACTIVITAT, CODI, DESCRIPCIO, ID_EPIGRAF, CREATED_AT)
          VALUES (:id, :subgrup, :codi, :descripcio, :epigraf, :created_at)`,
        {
          id: idDescripcio,
          subgrup: idSubgrup,
          codi: CODI3,
          descripcio: DESCRIPCIO,
          epigraf: ID_EPIGRAF,
          created_at: created_at
        }
      );

    }

    await connection.commit();
    res.send('✅ Dades d\'epígrafs importades correctament');
  } catch (error) {
    console.error('❌ Error processant l\'Excel d\'epígrafs:', error);
    res.status(500).send('❌ Error en processar el fitxer');
  } finally {
    if (connection) await connection.close();
  }
};

const getEpigrafs = async (req, res) => {
  let connection;
  try {
    connection = await db();

    const epigrafs = await connection.execute(
      `SELECT ID as "id", CODI1 as "codi1", CODI2 as "codi2", CODI3 as "codi3", DESCRIPCIO as "descripcio", MOSTRAR as "mostrar"
       FROM ecpu_epigraf
       ORDER BY CODI1, CODI2, CODI3`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (epigrafs.rows.length === 0) {
      return res.status(404).send('No s\'ha trobat cap epigraf');
    }

    res.status(200).json(epigrafs.rows);
  } catch (error) {
    console.error('❌ Error obtenint els epigrafs:', error);
    res.status(500).send('❌ Error en obtenir els epigrafs');
  } finally {
    if (connection) await connection.close();
  }
};

const getEpigraf = async (req, res) => {
  let connection;
  try {
    connection = await db();

    const epigraf = req.params.id;

    if (!epigraf) {
      console.error('❌ Falta el paràmetre id:', error);
      res.status(400).send('❌ Falta el paràmetre id');
    } else {
      const resultEpigraf = await connection.execute(
        `SELECT *
            FROM ecpu_epigraf
            WHERE id = :epigraf`,
        {
          epigraf: epigraf
        },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const result = await connection.execute(
        `SELECT
              aac.id,
              0 AS is_zona,
              z.codi || '.' || at.codi AS codi, 
              aac.condicio_id,
              c.descripcio AS condicio, 
              aac.valor
          FROM ecpu_area_activitat_condicio_test aac
          JOIN ecpu_epigraf e ON e.id = aac.epigraf_id
          JOIN ecpu_area_tractament at ON at.id = aac.area_id
          JOIN ecpu_zona z ON at.id_zona = z.id
          JOIN ecpu_condicio c ON c.id = aac.condicio_id
          WHERE e.id = :epigraf
          UNION
          SELECT
              zac.id,
              1 AS is_zona,
              TO_CHAR(z.codi) AS codi,
              zac.condicio_id,
              c.descripcio AS condicio, 
              zac.valor
          FROM ecpu_zona_activitat_condicio_test zac
          JOIN ecpu_epigraf e ON e.id = zac.epigraf_id
          JOIN ecpu_zona z ON zac.zona_id = z.id
          JOIN ecpu_condicio c ON c.id = zac.condicio_id
          WHERE e.id = :epigraf
          ORDER BY codi`,
        {
          epigraf: epigraf
        },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const epigrafData = resultEpigraf.rows[0];

      if (!epigrafData) {
        return res.status(404).send("No s'ha trobat l'epígraf");
      }

      const condicions = result.rows;

      const resposta = {
        ...epigrafData,
        condicions
      };

      res.status(200).json(resposta);
    }
  } catch (error) {
    console.error('❌ Error obtenint les dades:', error);
    res.status(500).send('Error obtenint les dades');
  } finally {
    if (connection) await connection.close();
  }
};

const createEpigraf = async (req, res) => {
  let connection;
  try {
    connection = await db();

    const { dades } = req.body;
    const condicions = dades.CONDICIONS;

    const { faltenDades, camp } = controlParametres(dades);

    if (faltenDades)
      return res.status(404).send('Hi ha un problema amb el camp ' + camp);

    const epigrafResult = await connection.execute(
      `SELECT ID FROM ECPU_EPIGRAF 
         WHERE CODI1 = :c1 AND CODI2 = :c2 AND CODI3 = :c3`,
      { c1: dades.codi1, c2: dades.codi2, c3: dades.codi3 },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const ID_EPIGRAF = epigrafResult.rows[0]?.ID;
    if (ID_EPIGRAF)
      return res.status(404).send('Ja hi ha un epígraf amb aquest codi');

    //INSERT DE L'EPÍGRAF
    const result = await connection.execute(
      `INSERT INTO ECPU_EPIGRAF (CODI1, CODI2, CODI3, DESCRIPCIO, MOSTRAR) 
       VALUES (:c1, :c2 , :c3, :descripcio, :mostrar) RETURNING ID INTO :id`,
      {
        c1: dades.codi1, c2: dades.codi2, c3: dades.codi3, descripcio: dades.descripcio, mostrar: dades.mostrar ? 1 : 0,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      }
    );

    const EPIGRAF_ID = result.outBinds.id[0];

    //ISNSERT DE LES CONDICIONS
    for (const condicio of condicions) {
      let id;
      if (condicio.IS_ZONA == 1) {
        const nextCodiResultZona = await connection.execute(
          `SELECT NVL(MAX(ID), 0) + 1 AS NEXT_CODI FROM ecpu_zona_activitat_condicio_TEST`,
          {},
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        id = nextCodiResultZona.rows[0].NEXT_CODI;

        await connection.execute(
          `INSERT INTO ecpu_zona_activitat_condicio_TEST (
              ID, ZONA_ID, EPIGRAF_ID, CONDICIO_ID, VALOR) 
              VALUES (:id, :zona_id, :idEpigraf, :id_condicio, :valor
            )`,
          {
            id: id,
            zona_id: condicio.ID_ZONA,
            idEpigraf: EPIGRAF_ID,
            id_condicio: condicio.CONDICIO_ID,
            valor: condicio.VALOR == null ? condicio.VALOR : +condicio.VALOR
          }
        );

      } else {
        const nextCodiResultArea = await connection.execute(
          `SELECT NVL(MAX(ID), 0) + 1 AS NEXT_CODI FROM ecpu_area_activitat_condicio_TEST`,
          {},
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        id = nextCodiResultArea.rows[0].NEXT_CODI;

        await connection.execute(
          `INSERT INTO ecpu_area_activitat_condicio_TEST 
           (ID, AREA_ID, EPIGRAF_ID, CONDICIO_ID, VALOR) 
           VALUES (:id, :area_id, :idEpigraf, :id_condicio, :valor)`,
          {
            id: id,
            area_id: condicio.ID_ZONA,
            idEpigraf: EPIGRAF_ID,
            id_condicio: +condicio.CONDICIO_ID,
            valor: condicio.VALOR == null ? condicio.VALOR : +condicio.VALOR
          }
        );
      }
    }

    await connection.commit(); // Fa el commit només un cop al final

    res.status(200).send('Epígraf creat correctament.');

  } catch (error) {
    console.error('❌ Error creant l\'epígraf:', error);
    res.status(500).send('Error creant l\'epígraf.');
  } finally {
    if (connection) await connection.close();
  }

  function controlParametres(dades) {
    let faltenDades = false;
    let camp = "";
    if (dades.codi1 == '' || dades.codi2 == '' || dades.codi3 == '') {
      faltenDades = true;
      camp = "codi";
      return { faltenDades, camp };
    }

    if (dades.descripcio == '') {
      faltenDades = true;
      camp = "descripcio";
      return { faltenDades, camp };
    }

    dades.CONDICIONS.forEach(condicio => {
      if (condicio.CONDICIO_ID = null) {
        faltenDades = true;
        camp = "Condicio" + condicio.CODI;
        return { faltenDades, camp };
      }
    });
  }
};

const updateCondicio = async (req, res) => {
  let connection;
  try {
    const { condicio } = req.body;

    connection = await db();

    if (condicio.IS_ZONA) {
      const result = await connection.execute(
        `UPDATE ecpu_zona_activitat_condicio_test SET CONDICIO_ID = :condicio_id, VALOR = :valor WHERE ID = :id`,
        {
          condicio_id: condicio.CONDICIO_ID,
          valor: condicio.VALOR,
          id: condicio.ID
        },
        { autoCommit: true }
      );

      if (result.rowsAffected === 0) {
        return res.status(404).send('Condició no trobada.');
      }

      res.status(200).send('Condició actualitzada correctament.');
    } else {
      const result = await connection.execute(
        `UPDATE ecpu_area_activitat_condicio_test SET CONDICIO_ID = :condicio_id, VALOR = :valor WHERE ID = :id`,
        {
          condicio_id: condicio.CONDICIO_ID,
          valor: condicio.VALOR,
          id: condicio.ID
        },
        { autoCommit: true }
      );

      if (result.rowsAffected === 0) {
        return res.status(404).send('Condició no trobada.');
      }

      res.status(200).send('Condició actualitzada correctament.');
    }
  } catch (error) {
    console.error('❌ Error actualitzant la condició:', error);
    res.status(500).send('Error actualitzant la condició.');
  } finally {
    if (connection) await connection.close();
  }
};

const updateEpigraf = async (req, res) => {
  let connection;
  try {
    const { epigraf } = req.body;

    connection = await db();

    const result = await connection.execute(
      `UPDATE ecpu_epigraf SET DESCRIPCIO = :descripcio, MOSTRAR = :mostar WHERE ID = :id`,
      {
        descripcio: epigraf.descripcio,
        mostar: epigraf.mostrar ? 1 : 0,
        id: epigraf.id
      },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).send('Epígraf no trobat.');
    }

    res.status(200).send('Epígraf actualitzat correctament.');
  } catch (error) {
    console.error('❌ Error actualitzant l\'epígraf:', error);
    res.status(500).send('Error actualitzant l\'epígraf.');
  } finally {
    if (connection) await connection.close();
  }
};

module.exports = {
  processCondicionsUpload,
  processEpigrafUpload,
  getEpigrafs,
  getEpigraf,
  createEpigraf,
  updateCondicio,
  updateEpigraf
};
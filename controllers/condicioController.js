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


module.exports = {
  processCondicionsUpload,
  processEpigrafUpload,
  getEpigrafs
};
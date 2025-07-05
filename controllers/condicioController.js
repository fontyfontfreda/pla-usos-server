const db = require('../models/db');
const oracledb = require('oracledb');
const xlsx = require('xlsx');

const processUpload = async (req, res) => {
  let connection;
  try {
    if (!req.file) {
      return res.status(400).send('No s\'ha proporcionat cap fitxer');
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    connection = await db();

    for (const row of data) {
      if (!row || row.length < 4 || !row[0]) continue; 

      const codiParts = row[0].toString().split('.');

      let idDescripcioActivitat = null;

      const result = await connection.execute(
        `SELECT da.id 
         FROM ecpu_grup_activitat ga
         JOIN ecpu_subgrup_activitat sa ON ga.codi = sa.codi_grup_activitat
         JOIN ecpu_descripcio_activitat da ON sa.id = da.id_subgrup_activitat
         WHERE ga.codi = :grupCodi AND sa.codi = :subgrupCodi AND da.codi = :descripcioCodi`,
        {
          grupCodi: codiParts[0],
          subgrupCodi: codiParts[1],
          descripcioCodi: codiParts[2]
        },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      idDescripcioActivitat = result.rows[0]?.ID;

      if (idDescripcioActivitat) {
        for (let index = 2; index <= 12; index++) {
          const condicions = row[index].toString().split('-');
          for (const condicio of condicions) {
            let condicioId = condicio.replace(/\s+/g, "");
            let valor = "";
            
            if (condicioId.length > 3) {
              const match = condicioId.match(/(\d+)\((\d+)\)/);
              if (match) {
                condicioId = match[1];
                valor = match[2];
              }
            }

            const zones = {
              2: 1,
              9: 2,
              11: 3,
              12: 4
            };

            const arees = {
              3: 1,
              4: 2,
              5: 3,
              6: 4,
              7: 5,
              8: 6,
              10: 7
            };

            if (index == 2 || index == 9 || index == 11 || index == 12) {
              await connection.execute(
                `INSERT INTO ecpu_zona_activitat_condicio (zona_id, descripcio_activitat_id, condicio_id, valor)
                 VALUES (:zona_id, :descripcio_activitat_id, :condicio_id, :valor)`,
                {
                  zona_id: zones[index],
                  descripcio_activitat_id: idDescripcioActivitat,
                  condicio_id: condicioId,
                  valor: valor || null
                },
                { autoCommit: true }
              );
            } else {
              await connection.execute(
                `INSERT INTO ecpu_area_activitat_condicio (area_id, descripcio_activitat_id, condicio_id, valor)
                 VALUES (:area_id, :descripcio_activitat_id, :condicio_id, :valor)`,
                {
                  area_id: arees[index],
                  descripcio_activitat_id: idDescripcioActivitat,
                  condicio_id: condicioId,
                  valor: valor || null
                },
                { autoCommit: true }
              );
            }
          }
        }
      }
    }
    res.send('✅ Dades importades correctament');
  } catch (error) {
    console.error('❌ Error processant l\'Excel:', error);
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



module.exports = {
  processUpload,
  processEpigrafUpload
};
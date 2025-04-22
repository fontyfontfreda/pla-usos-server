const db = require('../models/db');
const oracledb = require('oracledb');
oracledb.initOracleClient({ libDir: 'C:\\Users\\AIT\\Documents\\instantclient_21_13\\instantclient_23_7' });  // << ruta on has descomprimit
const xlsx = require('xlsx');

const uploadAdreces = async (req, res) => {
  let connection;
  try {
    if (!req.file) {
      return res.status(400).send('No s\'ha proporcionat cap fitxer');
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    connection = await db();

    for (const row of data) {
      const idTipusCarrer = (
        await connection.execute(
          'SELECT id FROM ecpu_tipus_carrer WHERE avrebiatura = :abreviatura',
          [row['ADRECA'].split(" ")[0]]
        )
      ).rows[0]?.ID;

      if (idTipusCarrer) {
        const idZona = (
          await connection.execute(
            'SELECT id FROM ecpu_zona WHERE codi = :codi',
            [row['REF_ZONA'].split("-")[1]]
          )
        ).rows[0]?.ID;

        if (idZona) {
          let idArea = null;
          if (row['REF_ATE'] != undefined) {
            idArea = (
              await connection.execute(
                'SELECT id FROM ecpu_area_tractament WHERE codi = :codi AND id_zona = :idZona',
                [row['REF_ATE'].split(".")[1], idZona]
              )
            ).rows[0]?.ID;

            if (!idArea) {
              return res.status(404).send('No s\'ha pogut identificar l\'àrea de tractament del domicili ' + row['DOMCOD']);
            }
          }

          await connection.execute(
            `INSERT INTO ecpu_adreca 
              (DOMCOD, carrer, numero, bis, pis, porta, tipus_dom, tipus_loc, tipus_carrer_id, zona_id, area_tractament_id, coord_x, coord_y, amplada_carrer, codi_carrer, nucli_cod) 
              VALUES (:DOMCOD, :carrer, :numero, :bis, :pis, :porta, :tipus_dom, :tipus_loc, :tipus_carrer_id, :zona_id, :area_tractament_id, :coord_x, :coord_y, :amplada_carrer, :codi_carrer, :nucli_cod)`,
            {
              DOMCOD: row['DOMCOD'],
              carrer: row['CARDESC'],
              numero: row['DOMNUM'],
              bis: row['DOMBIS'],
              pis: row['DOMPIS'],
              porta: row['DOMPTA'],
              tipus_dom: row['TDOM'],
              tipus_loc: row['TLOC'],
              tipus_carrer_id: idTipusCarrer,
              zona_id: idZona,
              area_tractament_id: idArea,
              coord_x: row['Coord_X'],
              coord_y: row['Coord_Y'],
              amplada_carrer: row['AMPLE_CARRER'],
              codi_carrer: row['CODICAR'],
              nucli_cod: row['NUCLICOD']
            },
            { autoCommit: true }
          );
        } else {
          return res.status(404).send('No s\'ha pogut identificar la zona del domicili ' + row['DOMCOD']);
        }
      } else {
        return res.status(404).send('No s\'ha pogut identificar el tipus de carrer del domicili ' + row['DOMCOD']);
      }
    }
    res.send('✅ Dades carregades correctament');
  } catch (error) {
    console.error('❌ Error processant l\'Excel:', error);
    res.status(500).send('❌ Error en processar el fitxer');
  } finally {
    if (connection) await connection.close();
  }
};

const getAdreces = async (req, res) => {
  let connection;
  try {
    connection = await db();
    const result = await connection.execute(
      `SELECT DOMCOD, 
        tc.descripcio || ' ' || a.carrer || ' Núm. ' || a.numero || 
        CASE WHEN a.pis IS NOT NULL THEN ' Pis ' || a.pis ELSE '' END || 
        CASE WHEN a.porta IS NOT NULL THEN ' Pta. ' || a.porta ELSE '' END AS "adreca",
        a.nucli_cod AS "nucli_cod", a.codi_carrer AS "codi_carrer", a.carrer AS "carrer", a.numero AS "numero", a.bis AS "bis", a.pis AS "pis", a.porta AS "porta", 
        a.tipus_dom AS "tipus_dom", a.tipus_loc AS "tipus_loc", a.amplada_carrer AS "amplada_carrer", a.coord_x AS "coord_x", a.coord_y AS "coord_y", a.zona_id AS "zona_id", 
        'ZR-' || z.codi AS "codi_zona", 
        a.area_tractament_id AS "area_tractament_id", 
        CASE WHEN at.codi IS NOT NULL THEN 'ATE ' || z.codi || '.' || at.codi ELSE NULL END AS "codi_area", 
        a.tipus_carrer_id AS "tipus_carrer_id", a.imatge AS "imatge" 
      FROM ecpu_adreca a 
      JOIN ecpu_tipus_carrer tc ON a.tipus_carrer_id = tc.id 
      JOIN ecpu_zona z ON a.zona_id = z.id 
      LEFT JOIN ecpu_area_tractament at ON a.area_tractament_id = at.id`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // Si no hi ha resultats, retornem un error 404
    if (result.rows.length === 0) {
      return res.status(404).send('No s\'han trobat adreces');
    }

    // Retornem les dades de les adreces
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('❌ Error obtenint les adreces:', error);
    res.status(500).send('❌ Error en obtenir les adreces');
  } finally {
    if (connection) await connection.close();
  }
};

module.exports = {
  getAdreces,
  uploadAdreces
};

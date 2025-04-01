const db = require('../models/db');
const xlsx = require('xlsx');

const uploadAdreces = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No s\'ha proporcionat cap fitxer');
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    for (const row of data) {
      idTipusCarrer = (
        await db.promise().query(
          'SELECT id FROM ecpu_tipus_carrer WHERE avrebiatura = ?',
          [row['ADRECA'].split(" ")[0]]
        )
      )[0][0]?.id;

      if (idTipusCarrer) {
        idZona = (
          await db.promise().query(
            'SELECT id FROM ecpu_zona WHERE codi = ?',
            [row['REF_ZONA'].split("-")[1]]
          )
        )[0][0]?.id;

        if (idZona) {
          idArea = null;
          if (row['REF_ATE'] != undefined) {
            idArea = (
              await db.promise().query(
                'SELECT id FROM ecpu_area_tractament WHERE codi = ? AND id_zona = ?',
                [row['REF_ATE'].split(".")[1], idZona]
              )
            )[0][0]?.id;
            if (!idArea) {
              return res.status(404).send('No s\'ha pogut identificar l\'àrea de tractament del domicili' + row['DOMCOD']);
            }
          }

          await db.promise().query(
            'INSERT INTO ecpu_adreca (DOMCOD, carrer, numero, bis, pis, porta, tipus_dom, tipus_loc, tipus_carrer_id, zona_id, area_tractament_id, coord_x, coord_y, amplada_carrer, codi_carrer, nucli_cod) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [row['DOMCOD'], row['CARDESC'], row['DOMNUM'], row['DOMBIS'], row['DOMPIS'], row['DOMPTA'], row['TDOM'], row['TLOC'], idTipusCarrer, idZona, idArea, row['Coord_X'], row['Coord_Y'], row['AMPLE_CARRER'], row['CODICAR'], row['NUCLICOD']]
          );
        } else {
          return res.status(404).send('No s\'ha pogut identificar la zona del domicili' + row['DOMCOD']);
        }
      } else {
        return res.status(404).send('No s\'ha pogut identificar el tipus de carrer del domicili' + row['DOMCOD']);
      }
    }
    res.send('✅ Dades carregades correctament');
  } catch (error) {
    console.error('❌ Error processant l\'Excel:', error);
    res.status(500).send('❌ Error en processar el fitxer');
  }
};

const getAdreces = async (req, res) => {
  try {
    // Consulta per obtenir totes les adreces
    const [rows] = await db.promise().query('SELECT * FROM ecpu_adreca');

    // Si no hi ha resultats, retornem un error 404
    if (rows.length === 0) {
      return res.status(404).send('No s\'han trobat adreces');
    }

    // Retornem les dades de les adreces
    res.status(200).json(rows);
  } catch (error) {
    console.error('❌ Error obtenint les adreces:', error);
    res.status(500).send('❌ Error en obtenir les adreces');
  }
};

module.exports = {
  getAdreces, uploadAdreces
};

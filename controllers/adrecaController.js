const db = require('../models/db');
const oracledb = require('oracledb');
const xlsx = require('xlsx');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const imatgeBasePath = path.resolve(process.env.IMATGE_RUTA || '.');
const imatgeBaseUrl = process.env.IMATGE_RUTA_SERVIDOR;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.IMATGE_RUTA); // carpeta on es desen les imatges
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname.replace(/\s/g, '');
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 } // Limit de mida de 20 MB per fitxer
});

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

function trobarImatge(nomBase) {
  const extensions = ['.jpg', '.jpeg', '.png', '.webp'];
  for (const ext of extensions) {
    const fitxer = nomBase + ext;
    const ruta = path.join(imatgeBasePath, fitxer);
    if (fs.existsSync(ruta)) {
      return `${imatgeBaseUrl}/${fitxer}`;
    }
  }
  return null;
}

const getAdreces = async (req, res) => {
  let connection;
  try {
    connection = await db();
   const result = await connection.execute(
    `SELECT a.DOMCOD, 
      a.ADRECA AS "adreca",
      a.nucli_cod AS "nucli_cod", a.codi_carrer AS "codi_carrer", a.carrer AS "carrer", a.numero AS "numero", a.bis AS "bis", a.pis AS "pis", a.porta AS "porta", 
      a.tipus_dom AS "tipus_dom", a.tipus_loc AS "tipus_loc", a.amplada_carrer AS "amplada_carrer", a.coord_x AS "coord_x", a.coord_y AS "coord_y", a.zona_id AS "zona_id", 
      'ZR-' || z.codi AS "codi_zona", 
      a.area_tractament_id AS "area_tractament_id", 
      CASE WHEN at.codi IS NOT NULL THEN 'ATE ' || z.codi || '.' || at.codi ELSE NULL END AS "codi_area"
    FROM ecpu_adreca a
    JOIN ecpu_zona z ON a.zona_id = z.id 
    LEFT JOIN ecpu_area_tractament at ON a.area_tractament_id = at.id`,
    [],
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

    if (result.rows.length === 0) {
      return res.status(404).send("No s'han trobat adreces");
    }

    const dades = result.rows.map(adreca => {
      let imatge = trobarImatge(String(adreca.DOMCOD));

      if (!imatge) {
          const nucliCodPadded = String(adreca.nucli_cod).padStart(9, '0');
          imatge = trobarImatge(nucliCodPadded);
      }

      return {
        ...adreca,
        imatge
      };
    });
          
    res.status(200).json(dades);
  } catch (error) {
    console.error('❌ Error obtenint les adreces:', error);
    res.status(500).send('❌ Error en obtenir les adreces');
  } finally {
    if (connection) await connection.close();
  }
};

const actualitzarAdreca = async (req, res) => {
  let connection;
  try {
    connection = await db();

    const domcod = req.body.adreca.DOMCOD;
    const { tipus_dom, tipus_loc, amplada_carrer, imatge } = req.body.adreca;

    let imatgeRuta = null;
    if (imatge) {
      const base64Data = imatge.replace(/^data:image\/\w+;base64,/, '');
      const nomFitxer = `${domcod}.png`;
      imatgeRuta = process.env.IMATGE_RUTA + nomFitxer;
    
      const carpetaDestinacio = path.dirname(imatgeRuta);
      if (!fs.existsSync(carpetaDestinacio)) {
        fs.mkdirSync(carpetaDestinacio, { recursive: true });
      }
    
      const buffer = Buffer.from(base64Data, 'base64');
    
      // Redimensionar i optimitzar amb sharp
      await sharp(buffer)
        .resize({ width: 800 })       // Amplada màxima de 800px
        .png({ quality: 70 })         // Qualitat al 80%
        .toFile(imatgeRuta);
    }
    

    // Actualitzar la taula principal
    const updateQuery = `
      UPDATE ECPU_ADRECA 
      SET TIPUS_DOM = :tipus_dom,
          TIPUS_LOC = :tipus_loc,
          AMPLADA_CARRER = :amplada_carrer
      WHERE DOMCOD = :domcod
    `;

    await connection.execute(updateQuery, {
      tipus_dom,
      tipus_loc,
      amplada_carrer,
      domcod
    });

    await connection.commit();

    res.status(200).json({ missatge: 'Adreça actualitzada correctament' });

  } catch (error) {
    console.error('❌ Error actualitzant l’adreça:', error);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    if (connection) await connection.close();
  }
};


module.exports = {
  getAdreces,
  uploadAdreces,
  actualitzarAdreca
};

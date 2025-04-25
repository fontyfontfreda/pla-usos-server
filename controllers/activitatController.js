const db = require('../models/db');
const oracledb = require('oracledb');
const PDFDocument = require('pdfkit');
const puppeteer = require('puppeteer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const isOlot = process.env.IS_OLOT === 'true';

const getAllActivitats = async (req, res) => {
  let connection;
  try {
    connection = await db();

    const activitats = await connection.execute(
      `SELECT 
        g.descripcio AS "descripcio_grup", 
        s.descripcio AS "descripcio_subgrup", 
        a.descripcio AS "descripcio_activitat" 
       FROM ecpu_descripcio_activitat a 
       JOIN ecpu_subgrup_activitat s ON a.id_subgrup_activitat = s.id
       JOIN ecpu_grup_activitat g ON s.codi_grup_activitat = g.codi`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (activitats.rows.length === 0) {
      return res.status(404).send('No s\'ha trobat cap activitat');
    }

    const resultat = {};

    activitats.rows.forEach(row => {
      const { descripcio_grup, descripcio_subgrup, descripcio_activitat } = row;

      // Si no existeix el grup, el creem
      if (!resultat[descripcio_grup]) {
        resultat[descripcio_grup] = {};
      }

      // Si no existeix el subgrup dins el grup, el creem
      if (!resultat[descripcio_grup][descripcio_subgrup]) {
        resultat[descripcio_grup][descripcio_subgrup] = [];
      }

      // Afegim l'activitat dins el subgrup
      resultat[descripcio_grup][descripcio_subgrup].push(descripcio_activitat);
    });

    console.log(JSON.stringify(resultat, null, 2));

    res.status(200).json(resultat);
  } catch (error) {
    console.error('❌ Error obtenint les activitats:', error);
    res.status(500).send('❌ Error en obtenir les activitats');
  } finally {
    if (connection) await connection.close();
  }
};

const getActivitats = async (req, res) => {
  let connection;
  try {
    // Connexió amb la base de dades Oracle
    connection = await db();

    // Consulta per saber si l'adreça pertany a una àrea
    const result = await connection.execute(
      'SELECT a.zona_id, a.area_tractament_id FROM ecpu_adreca a WHERE a.DOMCOD = :domcod',
      [req.params.domcod],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    let condicions = [];

    // Si no hi ha resultats, retornem un error 404
    if (result.rows.length === 0) {
      return res.status(404).send('No s\'ha trobat l\'adreça');
    } else {
      if (result.rows[0].AREA_TRACTAMENT_ID === null) {
        // L'adreça no pertany a cap àrea, fem cerca de condicions per zona
        const zonaResult = await connection.execute(
          `SELECT ga.codi AS "codi_grup", ga.descripcio AS "descripcio_grup", sa.codi AS "codi_subgrup", 
                  sa.descripcio AS "descripcio_subgrup", da.id AS "codi_descripcio_activitat", 
                  da.descripcio AS "descripcio_descripcio_activitat", c.id AS "id_condicio", 
                  zac.valor AS "valor_condicio", c.descripcio AS "condicio"
           FROM ecpu_zona_activitat_condicio zac 
           JOIN ecpu_condicio c ON zac.condicio_id = c.id 
           JOIN ecpu_descripcio_activitat da ON zac.descripcio_activitat_id = da.id 
           JOIN ecpu_subgrup_activitat sa ON da.id_subgrup_activitat = sa.id 
           JOIN ecpu_grup_activitat ga ON sa.codi_grup_activitat = ga.codi 
           WHERE zona_id = :zona_id`,
          [result.rows[0].ZONA_ID],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        condicions = zonaResult.rows;
      } else {
        // L'adreça pertany a una àrea, fem cerca de condicions per àrea
        const areaResult = await connection.execute(
          `SELECT ga.codi AS "codi_grup", ga.descripcio AS "descripcio_grup", sa.codi AS "codi_subgrup", 
                  sa.descripcio AS "descripcio_subgrup", da.id AS "codi_descripcio_activitat", 
                  da.descripcio AS "descripcio_descripcio_activitat", c.id AS "id_condicio", 
                  aac.valor AS "valor_condicio", c.descripcio AS "condicio" 
           FROM ecpu_area_activitat_condicio aac 
           JOIN ecpu_condicio c ON aac.condicio_id = c.id 
           JOIN ecpu_descripcio_activitat da ON aac.descripcio_activitat_id = da.id 
           JOIN ecpu_subgrup_activitat sa ON da.id_subgrup_activitat = sa.id 
           JOIN ecpu_grup_activitat ga ON sa.codi_grup_activitat = ga.codi 
           WHERE aac.area_id = :area_id`,
          [result.rows[0].AREA_TRACTAMENT_ID],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        condicions = areaResult.rows;
      }
    }

    // Retornem les dades de les condicions
    res.status(200).json(condicions);
  } catch (error) {
    console.error('❌ Error obtenint les activitats:', error);
    res.status(500).send('❌ Error en obtenir les activitats');
  } finally {
    if (connection) await connection.close();
  }
};

const consultaActivitat = async (req, res) => {
  let connection;
  try {
    connection = await db();
    const { dades } = req.body.dades;

    const usuari = dades.usuari;
    const adreca = dades.adreca;
    const activitat = dades.activitat;

    if (activitat.is_altres) {
      // Enviar correu a consorci
    } else {
      let is_apte;
      // Mirar condicions
      switch (activitat.id_condicio) {
        case 1:
          // NO APTE
          is_apte = false;
          break;
        case 2:
          // APTE
          is_apte = true;
          break;
        case 3:
          // APTE PRIORITARI
          is_apte = true;
          break;
        case 4:
          // distancia 50m
          is_apte = await consultaBuffer(connection, activitat);
          break;
        case 5:
          // distancia 100m
          is_apte = await consultaBuffer(connection, activitat);
          break;
        case 6:
          // densitat 50m
          is_apte = await consultaBuffer(connection, activitat);
          break;
        case 7:
          // amplaria carrer
          is_apte = adreca.amplada_carrer >= activitat.valor_condicio;
          break;
        case 9:
          // ubicacio parcel·la
          is_apte = adreca.pis == +1;
          break;
        default:
          break;
      }

      // Executa la consulta per inserir la cosulta a la base de dades
      const result = await connection.execute(
        `INSERT INTO ecpu_consulta (DNI_interessat, nom_interessat, actuacio_interessat, DOMCOD, grup_id, grup_descripcio, subgrup_id, subgrup_descripcio, activitat_id, condicio_id, valor_condicio, is_altres, descripcio_altres, is_valid, coord_x, coord_y) 
     VALUES (:DNI_interessat, :nom_interessat, :actuacio_interessat, :DOMCOD, :grup_id, :grup_descripcio, :subgrup_id, :subgrup_descripcio, :activitat_id, :condicio_id, :valor_condicio, :is_altres, :descripcio_altres, :is_valid, :coord_x, :coord_y)`,
        {
          DNI_interessat: usuari.dni,
          nom_interessat: usuari.nom,
          actuacio_interessat: usuari.actuaComA,
          DOMCOD: adreca.DOMCOD,
          grup_id: !activitat.is_altres ? activitat.codi_grup : null,
          grup_descripcio: !activitat.is_altres ? activitat.descripcio_grup : null,
          subgrup_id: !activitat.is_altres ? activitat.codi_subgrup : null,
          subgrup_descripcio: !activitat.is_altres ? activitat.descripcio_subgrup : null,
          activitat_id: !activitat.is_altres ? activitat.codi_descripcio_activitat : null,
          condicio_id: !activitat.is_altres ? activitat.id_condicio : null,
          valor_condicio: !activitat.is_altres ? activitat.valor_condicio : null,
          is_altres: activitat.is_altres ? 1 : 0,
          descripcio_altres: !activitat.is_altres ? null : activitat.descripcio_activitat,
          is_valid: is_apte ? '1' : '0',
          coord_x: adreca.coord_x,
          coord_y: adreca.coord_y
        },
        { autoCommit: true }
      );

      if (result.rowsAffected === 0) {
        return res.status(404).send('No s\'ha pogut crear la consulta');
      }

      // Inserir vista.

      // Aquí generem el PDF i l'enviem en la resposta HTTP
      await generarPDF(is_apte, activitat, adreca, res);

      // Un cop generat el PDF, retornem la resposta
    }
  } catch (error) {
    console.error('❌ Error creant la consulta:', error);
    res.status(500).send('Error al crear la consulta');
  } finally {
    if (connection) await connection.close();
  }
};

function generarPDF(is_apte, activitat, adreca, res) {
  return new Promise(async (resolve, reject) => {
    let mapaUrl = '';

    if (activitat.id_condicio == 4 || activitat.id_condicio == 5 || activitat.id_condicio == 6 || activitat.id_condicio == 7)
      mapaUrl = `https://sig.olot.cat/minimapa/Pla-usos_informe.asp?X=${adreca.coord_x}&Y=${adreca.coord_y}`;
    else
      mapaUrl = `https://sig.olot.cat/minimapa/Pla-usos.asp?X=${adreca.coord_x}&Y=${adreca.coord_y}`;

    try {
      // Llançar navegador i capturar la pàgina
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      await page.goto(mapaUrl, { waitUntil: 'networkidle0' });

      // Captura de la pàgina (o part visible)
      const screenshotPath = path.join(os.tmpdir(), 'mapa_temp.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });

      await browser.close();

      // Crear un nou document PDF
      const doc = new PDFDocument();

      // Configura el tipus de contingut i el nom del fitxer PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="informe_final.pdf"');

      // El fitxer PDF es genera directament en la resposta
      doc.pipe(res);

      // Contingut del PDF
      doc.font('Helvetica-Bold')
        .fontSize(12)
        .text('INFORME FINAL INFORMATIU', { align: 'left' });
      doc.moveDown();

      // Data
      const avui = new Date();
      const dataFormatejada = `${String(avui.getDate()).padStart(2, '0')}/${String(avui.getMonth() + 1).padStart(2, '0')}/${avui.getFullYear()}`;

      doc.font('Helvetica')
        .fontSize(10)
        .text(`DATA: ${dataFormatejada}`, { align: 'left' });
      doc.moveDown();

      // Adreça i activitat
      doc.text(`- ${adreca.adreca} (${adreca.DOMCOD}) OLOT`);
      doc.moveDown();
      doc.text(`- Tipus d'activitat: ${activitat.descripcio_grup}`);
      doc.text(`- Sector: ${activitat.descripcio_subgrup}`);
      doc.text(`- Desglòs: ${activitat.descripcio_descripcio_activitat}`);
      doc.moveDown();

      // Mapa
      doc.image(screenshotPath, {
        fit: [500, 300],
        align: 'center',
        valign: 'center'
      });
      doc.moveDown(2);

      // Informació
      doc.font('Helvetica-Bold')
        .fontSize(12)
        .text(titolInformacioPDF(is_apte, activitat.id_condicio), { align: 'center' });
      doc.moveDown(2);
      doc.font('Helvetica')
        .fontSize(10)
        .text(``, { align: 'left' });

      // Paràgraf 1
      if (activitat.id_condicio != 1 && activitat.id_condicio != 2 && activitat.id_condicio != 3 && is_apte) {
        doc.font('Helvetica')
          .fontSize(10)
          .fillColor('red')
          .text('ALERTA: ', { continued: true })  // continua a la mateixa línia

        doc.fillColor('black')
          .text('aquesta activitat està admesa amb condicions i, per tant, hauràs de dirigir-te al Consorci de Medi Ambient i Salut Pública (SIGMA) per tal que et verifiquin que l’activitat és apte en aquest establiment.', {
            align: 'left'
          });

        doc.moveDown();
      }

      // Paràgraf 2
      if (activitat.id_condicio != 1 && is_apte) {
        if (activitat.id_condicio == 2 || activitat.id_condicio == 3)
          doc.text('Aquest document s’ha d’entregar al SIGMA (Consorci de Medi Ambient i Salut Pública) i té una vigència d’un mes.', { align: 'left' });
        else
          doc.text('Aquest document té una vigència d’un mes.', { align: 'left' });
        doc.moveDown();
      }

      // Paràgraf 3
      doc.text('Document sense valor normatiu, vàlid només a efectes informatius.', { align: 'left' });

      doc.end();

      doc.on('finish', () => {
        resolve();
      });

    } catch (err) {
      reject(err);
    }
  });
}

function titolInformacioPDF(is_apte, condicio) {
  if (!is_apte) {
    return 'ACTIVITAT NO ADMESA SEGONS EL PLA ESPECIAL D’USOS';
  } else if (condicio == 2 || condicio == 3) {
    return 'ACTIVITAT ADMESA SEGONS EL PLA ESPECIAL D’USOS';
  } else {
    return 'ACTIVITAT ADMESA AMB CONDICIONS SEGONS EL PLA ESPECIAL D’USOS';
  }
}

async function consultaBuffer(connection, activitat) {
  if (isOlot) {
    const result = await connection.execute(
      `SELECT A.DESCRIPCIO FROM (SELECT * FROM (SELECT COORDGEOCODEPOINT, DOMCOD, ADRECA, ZONA, ATE FROM AIT.USTG_LOC_DETALL_IN_P_USOS_AUT 
      WHERE ZONA = (SELECT ZONA FROM AIT.USTG_LOC_DETALL_IN_P_USOS_AUT WHERE DOMCOD = :domcod)) dom, (
      SELECT GRUP, SUBGRUP, DESCRIPCIO, DOMCOD FROM AIT.DOVC_DOMI_DADES_ACTIVI_SIGMA WHERE ESTAT IN 
      ('ACTIVA','DUBTOSA','EN OBRES','HISTORICA','INACTIVA AMB LLICENCIA','INCOMPLERTA','MUNICIPAL') AND TIPUS_DOMICILI = 'PRINCIPAL' 
      AND (trim(GRUP) = :grup AND trim(SUBGRUP) = :subgrup)) act where act.DOMCOD= dom.DOMCOD) A, 
      (SELECT COORDGEOCODEPOINT, ZONA, ATE FROM AIT.USTG_LOC_DETALL_IN_P_USOS_AUT WHERE DOMCOD = :domcod) B 
      WHERE SDO_WITHIN_DISTANCE ( B.COORDGEOCODEPOINT, A.COORDGEOCODEPOINT, 'distance=' || :diam || ' unit=meter') = 'TRUE'`,
      {
        domcod: activitat.DOMCOD,
        grup: activitat.descripcio_grup,
        subgrup: activitat.descripcio_subgrup,
        diam: activitat.valor_condicio
      },
      { autoCommit: true }
    );
    if ((activitat.id_condicio == 4 || activitat.id_condicio == 5) && result.rows.length == 0) {
      return true;
    }
    if (activitat.id_condicio == 6 && result.rows.length < activitat.valor_condicio) {
      return true;
    }
    return false;
  } else
    return false;
}

module.exports = {
  getActivitats,
  consultaActivitat,
  getAllActivitats
};

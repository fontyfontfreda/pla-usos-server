const db = require('../models/db');
const oracledb = require('oracledb');
const PDFDocument = require('pdfkit');
const puppeteer = require('puppeteer');
const fs = require('fs');
const os = require('os');
const path = require('path');

const isOlot = process.env.IS_OLOT === 'true';

let has_aplada_carrer = true;

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
       RIGHT JOIN ecpu_subgrup_activitat s ON a.id_subgrup_activitat = s.id
       RIGHT JOIN ecpu_grup_activitat g ON s.codi_grup_activitat = g.codi`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (activitats.rows.length === 0) {
      return res.status(404).send('No s\'ha trobat cap activitat');
    }

    const resultat = {};

    activitats.rows.forEach(row => {
      const { descripcio_grup, descripcio_subgrup, descripcio_activitat } = row;

      // Si no hi ha grup, descartem
      if (!descripcio_grup || descripcio_grup === 'null') {
        return;
      }

      // Assegurem que el grup existeix
      if (!resultat[descripcio_grup]) {
        resultat[descripcio_grup] = {};
      }

      // Si hi ha subgrup, l’afegim (amb o sense activitat)
      if (descripcio_subgrup && descripcio_subgrup !== 'null') {
        if (!resultat[descripcio_grup][descripcio_subgrup]) {
          resultat[descripcio_grup][descripcio_subgrup] = [];
        }

        // Si també hi ha activitat, l’afegim a la llista
        if (descripcio_activitat && descripcio_activitat !== 'null') {
          resultat[descripcio_grup][descripcio_subgrup].push(descripcio_activitat);
        }
      }
    });


    res.status(200).json(resultat);
  } catch (error) {
    console.error('❌ Error obtenint les activitats:', error);
    res.status(500).send('❌ Error en obtenir les activitats');
  } finally {
    if (connection) await connection.close();
  }
};

const pdfConsulta = async (req, res) => {
  let connection;
  try {
    const { consultaId } = req.params;

    connection = await db();
    const result = await connection.execute(
      `SELECT c.CONDICIO_ID, c.VALOR_CONDICIO, c.DOMCOD, c.GRUP_DESCRIPCIO, c.SUBGRUP_DESCRIPCIO, d.descripcio AS "ACTIVITAT_DESCRIPCIO", c.COORD_X, c.COORD_Y, a.ADRECA AS "adreca", a.AMPLADA_CARRER, a.PIS
        FROM ECPU_CONSULTA c
        JOIN ecpu_descripcio_activitat d ON d.id = c.activitat_id
        LEFT JOIN ecpu_adreca a ON a.DOMCOD = c.DOMCOD
        WHERE c.ID = :id`,
      [consultaId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return res.status(404).send('Consulta no trobada');
    }

    const fila = result.rows[0];

    const activitat = {
      id_condicio: fila.CONDICIO_ID,
      valor_condicio: fila.VALOR_CONDICIO,
      DOMCOD: fila.DOMCOD,
      descripcio_grup: fila.GRUP_DESCRIPCIO,
      descripcio_subgrup: fila.SUBGRUP_DESCRIPCIO,
      descripcio_descripcio_activitat: fila.ACTIVITAT_DESCRIPCIO
    }

    const adreca = {
      DOMCOD: fila.DOMCOD,
      coord_x: Math.trunc(fila.COORD_X),
      coord_y: Math.trunc(fila.COORD_Y),
      adreca: fila.adreca,
      aplada_carrer: fila.AMPLADA_CARRER,
      pis: fila.PIS
    }

    if (isOlot)
      await inserirVista(connection, fila.COORD_X, fila.COORD_Y, consultaId);

    const buffer = await generarPDF(isConsultaValida(activitat, connection, adreca), activitat, adreca);

    // ✅ Enviar directament el PDF com a resposta binària
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="informe_final.pdf"',
    });

    res.send(buffer);

  } catch (error) {
    console.error('❌ Error creant la consulta:', error);
    res.status(500).send('Error al crear la consulta');
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
          `SELECT ga.codi AS "codi_grup", ga.descripcio AS "descripcio_grup", sa.id AS "id_subgrup", sa.codi AS "codi_subgrup", 
                  sa.descripcio AS "descripcio_subgrup", da.id AS "codi_descripcio_activitat", 
                  da.descripcio AS "descripcio_descripcio_activitat", c.id AS "id_condicio", 
                  zac.valor AS "valor_condicio", c.descripcio AS "condicio"
           FROM ecpu_zona_activitat_condicio zac 
           JOIN ecpu_condicio c ON zac.condicio_id = c.id 
           JOIN ecpu_epigraf e ON e.id = zac.epigraf_id
           JOIN ecpu_descripcio_activitat da ON da.id_epigraf = e.id
           JOIN ecpu_subgrup_activitat sa ON da.id_subgrup_activitat = sa.id 
           JOIN ecpu_grup_activitat ga ON sa.codi_grup_activitat = ga.codi 
           WHERE zona_id = :zona_id
           AND e.mostrar = 1
           AND da.mostrar = 1`,
          [result.rows[0].ZONA_ID],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        condicions = zonaResult.rows;
      } else {
        // L'adreça pertany a una àrea, fem cerca de condicions per àrea
        const areaResult = await connection.execute(
          `SELECT ga.codi AS "codi_grup", ga.descripcio AS "descripcio_grup", sa.id AS "id_subgrup", sa.codi AS "codi_subgrup", 
                  sa.descripcio AS "descripcio_subgrup", da.id AS "codi_descripcio_activitat", 
                  da.descripcio AS "descripcio_descripcio_activitat", c.id AS "id_condicio", 
                  aac.valor AS "valor_condicio", c.descripcio AS "condicio" 
           FROM ecpu_area_activitat_condicio aac 
           JOIN ecpu_condicio c ON aac.condicio_id = c.id 
           JOIN ecpu_epigraf e ON e.id = aac.epigraf_id
           JOIN ecpu_descripcio_activitat da ON da.id_epigraf = e.id
           JOIN ecpu_subgrup_activitat sa ON da.id_subgrup_activitat = sa.id 
           JOIN ecpu_grup_activitat ga ON sa.codi_grup_activitat = ga.codi 
           WHERE aac.area_id = :area_id
           AND e.mostrar = 1
           AND da.mostrar = 1`,
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

    adreca.coord_x = Math.trunc(adreca.coord_x);
    adreca.coord_y = Math.trunc(adreca.coord_y);

    if (activitat.is_altres) {
      // Enviar correu a consorci
    } else {

      let is_apte = await isConsultaValida(activitat, connection, adreca);

      const result = await connection.execute(
        `BEGIN ECPU_INSERIR_CONSULTA_I_VISTA_BUFFER(
          :DNI_interessat, :nom_interessat, :actuacio_interessat, :DOMCOD,
          :grup_id, :grup_descripcio, :subgrup_id, :subgrup_descripcio,
          :activitat_id , :condicio_id, :valor_condicio,
          :is_altres, :descripcio_altres, :is_valid,
          :coord_x, :coord_y, :insertedId
        ); END;`,
        {
          DNI_interessat: usuari.dni,
          nom_interessat: usuari.nom,
          actuacio_interessat: usuari.actuaComA,
          DOMCOD: adreca.DOMCOD,
          grup_id: !activitat.is_altres ? activitat.codi_grup : null,
          grup_descripcio: !activitat.is_altres ? activitat.descripcio_grup : null,
          subgrup_id: !activitat.is_altres ? activitat.id_subgrup : null,
          subgrup_descripcio: !activitat.is_altres ? activitat.descripcio_subgrup : null,
          activitat_id: !activitat.is_altres ? activitat.codi_descripcio_activitat : null,
          condicio_id: !activitat.is_altres ? activitat.id_condicio : null,
          valor_condicio: !activitat.is_altres ? activitat.valor_condicio : null,
          is_altres: activitat.is_altres ? 1 : 0,
          descripcio_altres: !activitat.is_altres ? null : activitat.descripcio_activitat,
          is_valid: is_apte ? 1 : 0,
          coord_x: adreca.coord_x,
          coord_y: adreca.coord_y,
          insertedId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
        },
        { autoCommit: true }
      );

      if (isOlot)
        await inserirVista(connection, adreca.coord_x, adreca.coord_y, result.outBinds.insertedId);


      if (result.rowsAffected === 0) {
        return res.status(404).send('No s\'ha pogut crear la consulta');
      }

      const pdfBuffer = await generarPDF(is_apte, activitat, adreca);

      res.json({
        is_apte,
        pdf: pdfBuffer.toString('base64')
      });

      // Un cop generat el PDF, retornem la resposta
    }
  } catch (error) {
    console.error('❌ Error creant la consulta:', error);
    res.status(500).send('Error al crear la consulta');
  } finally {
    if (connection) await connection.close();
  }
};

async function isConsultaValida(activitat, connection, adreca) {
  let is_apte = false;
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
      is_apte = await consultaBuffer(connection, activitat, adreca.DOMCOD);
      break;
    case 5:
      // distancia 100m
      is_apte = await consultaBuffer(connection, activitat, adreca.DOMCOD);
      break;
    case 6:
      // densitat 50m
      is_apte = await consultaBuffer(connection, activitat, adreca.DOMCOD);
      break;
    case 7:
      // amplaria carrer
      if (adreca.amplada_carrer == null || adreca.amplada_carrer == undefined) {
        is_apte = false;
        has_aplada_carrer = false;
      } else {
        is_apte = adreca.amplada_carrer >= activitat.valor_condicio;
      }
      break;
    case 8:
      is_apte = true;
    case 9:
      // ubicacio parcel·la
      is_apte = adreca.pis == +1;
      break;
    case 10:
      is_apte = true;
    case 11:
      is_apte = true;
    default:
      break;
  }
  return is_apte;
}

async function inserirVista(connection, coord_x, coord_y, consulta_id) {

  // Validació: assegura que coord_x i coord_y són números
  if (isNaN(coord_x) || isNaN(coord_y)) {
    throw new Error(`Coordenades no vàlides: coord_x = ${coord_x}, coord_y = ${coord_y}`);
  }

  // També pots assegurar que consulta_id és numèric si no tens garanties
  if (isNaN(consulta_id)) {
    throw new Error(`ID de consulta no vàlid: consulta_id = ${consulta_id}`);
  }

  const sql = `
    CREATE OR REPLACE VIEW AIT.ECPU_DADES_VISTA_PLANOL AS
    SELECT cons.ID,
      sdo_geometry('POINT (${coord_x} ${coord_y})', 25831) AS GEOMETRY,
      ROUND(COORD_X, 0) AS X,
      ROUND(COORD_Y, 0) AS Y,
      cons.DOMCOD,
      GRUP_ID,
      GRUP_DESCRIPCIO,
      SUBGRUP_DESCRIPCIO,
      CONDICIO_ID,
      VALOR_CONDICIO,
      IS_ALTRES,
      DESCRIPCIO_ALTRES,
      (CASE WHEN CONDICIO_ID IN (4,5,6) THEN 'BUFFER' WHEN CONDICIO_ID = 7 THEN 'TRAM' ELSE 'NO' END) TIPUS,
      (CASE WHEN IS_VALID = 1 THEN 'SI' ELSE 'NO' END) VALID,
      ZONA,
      ATE
    FROM AIT.ECPU_CONSULTA cons,
         AIT.USTG_LOC_DETALL_IN_P_USOS_AUT loc
    WHERE cons.ID = ${consulta_id}
      AND cons.DOMCOD = loc.DOMCOD
  `;

  await connection.execute(sql, [], { autoCommit: true });
}

function generarPDF(is_apte, activitat, adreca) {
  return new Promise(async (resolve, reject) => {
    let mapaUrl = '';

    if (activitat.id_condicio == 4 || activitat.id_condicio == 5 || activitat.id_condicio == 7)
      mapaUrl = `https://sig.olot.cat/minimapa/Pla-usos_informe.asp?X=${adreca.coord_x}&Y=${adreca.coord_y}&diam=100`;
    else if (activitat.id_condicio == 6)
      mapaUrl = `https://sig.olot.cat/minimapa/Pla-usos_informe.asp?X=${adreca.coord_x}&Y=${adreca.coord_y}&diam=50`;
    else
      mapaUrl = `https://sig.olot.cat/minimapa/Pla-usos.asp?X=${adreca.coord_x}&Y=${adreca.coord_y}`;

    try {
      // Lançar el navegador i carregar la pàgina
      const browser = await puppeteer.launch();
      const page = await browser.newPage();

      await page.goto(mapaUrl, { waitUntil: 'networkidle0' });

      // Esperar que el mapa es carregui
      await page.waitForSelector('#map', { visible: true });

      // Afegir pausa per assegurar que desapareixen capes temporals
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Captura només de la zona del mapa
      const screenshotPath = path.join(os.tmpdir(), 'mapa_temp.png');
      const mapaElement = await page.$('#map');
      await mapaElement.screenshot({ path: screenshotPath });

      await browser.close();

      // Crear PDF i recollir-lo com a Buffer
      const doc = new PDFDocument();
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

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
      doc.text(`- ${adreca.adreca ? adreca.adreca : "Adreça no disponible"} (${adreca.DOMCOD}) OLOT`);
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

      if (!has_aplada_carrer) {
        doc.font('Helvetica')
          .fontSize(10)
          .fillColor('red')
          .text('ALERTA: ', { continued: true })  // continua a la mateixa línia

        doc.fillColor('black')
          .text('No es disposa de l\'amplada d\'aquest carrer. Posis en contacte enviant un correu a SIGMA a la següent adreça aculebras@consorcisigma.org per més informació.', {
            align: 'left'
          });

        doc.moveDown();
      } else {
        // Informació
        doc.font('Helvetica-Bold')
          .fontSize(12)
          .text(titolInformacioPDF(is_apte, activitat.id_condicio), { align: 'center' });

        let motiu;
        if (is_apte) {
          motiu = '';
        } else {
          doc.text('\n', { align: 'left' });

          switch (activitat.id_condicio) {
            case 4:
              motiu = 'Motiu: Ja hi ha una activitat del mateix grup en un radi de 50 metres.';
              break;
            case 5:
              motiu = 'Motiu: Ja hi ha una activitat del mateix grup en un radi de 100 metres.';
              break;
            case 6:
              motiu = 'Motiu: Ja hi ha ' + activitat.valor_condicio + ' activitats del mateix grup en un radi de 50 metres.';
              break;
            case 7:
              motiu = 'Motiu: El carrer fa menys de ' + activitat.valor_condicio + ' metres.';
              break;
            case 9:
              motiu = 'Motiu: El local no es troba en un 1r pis.';
              break;
            default:
              motiu = '';
              break;
          }
        }
        doc.font('Helvetica')
          .fontSize(10)
          .text(motiu, { align: 'left' });

        doc.font('Helvetica')
          .fontSize(10)
          .text('\n', { align: 'left' });


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
        if (!(activitat.id_condicio == 1 || activitat.id_condicio == 2 || activitat.id_condicio == 3) && is_apte) {
          doc.text('Si vols crear una reserva d’aquest local amb la teva activitat, has d’enviar un correu a SIGMA a la següent adreça aculebras@consorcisigma.org adjuntant el teu informe final generat pel visor del Pla d’Usos i demanant la teva reserva, la qual tindrà una durada de 15 dies.', { align: 'left' });

          doc.font('Helvetica-Bold')
            .fontSize(10)
            .fillColor('black')
            .text('IMPORTANT: ', { continued: true })  // continua a la mateixa línia

          doc.font('Helvetica')
            .fillColor('black')
            .text('si durant aquest període de 15 dies SIGMA no rep la teva tramitació de documentació per gestionar la llicència d’activitat, la teva reserva s’anul·larà.', {
              align: 'left'
            });
        }

        doc.text('\n', { align: 'left' });

        // Paràgraf 3
        if (activitat.id_condicio != 1 && is_apte) {
          if (activitat.id_condicio == 2 || activitat.id_condicio == 3)
            doc.text('Aquest document s’ha d’entregar al SIGMA (Consorci de Medi Ambient i Salut Pública) i té una vigència d’un mes.', { align: 'left' });
          else
            doc.fontSize(8).text('Aquest document té una vigència d’un mes.', { align: 'left' });
          doc.moveDown();
        }

        // Paràgraf 4
        doc.fontSize(8).text('Document sense valor normatiu, vàlid només a efectes informatius.', { align: 'left' });

        doc.text('\n', { align: 'left' });

        // Paràgraf 5
        doc.fontSize(8).text('Aquest informe no indica si en aquest local ja hi ha una activitat existent i tampoc es contemplen variacions de domicilis.', { align: 'left' });
      }
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

async function consultaBuffer(connection, activitat, DOMCOD) {
  if (isOlot) {
    let diametre = (activitat.id_condicio == 4 || activitat.id_condicio == 6) ? 50 : 100;
    const result = await connection.execute(
      `SELECT A.DESCRIPCIO FROM (SELECT * FROM (SELECT COORDGEOCODEPOINT, DOMCOD, ADRECA, ZONA, ATE FROM AIT.USTG_LOC_DETALL_IN_P_USOS_AUT 
      WHERE ZONA = (SELECT ZONA FROM AIT.USTG_LOC_DETALL_IN_P_USOS_AUT WHERE DOMCOD = :domcod)) dom, (
      SELECT GRUP, SUBGRUP, DESCRIPCIO, DOMCOD FROM AIT.DOVC_DOMI_DADES_ACTIVI_SIGMA WHERE ESTAT IN 
      ('ACTIVA','DUBTOSA','EN OBRES','HISTORICA','INACTIVA AMB LLICENCIA','INCOMPLERTA','MUNICIPAL') AND TIPUS_DOMICILI = 'PRINCIPAL' 
      AND (trim(GRUP) = :grup AND trim(SUBGRUP) = :subgrup)) act where act.DOMCOD= dom.DOMCOD) A, 
      (SELECT COORDGEOCODEPOINT, ZONA, ATE FROM AIT.USTG_LOC_DETALL_IN_P_USOS_AUT WHERE DOMCOD = :domcod) B 
      WHERE SDO_WITHIN_DISTANCE ( B.COORDGEOCODEPOINT, A.COORDGEOCODEPOINT, 'distance=' || :diam || ' unit=meter') = 'TRUE'`,
      {
        domcod: DOMCOD,
        grup: activitat.descripcio_grup,
        subgrup: activitat.descripcio_subgrup,
        diam: diametre
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

const getActivitat = async (req, res) => {
  let connection;
  try {
    connection = await db();
    const activitat = req.params.activitat;
    const subgrup = req.params.subgrup;
    const grup = req.params.grup;

    if (!activitat) {
      console.error('❌ Falta el paràmetre activitat:', error);
      res.status(400).send('❌ Falta el paràmetre activitat');
    } else if (!subgrup) {
      console.error('❌ Falta el paràmetre subgrup:', error);
      res.status(400).send('❌ Falta el paràmetre subgrup');
    } else if (!grup) {
      console.error('❌ Falta el paràmetre grup:', error);
      res.status(400).send('❌ Falta el paràmetre grup');
    } else {
      const result = await connection.execute(
        `SELECT
            ga.codi AS "codi_grup",
            ga.descripcio AS "descripcio_grup",
            sa.id AS "id_subgrup",
            sa.descripcio AS "descripcio_subgrup",
            da.id AS "id_activitat",
            da.descripcio AS "descripcio_activitat",
            da.mostrar AS "mostrar",
            e.id AS "id_epigraf",
            e.descripcio AS "descripcio_epigraf"
        FROM ecpu_descripcio_activitat da
        JOIN ecpu_subgrup_activitat sa ON sa.id = da.id_subgrup_activitat
        JOIN ecpu_grup_activitat ga ON ga.codi = sa.codi_grup_activitat
        JOIN ecpu_epigraf e ON e.id = da.id_epigraf
        WHERE da.descripcio = :activitat AND sa.descripcio = :subgrup AND ga.descripcio = :grup`,
        {
          activitat: activitat,
          subgrup: subgrup,
          grup: grup
        },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const activitatData = result.rows[0];

      if (!activitatData) {
        return res.status(404).send("No s'ha trobat l'activitat");
      }

      res.status(200).json(activitatData);
    }
  } catch (error) {
    console.error('❌ Error obtenint les dades:', error);
    res.status(500).send('Error obtenint les dades');
  } finally {
    if (connection) await connection.close();
  }
};

const getSubgrup = async (req, res) => {
  let connection;
  try {
    connection = await db();
    const subgrup = req.params.subgrup;
    const grup = req.params.grup;

    if (!subgrup) {
      console.error('❌ Falta el paràmetre subgrup:', error);
      res.status(400).send('❌ Falta el paràmetre subgrup');
    } else if (!grup) {
      console.error('❌ Falta el paràmetre grup:', error);
      res.status(400).send('❌ Falta el paràmetre grup');
    } else {
      const result = await connection.execute(
        `SELECT
            ga.codi AS "codi_grup",
            ga.descripcio AS "descripcio_grup",
            sa.id AS "id_subgrup",
            sa.descripcio AS "descripcio_subgrup"
        FROM ecpu_subgrup_activitat sa 
        JOIN ecpu_grup_activitat ga ON ga.codi = sa.codi_grup_activitat
        WHERE sa.descripcio = :subgrup AND ga.descripcio = :grup`,
        {
          subgrup: subgrup,
          grup: grup
        },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const activitatData = result.rows[0];

      if (!activitatData) {
        return res.status(404).send("No s'ha trobat el subgrup");
      }

      res.status(200).json(activitatData);
    }
  } catch (error) {
    console.error('❌ Error obtenint les dades:', error);
    res.status(500).send('Error obtenint les dades');
  } finally {
    if (connection) await connection.close();
  }
};

const getGrup = async (req, res) => {
  let connection;
  try {
    connection = await db();
    const grup = req.params.grup;

    if (!grup) {
      console.error('❌ Falta el paràmetre grup:', error);
      res.status(400).send('❌ Falta el paràmetre grup');
    } else {
      const result = await connection.execute(
        `SELECT
            ga.codi AS "codi_grup",
            ga.descripcio AS "descripcio_grup"
        FROM ecpu_grup_activitat ga
        WHERE ga.descripcio = :grup`,
        {
          grup: grup
        },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const activitatData = result.rows[0];

      if (!activitatData) {
        return res.status(404).send("No s'ha trobat el grup");
      }

      res.status(200).json(activitatData);
    }
  } catch (error) {
    console.error('❌ Error obtenint les dades:', error);
    res.status(500).send('Error obtenint les dades');
  } finally {
    if (connection) await connection.close();
  }
};

const getZones = async (req, res) => {
  let connection;
  try {
    connection = await db();

    const result = await connection.execute(
      `SELECT ID, CODI FROM ECPU_ZONA`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // Convertim els LOBs a string
    const rows = await Promise.all(result.rows.map(async row => {
      return row;
    }));

    if (rows.length === 0) {
      return res.status(404).send('No s\'ha trobat cap zona');
    }

    res.status(200).json(rows);

  } catch (error) {
    console.error('❌ Error obtenint les dades:', error);
    res.status(500).send('Error obtenint les dades');
  } finally {
    if (connection) await connection.close();
  }
};

const getArees = async (req, res) => {
  let connection;
  try {
    connection = await db();

    const result = await connection.execute(
      `SELECT a.ID, z.codi || '.' || a.codi AS codi
        FROM ECPU_ZONA z
        JOIN ecpu_area_tractament a ON a.id_zona = z.id`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // Convertim els LOBs a string
    const rows = await Promise.all(result.rows.map(async row => {
      return row;
    }));

    if (rows.length === 0) {
      return res.status(404).send('No s\'ha trobat cap zona');
    }

    res.status(200).json(rows);

  } catch (error) {
    console.error('❌ Error obtenint les dades:', error);
    res.status(500).send('Error obtenint les dades');
  } finally {
    if (connection) await connection.close();
  }
};

const updateActivitat = async (req, res) => {
  let connection;
  try {
    const { activitat } = req.body;

    connection = await db();

    switch (activitat.editing) {
      case 1:
        const result1 = await connection.execute(
          `UPDATE ecpu_grup_activitat SET DESCRIPCIO = :descripcio WHERE CODI = :codi`,
          {
            descripcio: activitat.descripcio_grup,
            codi: activitat.codi_grup
          },
          { autoCommit: true }
        );

        if (result1.rowsAffected === 0) {
          return res.status(404).send('Grup no trobat.');
        }

        break;
      case 2:
        const result2 = await connection.execute(
          `UPDATE ecpu_subgrup_activitat SET DESCRIPCIO = :descripcio WHERE ID = :id`,
          {
            descripcio: activitat.descripcio_subgrup,
            id: activitat.id_subgrup
          },
          { autoCommit: true }
        );

        if (result2.rowsAffected === 0) {
          return res.status(404).send('Subgrup no trobat.');
        }
        break;
      case 3:
        const result3 = await connection.execute(
          `UPDATE ecpu_descripcio_activitat SET DESCRIPCIO = :descripcio, MOSTRAR = :mostar, id_epigraf = :epigraf_id WHERE ID = :id`,
          {
            descripcio: activitat.descripcio_activitat,
            mostar: activitat.mostrar ? 1 : 0,
            id: activitat.id_activitat,
            epigraf_id: activitat.id_epigraf
          },
          { autoCommit: true }
        );

        if (result3.rowsAffected === 0) {
          return res.status(404).send('Activitat no trobada.');
        }
        break;
      default:
        break;
    }

    res.status(200).send('Epígraf actualitzat correctament.');
  } catch (error) {
    console.error('❌ Error actualitzant l\'epígraf:', error);
    res.status(500).send('Error actualitzant l\'epígraf.');
  } finally {
    if (connection) await connection.close();
  }
};

const createGrup = async (req, res) => {
  let connection;
  try {
    const { grup } = req.body;

    connection = await db();

    const nextCodiResult = await connection.execute(
      `SELECT NVL(MAX(CODI), 0) + 1 AS NEXT_CODI FROM ECPU_GRUP_ACTIVITAT`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    let codiGrup = nextCodiResult.rows[0].NEXT_CODI;

    const result1 = await connection.execute(
      `INSERT INTO ecpu_grup_activitat (codi, descripcio) VALUES (:codi, :descripcio)`,
      {
        codi: codiGrup,
        descripcio: grup.descripcio_grup,
      },
      { autoCommit: true }
    );

    if (result1.rowsAffected === 0) {
      return res.status(404).send('Grup no creat.');
    }

    res.status(200).send('Grup creat correctament.');
  } catch (error) {
    console.error('❌ Error creant el grup:', error);
    res.status(500).send('Error creant el grup.');
  } finally {
    if (connection) await connection.close();
  }
};

const createSubgrup = async (req, res) => {
  let connection;
  try {
    const { grup, subgrup } = req.body;

    if (!grup) {
      return res.status(404).send('Falta el camp grup.');
    }

    if (!subgrup) {
      return res.status(404).send('Falta el camp subgrup.');
    }

    connection = await db();

    const nextCodiResult = await connection.execute(
      `SELECT NVL(MAX(ID), 0) + 1 AS NEXT_CODI FROM ECPU_SUBGRUP_ACTIVITAT`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    let codiSubrup = nextCodiResult.rows[0].NEXT_CODI;

    const codiGrup = await connection.execute(
      `SELECT CODI FROM ECPU_GRUP_ACTIVITAT WHERE DESCRIPCIO = :descripcio`,
      { descripcio: grup },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );    

    const result1 = await connection.execute(
      `INSERT INTO ecpu_subgrup_activitat (id, descripcio, CODI, CODI_GRUP_ACTIVITAT) VALUES (:id, :descripcio, 1, :codi_grup)`,
      {
        id: codiSubrup,
        descripcio: subgrup.descripcio_subgrup,
        codi_grup: codiGrup.rows[0].CODI
      },
      { autoCommit: true }
    );

    if (result1.rowsAffected === 0) {
      return res.status(404).send('Grup no creat.');
    }

    res.status(200).send('Grup creat correctament.');
  } catch (error) {
    console.error('❌ Error creant el grup:', error);
    res.status(500).send('Error creant el grup.');
  } finally {
    if (connection) await connection.close();
  }
};

const createActivitat = async (req, res) => {
  let connection;
  try {
    const { activitat } = req.body;

    if (!activitat.grup) {
      return res.status(404).send('Falta el camp grup.');
    }

    if (!activitat.subgrup) {
      return res.status(404).send('Falta el camp subgrup.');
    }

    if (!activitat.epigraf) {
      return res.status(404).send('Falta el camp epigraf.');
    }

    if (!activitat.activitat.descripcio_activitat) {
      return res.status(404).send('Falta el camp descripcio.');
    }

    connection = await db();

    const nextCodiResult = await connection.execute(
      `SELECT NVL(MAX(ID), 0) + 1 AS NEXT_CODI FROM ECPU_DESCRIPCIO_ACTIVITAT`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    let codiActivitat = nextCodiResult.rows[0].NEXT_CODI;

    const codiSubgrup = await connection.execute(
      `SELECT ID FROM ECPU_SUBGRUP_ACTIVITAT WHERE DESCRIPCIO = :descripcio`,
      { descripcio: activitat.subgrup },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );    

    const result1 = await connection.execute(
      `INSERT INTO ecpu_descripcio_activitat (ID, ID_SUBGRUP_ACTIVITAT, ID_EPIGRAF, CODI, DESCRIPCIO, MOSTRAR) VALUES (:id, :id_subgrup, :id_epigraf, 1, :descripcio, :mostrar)`,
      {
        id: codiActivitat,
        id_subgrup: codiSubgrup.rows[0].ID,
        id_epigraf: activitat.epigraf,
        descripcio: activitat.activitat.descripcio_activitat,
        mostrar: activitat.activitat.mostrar ? 1 : 0
      },
      { autoCommit: true }
    );

    if (result1.rowsAffected === 0) {
      return res.status(404).send('Activitat no creada.');
    }

    res.status(200).send('Activitat creada correctament.');
  } catch (error) {
    console.error('❌ Error creant l\'activitat:', error);
    res.status(500).send('Error creant l\'activitat.');
  } finally {
    if (connection) await connection.close();
  }
};

module.exports = {
  getActivitats,
  consultaActivitat,
  getAllActivitats,
  pdfConsulta,
  getActivitat,
  getSubgrup,
  getGrup,
  getZones,
  getArees,
  updateActivitat,
  createGrup,
  createSubgrup,
  createActivitat
};

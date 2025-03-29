const fs = require('fs');
const xlsx = require('xlsx');
const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});

db.connect(err => {
  if (err) {
    console.error('Error connectant a la base de dades:', err);
    return;
  }
  console.log('📦 Connexió a MariaDB establerta');
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No s\'ha proporcionat cap fitxer');
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    for (const row of data) {
      if (!row || row.length < 4 || !row[0]) continue; // Evita processar files buides o sense codi mínim

      const codiParts = row[0].toString().split('.');

      let idDescripcioActivitat = null;


      idDescripcioActivitat = (
        await db.promise().query(
          'SELECT da.id FROM grup_activitat ga JOIN pla_usos.subgrup_activitat sa on ga.codi = sa.codi_grup_activitat JOIN pla_usos.descripcio_activitat da on sa.id = da.id_subgrup_activitat WHERE ga.codi = ? AND sa.codi = ? AND da.codi = ?',
          [codiParts[0], codiParts[1], codiParts[2]]
        )
      )[0][0]?.id;

      if (idDescripcioActivitat) {
        for (let index = 2; index <= 12; index++) {
          const condicions = row[index].toString().split('-');
          for (const condicio of condicions) {
            let condicioId = condicio.replace(/\s+/g, "");;
            let valor = "";
            
            if (condicioId.length > 3) {
              const match = condicioId.match(/(\d+)\((\d+)\)/);
              if (match) {
                condicioId = match[1];
                valor = match[2];

              } else {
                console.log("No s'ha trobat cap coincidència.");
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
              await db.promise().query(
                'INSERT INTO zona_activitat_condicio (zona_id, descripcio_activitat_id, condicio_id, valor) VALUES (?, ?, ?, ?)',
                [zones[index], idDescripcioActivitat, condicioId, valor == "" ? null : valor]
              );
            } else {
              await db.promise().query(
                'INSERT INTO area_activitat_condicio (area_id, descripcio_activitat_id, condicio_id, valor) VALUES (?, ?, ?, ?)',
                [arees[index], idDescripcioActivitat, condicioId, valor == "" ? null : valor]
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
  }
});


app.listen(PORT, () => {
  console.log(`🚀 Backend executant-se a http://localhost:${PORT}`);
});

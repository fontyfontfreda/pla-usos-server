const express = require('express');
const multer = require('multer');
const condicioController = require('../controllers/condicioController');
const adrecaController = require('../controllers/adrecaController');
const zonaController = require('../controllers/zonaController');
const activitatController = require('../controllers/activitatController');
const authController = require('../controllers/authController');
const usuariController = require('../controllers/usuariController');
const consultaController = require('../controllers/consultaController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.get('/health', (req, res) => {res.send(200, { message: 'ok' });});

// Ruta d'autenticació (no protegida)
router.post('/login', authController.login);
router.post('/register', authController.register);

//ADRECES
router.get('/adreces', adrecaController.getAdreces);

//ZONES/ÀREES
router.get('/zones', zonaController.getZones);

//ACTIVITATS
router.get('/activitats/:domcod', activitatController.getActivitats);
router.post('/activitats/consulta', activitatController.consultaActivitat);


// Protegir totes les rutes amb JWT middleware (a excepció de les rutes de login i registre)
router.use(authMiddleware.verifyToken);

//ADRECES
router.post('/uploadAdreces', upload.single('file'), adrecaController.uploadAdreces);
router.put('/adreces/:domcod', upload.single('imatge'), adrecaController.actualitzarAdreca);

//CONDICIONS
router.post('/upload-epigrafs', upload.single('file'), condicioController.processEpigrafUpload);
router.post('/upload-condicions', upload.single('file'), condicioController.processCondicionsUpload);
router.get('/epigrafs', condicioController.getEpigrafs);
router.post('/epigrafs', condicioController.createEpigraf);
router.get('/epigrafs/:id', condicioController.getEpigraf);
router.put('/epigrafs/condicio', condicioController.updateCondicio);
router.put('/epigrafs/epigraf', condicioController.updateEpigraf);

//ZONES/ÀREES
router.post('/zones/zona', zonaController.createZona);
router.post('/zones/area', zonaController.createArea);
router.delete('/zones/zona', zonaController.deleteZona);
router.delete('/zones/area', zonaController.deleteArea);

//USUARIS
router.get('/usuaris', usuariController.getUsuaris);
router.put('/usuaris/:usuari/contrasenya', usuariController.updateContrasenya);
router.delete('/usuaris/:usuari', usuariController.deleteUsuari);

//CONSULTES
router.get('/consultes', consultaController.getConsultes);
router.get('/consultes/generarPDF/:consultaId', activitatController.pdfConsulta);

//ACTIVITATS
router.get('/activitats', activitatController.getAllActivitats);
router.get('/activitats/activitat/:activitat/:subgrup/:grup', activitatController.getActivitat);
router.get('/activitats/subgrup/:subgrup/:grup', activitatController.getSubgrup);
router.get('/activitats/grup/:grup', activitatController.getGrup);
router.put('/activitats/zones', activitatController.getZones);
router.put('/activitats/arees', activitatController.getArees);
router.put('/activitats/activitat', activitatController.updateActivitat);
router.post('/activitats/grup', activitatController.createGrup);
router.post('/activitats/subgrup', activitatController.createSubgrup);
router.post('/activitats/activitat', activitatController.createActivitat);

// Ruta protegida amb JWT
router.get('/protected', (req, res) => {
  res.send('Aquesta és una ruta protegida');
});

module.exports = router;

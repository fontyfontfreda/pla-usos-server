const express = require('express');
const multer = require('multer');
const condicioController = require('../controllers/condicioController');
const adrecaController = require('../controllers/adrecaController');
const zonaController = require('../controllers/zonaController');
const activitatController = require('../controllers/activitatController');
const authController = require('../controllers/authController');
const usuariController = require('../controllers/usuariController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Ruta d'autenticació (no protegida)
router.post('/login', authController.login);
router.post('/register', authController.register);
router.get('/adreces', adrecaController.getAdreces);
router.get('/zones', zonaController.getZones);
router.get('/activitats/:domcod', activitatController.getActivitats);

// Protegir totes les rutes amb JWT middleware (a excepció de les rutes de login i registre)
router.use(authMiddleware.verifyToken);

//ADRECES
router.post('/uploadAdreces', upload.single('file'), adrecaController.uploadAdreces);

//CONDICIONS
router.post('/upload', upload.single('file'), condicioController.processUpload);

//ZONES/ÀREES
router.post('/zones/zona', zonaController.createZona);
router.post('/zones/area', zonaController.createArea);
router.delete('/zones/zona', zonaController.deleteZona);
router.delete('/zones/area', zonaController.deleteArea);

//ACTIVITATS
router.post('/activitats/consulta', activitatController.consultaActivitat);

//USUARIS
router.get('/usuaris', usuariController.getUsuaris);
router.put('/usuaris/:usuari/contrasenya', usuariController.updateContrasenya);
router.delete('/usuaris/:usuari', usuariController.deleteUsuari);


// Ruta protegida amb JWT
router.get('/protected', (req, res) => {
  res.send('Aquesta és una ruta protegida');
});

module.exports = router;

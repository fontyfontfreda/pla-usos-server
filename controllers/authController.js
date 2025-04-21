const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const userModel = require('../models/user'); // El model d'usuari

// Funció de login
const login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await userModel.findUserByUsername(username);

    if (!user) {
      return res.status(401).json({ message: 'Usuari o contrasenya incorrectes' });
    }

    // Validació afegida: assegurem-nos que el password de la BBDD existeix
    if (!user.password) {
      return res.status(500).json({ message: 'Error intern: no s\'ha trobat la contrasenya de l\'usuari' });
    }

    const isPasswordValid = bcrypt.compareSync(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Usuari o contrasenya incorrectes' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET_KEY,
      { expiresIn: '1h' }
    );

    res.json({ token });
  } catch (error) {
    console.error('❌ Error al fer login:', error);
    res.status(500).json({ message: 'Error al processar la sol·licitud' });
  }
};

// Funció per crear un nou usuari
const register = async (req, res) => {
  const { username, password } = req.body;

  // Comprovar si l'usuari ja existeix
  const existingUser = await userModel.findUserByUsername(username);
  if (existingUser) {
    return res.status(400).send('L\'usuari ja existeix');
  }

  // Crear un nou usuari
  const newUser = await userModel.createUser(username, password);

  // Retornar l'usuari creat
  res.status(201).json({ message: 'Usuari creat amb èxit', user: newUser });
};

module.exports = { login, register };

'use strict';

//////////////// Modulos a usar /////////////////////////
require('dotenv').config();
const express = require('express');
const path = require('path');
const router = require('./routes');
const bodyParser = require('body-parser');

const app = express();
const morgan = require('morgan');
const cors = require('cors');

app.use(morgan('dev'));
app.use(cors());

/////////////////// MIDDLEWARES //////////////////////////
// Body Parser transforma el json que recibe en estructura de peticion automaticamente
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/', router);

// MIDDLEWARE CONTROLADOR DE ERRORES
//Errores previos a Middleware llegan aqui
app.use((error, request, response, next) => {
  console.log(error);
  response.status(error.httpCode || 500).send({ message: error.message });
});

// Middleware not found
app.use((request, response) => {
  response.status(404).send({ message: '❌ Page not found!😢' });
});

//////////////// SERVER //////////////////////
// Configuracion puertos server
const { PORT } = process.env;
const portAssigned = PORT;
app.set('port', portAssigned || 3002);
const port = app.get('port');
app.listen(port, () => {
  console.log(`✔️ 🚀 >>>> Server working on PORT ${port}  <<<< 🚀 ✔️`);
});

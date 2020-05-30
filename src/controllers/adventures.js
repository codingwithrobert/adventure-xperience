'use strict';

// Modulos Requeridos
const { getConnection } = require('../database');
const { adventuresSchema } = require('../models/adventures');
const { formatDateToDB, errorGenerator } = require('../helpers');
let connection;

const adventureController = {
  list: async (request, response, next) => {
    try {
      connection = await getConnection();
      const [adventures] = await connection.query(`SELECT * FROM adventures;`);
      response.send({
        status: 200,
        data: adventures
      });
    } catch (error) {
      next(error);
    }
  },
  create: async (request, response, next) => {
    try {
      await adventuresSchema.validateAsync(request.body);

      const {
        name,
        description,
        image,
        price,
        country,
        city,
        vacancy,
        date_selected
      } = request.body;
      if (
        !name ||
        !description ||
        !image ||
        !price ||
        !country ||
        !city ||
        !vacancy ||
        !date_selected
      ) {
        errorGenerator('Please fill all the fields required', 404);
      }
      connection = await getConnection();
      await connection.query(
        'INSERT INTO adventures(name, description, image, price, country, city, vacancy, date_selected) VALUES(":name", ":description", ":image", ":price", ":country", ":city", ":vacancy", ":date_selected");',
        {
          ':name': name,
          ':description': description,
          ':image': image,
          ':price': price,
          ':country': country,
          ':city': city,
          ':vacancy': vacancy,
          ':date_selected': formatDateToDB(new Date())
        }
      );

      response.send({
        status: 200,
        data: {
          name,
          description,
          image,
          price,
          country,
          city,
          vacancy,
          date_selected
        },
        message: 'Adventure added succesfully.'
      });
    } catch (error) {
      next(error);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  },
  delete: async (request, response, next) => {
    response.send('Borra la aventura');
  }
};

module.exports = { adventureController };

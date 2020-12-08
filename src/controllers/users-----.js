'use strict';

// Modulos Requeridos
require('dotenv').config();
const {
  SECRET_KEY,
  PUBLIC_HOST,
  PUBLIC_UPLOADS,
  PROFILE_IMAGE_DEFAULT_MEN,
  PROFILE_IMAGE_DEFAULT_WOMEN,
  PROFILE_IMAGE_DEFAULT_OTHER,
  LOGIN_HOST_VUE,
  USERS_UPLOADS_DIR,
  USERS_VIEW_UPLOADS,
  SERVICE_EMAIL,
  ADMIN_EMAIL,
  PASSWORD_ADMIN_EMAIL,
  LOGO_PATH
} = process.env;

const {
  getConnection
} = require('../database');

const jwt = require('jsonwebtoken');

const {
  usersSchema,
  loginSchema,
  newPasswordSchema,
  registerUsersSchema,
  updateDataUsersSchema
} = require('../validations');

const {
  helpers
} = require('../helpers');
const path = require('path');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const validations = require('../validations');

const dateNow = helpers.formatDateToDB(new Date());
const creating_date = helpers.formatDateJSON(new Date());


let connection;

const usersController = {
  create: async (request, response, next) => {
    try {

      // we validate data body received 
      await registerUsersSchema.validateAsync(request.body);
      const {
        name,
        surname,
        date_birth,
        genre,
        country,
        city,
        email,
        password,
        image
      } = request.body;

      const capitalizeName = await helpers.capitalize(name);
      const capitalizeSurname = await helpers.capitalize(surname);

      // we open connection to db
      connection = await getConnection();

      // we check if the email exist into db
      const [existingEmail] = await connection.query(`SELECT id FROM users WHERE email=?`, [email]);

      if (existingEmail.length) {
        return response.status(409).json({
          status: 'error',
          code: 409,
          message: `El email ${email} ya esta registrado`
        });
      }

      // we hash the password to save into db
      const passwordDB = await bcrypt.hash(password, 10);

      // code to activate account
      const regCode = helpers.randomString(20);

      /* name userfolder
      const emailUuid = uuid.v4(email);*/

      // path where it is save the userdata
      const userImagePath = path.join(__dirname, `../${USERS_UPLOADS_DIR}` /*, `${emailUuid}`*/ );

      // we process image file that we receive into the body
      let savedFileName;
      if (request.files && request.files.image) {

        try {
          let uploadImageBody = request.files.image;
          // we define location path and image size values
          let savedFileNameProcess = await helpers.processAndSavePhoto(userImagePath, uploadImageBody, 300, 300);

          savedFileName = path.join(`./uploads/users/`, savedFileNameProcess);

          console.log(savedFileName);
        } catch (error) {
          return response.status(400).json({
            status: 'error',
            code: 400,
            message: 'La imagen no ha sido procesada correctamente ,por favor intentalo de nuevo'
          });
        }

      } else {
        if (!request.files || image === null || image === undefined) {
          if (genre === 'Hombre') {
            savedFileName = path.join(`./uploads`, `${PROFILE_IMAGE_DEFAULT_MEN}`);
          } else if (genre === 'Mujer') {
            savedFileName = path.join(`./uploads`, `${PROFILE_IMAGE_DEFAULT_WOMEN}`);
          } else {
            savedFileName = path.join(`./uploads`, `${PROFILE_IMAGE_DEFAULT_OTHER}`);
          }
        } else {
          savedFileName = image;

        }
      }

      if (genre === null || genre === undefined || Error === `Data truncated for column
        genre ' at row 1' `) {
        return response.status(400).json({
          status: 'error',
          code: 500,
          message: 'El campo genero es obligatorio'
        });
      }
      // we generate the image link with the path to save into db and to show in front
      let image4Vue = path.join(`${PUBLIC_HOST}`, `./${USERS_VIEW_UPLOADS}`, `./${savedFileName}`);
      // let folderUserDataDB = path.join(`${__dirname}`, `./${USERS_VIEW_UPLOADS}`, `./${emailUuid}`);

      // Postman
      let role;

      if (name === 'Robert' && surname === 'Hernández' && email === 'airbusjayrobert@gmail.com') {
        role = 'admin'
      } else {
        role = 'user'
      }

      // we save all data into db
      const [newUserData] = await connection.query(`
        INSERT INTO users(name, surname, date_birth, genre, country, city, email, role, password, last_password_update, image, creation_date, ip, reg_Code)
        VALUES( ? , ? , ? , ?, ? , ? , ?, ?, ?, CURRENT_TIMESTAMP(), ? , CURRENT_TIMESTAMP(), ? , ? );
        `,
        [capitalizeName, capitalizeSurname, date_birth, genre, country, city, email, role, passwordDB, savedFileName, request.ip, regCode]);

      // we send an email with the activation link for user account 
      const userValidationLink = `${PUBLIC_HOST}/users/${newUserData.insertId}/activate?code=${regCode}`;
      const pathImageEmail = path.join(__dirname, `../${PUBLIC_UPLOADS}`, `${LOGO_PATH}`);


      if (!existingEmail.length.error) {
        try {
          const transporter = nodemailer.createTransport({
            service: SERVICE_EMAIL,
            auth: {
              user: ADMIN_EMAIL,
              pass: PASSWORD_ADMIN_EMAIL
            }
          });
          const mailOptions = {
            from: ADMIN_EMAIL,
            to: `${email}`,
            subject: `Activa tu cuenta en Aventura Xperience`,
            text: `Para validar la cuenta pega esta URL en tu navegador : ${userValidationLink}`,
            html: `
            <div>
              <img src="cid:logo" alt="Logo Aventura Xperience">
              <h1> Activa tu cuenta en Aventura Xperience </h1>
              <p> Para validar la cuenta pega esta URL en tu navegador: ${userValidationLink} o pulsa click en el siguiente enlace:
              <a href="${userValidationLink}" target="_blank">Activa tu cuenta dando click aquí!</a>
              </p>
            </div>`,
            attachments: [{
              filename: 'logo.png',
              path: pathImageEmail,
              cid: 'logo' // cid value as in the html img src
            }]
          };

          transporter.sendMail(mailOptions, (error, info) => {
            console.log("Email enviado");
            response.status(200).json(request.body);

          });

        } catch (error) {
          console.log(error);
          if (error) {
            response.status(500).send(error.message);
          }
        }

      } else {
        return response.status(500).json({
          status: 'error',
          code: 500,
          message: `No se pudo enviar el email debido a un error en el servidor`
        });
      }

      // if everything ok, we send all data to json format
      response.send({
        status: 200,
        data: {
          id: newUserData.insertId,
          name: capitalizeName,
          surname: capitalizeSurname,
          date_birth: date_birth,
          genre: genre,
          email: email,
          password: passwordDB,
          image: savedFileName,
          role: role,
          creation_date: creating_date,
          ip: request.ip,
          regCode_: regCode
        },
        message: `Verifica tu buzón de correo email para activar tu cuenta.`
      });
    } catch (error) {
      next(error);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  },
  list: async (request, response, next) => {
    try {
      // we open connection to db
      connection = await getConnection();

      // we build a SQL query to list all users
      const [result] = await connection.query(`
        SELECT id, name, surname, date_birth, 
        country, city, email, image, role, creation_date
        FROM users;`);

      if (!result.length) {
        return response.status(404).json({
          status: 'error',
          code: 400,
          message: `No existen usuarios aún`
        });
      }
      response.send({
        status: 200,
        data: result,
        message: 'Lista de todos los usuarios creados'
      });


    } catch (error) {
      next(error);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  },
  get: async (request, response, next) => {
    try {

      // we receive params to get th search
      const {
        id
      } = request.params;

      // we open connection to db
      connection = await getConnection();

      // we build a SQL the query to look for user 
      const [result] = await connection.query(`
        SELECT * 
        FROM users 
        WHERE id = ?`,
        [id]);

      if (!result.length) {
        return response.status(400).json({
          status: 'error',
          code: 400,
          message: `El usuario con el id ${id} no existe,por favor intentalo de nuevo`
        });
      }
      const [userResult] = result;
      response.send({
        status: 200,
        data: userResult,
        message: `La busqueda del usuario con el id ${userResult.id} fue realizada con exito`
      });

    } catch (error) {
      next(error);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  },


  update: async (request, response, next) => {

    try {
      connection = await getConnection();

      await validations.updateDataUsersSchema.validateAsync(request.body);
      let {
        name,
        surname,
        country,
        city,
        genre,
        image
      } = request.body;
      const {
        id
      } = request.params;



      const [current] = await connection.query(`
        SELECT name, surname, date_birth, image ,email, country, city, password, role
        FROM users 
        WHERE id=?`,
        [id]);

      // path where it is save the userdata
      const userImagePath = path.join(__dirname, `../${USERS_UPLOADS_DIR}`);
      console.log(userImagePath, current[0].image);

      if (!current.length) {
        return response.status(400).json({
          status: 'error',
          code: 400,
          message: `El usuario con el id ${id} no existe`
        });

      };

      // we process image file that we receive into the body
      let savedFileName;
      if (request.files && request.files.image) {

        try {
          let uploadImageBody = request.files.image;
          // we define location path and image size values
          let savedFileNameProcess = await helpers.processAndSavePhoto(userImagePath, uploadImageBody, 300, 300);

          savedFileName = path.join(`./uploads/users/`, savedFileNameProcess);

          console.log(savedFileName);
        } catch (error) {
          return response.status(400).json({
            status: 'error',
            code: 400,
            message: 'La imagen no ha sido procesada correctamente ,por favor intentalo de nuevo'
          });
        }

      } else {
        if (!request.files || image === null || image === undefined) {
          if (genre === 'Hombre') {
            savedFileName = path.join(`./uploads`, `${PROFILE_IMAGE_DEFAULT_MEN}`);
          } else if (genre === 'Mujer') {
            savedFileName = path.join(`./uploads`, `${PROFILE_IMAGE_DEFAULT_WOMEN}`);
          } else {
            savedFileName = path.join(`./uploads`, `${PROFILE_IMAGE_DEFAULT_OTHER}`);
          }
        } else {
          savedFileName = image;

        }
      }

      /// GENRE
      if (genre === null || genre === undefined) {
        genre = 'Hombre';
      }


      await connection.query(`
        UPDATE users 
        SET name =? , surname =? , country =? , city =?, genre=?, last_password_update =CURRENT_TIMESTAMP(), image =? , modify_date =CURRENT_TIMESTAMP(), ip =?
        WHERE id=?`,
        [name, surname, country, city, genre, savedFileName, request.ip, id]);

      response.send({
        status: 200,
        data: {
          id,
          name: name,
          surname: surname,
          country: country,
          city: city,
          genre: genre,
          role: current[0].role,
          last_password_update: dateNow,
          image: savedFileName,
          modify_date: creating_date,
          ip: request.ip
        },
        message: `El usuario con el id ${id} fue modificada satisfactoriamente`
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
    try {
      const {
        id
      } = request.params;
      connection = await getConnection();

      const [result] = await connection.query(`
        SELECT image, user_folder
        FROM users  
        WHERE id=?`,
        [id]);


      if (!result.length) {
        return response.status(404).json({
          status: 'error',
          message: `El usuario con el id ${id} no existe`
        });
      };

      const [destructuringImageUserFolder] = result;
      const {
        image,
        user_folder
      } = destructuringImageUserFolder;

      if (result && image) {
        await helpers.deletePhoto(user_folder, image);
        await helpers.deleteFolder(user_folder);
      } else {
        return response.status(400).json({
          status: 'error',
          code: 400,
          message: `La foto del usuario con el id ${id} no se pudo procesar correctamente`
        });
      }

      await connection.query(`DELETE FROM users WHERE id=?`, [id]);
      response.send({
        status: 200,
        message: `El usuario con el id ${id} ha sido borrado con éxito `
      });

    } catch (error) {
      next(error);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  },

  activate: async (request, response, next) => {
    try {

      // we open connection to db and get user id and code activation
      connection = await getConnection();
      const {
        id
      } = request.params;
      const {
        code
      } = request.query;

      // we build a SQL query to update and to activate the user account
      const [result] = await connection.query(`
        UPDATE users
        SET isActive=1, reg_code=NULL
        WHERE id=?
        AND reg_code=? `,
        [id, code]);

      if (result.affectedRows === 0) {
        return response.redirect('http://localhost:8080/#/activation-error-account');
      }

      // if you need to use the token uncomment the following lines
      // we select user role from id
      /*const [user] = await connection.query(`
        SELECT role 
        FROM users 
        WHERE id=?`, 
        [id]);

      // we build the JSONWEBTOKEN
      const tokenPayload = {
        id: id,
        role: user[0].role
      };
      const token = jwt.sign({
        tokenPayload
      }, SECRET_KEY, {
        expiresIn: '30d'
      });*/

      return response.redirect('http://localhost:8080/#/activation-account');

    } catch (error) {
      next(error);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  },
  sendCode: async (request, response, next) => {
    try {

      const {
        email
      } = request.body;

      // we open connection to db
      connection = await getConnection();

      // we verify if user account is active
      const [isActivate] = await connection.query(`
        SELECT id, isActive, email 
        FROM users 
        WHERE email=?`,
        [email]);
      console.log(isActivate);

      if (isActivate === undefined || null) {
        return response.status(400).json({
          status: 'error',
          code: 400,
          message: `La cuenta con el email ${email} no coincide con ninguna en nuestra base de datos`
        });
      }

      const [destructuringIsActiveAndEmail] = isActivate;
      if (!destructuringIsActiveAndEmail) {
        return response.status(400).json({
          status: 'error',
          code: 400,
          message: `La cuenta con el email ${email} no coincide con ninguna en nuestra base de datos`
        });
      }
      const {
        isActive,
        id
      } = destructuringIsActiveAndEmail;
      if (isActive === 1) {

        return response.status(400).json({
          status: 'error',
          code: 400,
          message: `La cuenta con el email ${email} ya esta activada`
        });

      }




      // code to activate account
      const newCode = helpers.randomString(20);

      // we set reg_code into db
      const [result] = await connection.query(`
        UPDATE users
        SET reg_code=?
        WHERE id=?`,
        [newCode, id]);
      console.log(result);

      if (!result.affectedRows === 0) {
        return response.status(400).json({
          status: 'error',
          code: 400,
          message: `No se pudo generar un nuevo codigo de activación ,la cuenta ya esta activada o hubo un error en el servidor, ponte en contacto con el admin : airbusjayrobert@gmail.com`
        });

      }

      // we send an email with the activation link for user account 
      const userValidationLink = `${PUBLIC_HOST}/users/${id}/activate?code=${newCode}`;

      try {
        const transporter = nodemailer.createTransport({
          service: SERVICE_EMAIL,
          auth: {
            user: ADMIN_EMAIL,
            pass: PASSWORD_ADMIN_EMAIL
          }
        });
        const mailOptions = {
          from: ADMIN_EMAIL,
          to: `${email}`,
          subject: `Nuevo codigo de activación cuenta Aventura Xperience`,
          text: `Para validar la cuenta pega esta URL en tu navegador : ${userValidationLink}`,
          html: `
            <div>
              <h1> Nuevo codigo de activación cuenta en Aventura Xperience </h1>
              <p> Para validar la cuenta pega esta URL en tu navegador: ${userValidationLink} o pulsa click en el siguiente enlace:
              <a href="${userValidationLink}" target="_blank">Activa tu cuenta dando click aquí!</a>
              </p>
            </div>`
        };

        transporter.sendMail(mailOptions, (error, info) => {
          response.status(200).json(request.body);

        });

      } catch (error) {
        console.log(error);
        if (error) {
          response.status(500).send(error.message);
        }
      }


      // if everything ok, we send all data to json format
      response.send({
        status: 200,
        message: `Se ha enviado un nuevo codigo, verifica tu buzón de correo para activar tu cuenta.`
      });
    } catch (error) {
      next(error);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  },
  recoveryPassword: async (request, response, next) => {
    try {

      const {
        email
      } = request.body;

      // we open connection to db
      connection = await getConnection();
      const newPass = helpers.randomString(10);

      // we check if the email exist into db
      const [existingUser] = await connection.query(`
        SELECT id , name, surname
        FROM users 
        WHERE email=?`,
        [email]);

      if (!existingUser.length) {
        return response.status(400).json({
          status: 'error',
          code: 400,
          message: `El email ${email} No esta asociado a ningun usuario, verificalo o crea una nueva cuenta`
        });
      }
      console.log(existingUser);

      // new password encrypted
      const passwordDB = await bcrypt.hash(newPass, 10);

      // we set reg_code into db
      const [result] = await connection.query(`
        UPDATE users 
        SET password=?,
        last_password_update=?
        WHERE email=?
        `,
        [passwordDB, dateNow, email]);
      console.log(result);

      if (!result.affectedRows === 0) {
        return response.status(400).json({
          status: 'error',
          code: 400,
          message: `No se pudo generar una nueva password, ponte en contacto con el admin : airbusjayrobert@gmail.com`
        });

      }


      try {
        const transporter = nodemailer.createTransport({
          service: SERVICE_EMAIL,
          auth: {
            user: ADMIN_EMAIL,
            pass: PASSWORD_ADMIN_EMAIL
          }
        });
        const mailOptions = {
          from: ADMIN_EMAIL,
          to: `${email}`,
          subject: `Restablecer password cuenta Aventura Xperience`,
          text: `Nueva password de acceso`,
          html: `
            <div>
              <h1>Nueva password cuenta Aventura Xperience</h1>
              <p>Hola ${existingUser[0].name} ${existingUser[0].surname}!</p>
              <p>Te hemos proporcionado una nueva password para que puedas acceder de nuevo a tu cuenta:</p>
              <p>Usuario: ${email}</p>
              <p>Password: ${newPass}</p>
              <p> =====>
              <a href="${LOGIN_HOST_VUE}" target="_blank">Haz login pulsando click aquí!</a> <=====
              </p>
            </div>`
        };

        transporter.sendMail(mailOptions, (error, info) => {
          response.status(200).json(request.body);

        });

      } catch (error) {
        console.log(error);
        if (error) {
          response.status(500).send(error.message);
        }
      }

      // if everything ok, we send all data to json format
      response.send({
        status: 200,
        message: `Se ha enviado una nueva password a tu email para iniciar sesión.`
      });
    } catch (error) {
      next(error);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  },
  login: async (request, response, next) => {
    try {
      await loginSchema.validateAsync(request.body);
      const {
        email,
        password
      } = request.body;
      connection = await getConnection();
      const [userEmailDB] = await connection.query(`
        SELECT *
        FROM users 
        WHERE email=? 
        AND isActive=1`,
        [email]);

      if (!userEmailDB.length) {
        return response.status(401).json({
          status: 'error',
          code: 401,
          message: `La cuenta con el email especificado no existe o no esta activado, activa tu cuenta`
        });
      }
      const [user] = userEmailDB;
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return response.status(401).json({
          status: 'error',
          code: 401,
          message: `Contraseña incorrecta`
        });
      }
      const tokenPayload = {
        id: user.id,
        name: user.name,
        surname: user.surname,
        country: user.country,
        city: user.city,
        email: user.email,
        role: user.role,
        image: user.image,
        creation_date: user.creation_date,
        modify_date: user.modify_date,
        last_password_update: user.last_password_update,
        ip: user.ip
      };
      const token = jwt.sign({
        tokenPayload
      }, SECRET_KEY, {
        expiresIn: '30d'
      });
      return response.status(200).json({
        data: {
          tokenPayload,
          token
        },
        message: `Bienvenid@ ${user.name} ${user.surname} `,
      });


    } catch (error) {
      next(error);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  },

  changePassword: async (request, response, next) => {
    try {
      connection = await getConnection();
      const {
        id
      } = request.params;

      // Body: oldPassword, newPassword, 
      await newPasswordSchema.validateAsync(request.body);

      const {
        oldPassword,
        newPassword,
        newPasswordRepeat
      } = request.body;

      const {
        tokenPayload
      } = request.authorization;
      console.log(tokenPayload);

      if (Number(id) !== tokenPayload.id) {
        return response.status(401).json({
          status: 'error',
          code: 401,
          message: `No tienes permisos para cambiar la password de usuario`
        });
      }

      if (newPassword !== newPasswordRepeat) {
        return response.status(400).json({
          status: 'error',
          code: 400,
          message: 'La nueva contraseña no coincide con su repetición'
        });
      }

      if (oldPassword === newPassword) {
        return response.status(401).json({
          status: 'error',
          code: 401,
          message: 'La contraseña nueva no puede ser la misma que la antigua'
        });

      }

      const [currentUser] = await connection.query(
        `
      SELECT id, password FROM users WHERE id=?
    `,
        [id]
      );

      if (!currentUser.length) {
        return response.status(404).json({
          status: 'error',
          code: 404,
          message: `El usuario con id: ${id} no existe`
        });

      }

      const [dbUser] = currentUser;

      // Comprobar la vieja password

      const passwordsMath = await bcrypt.compare(oldPassword, dbUser.password);

      if (!passwordsMath) {
        return response.status(401).json({
          status: 'error',
          code: 401,
          message: `Contraseña incorrecta`
        });
      }

      // hash nueva password

      const dbNewPassword = await bcrypt.hash(newPassword, 10);

      await connection.query(`
        UPDATE users 
        SET password=? ,last_password_update=? 
        WHERE id=?
    `,
        [dbNewPassword, dateNow, id]
      );

      response.send({
        status: 'ok',
        message: 'La contraseña se ha actualizado correctamente, vuelve a hacer login'
      });
    } catch (error) {
      next(error);
    } finally {
      if (connection) connection.release();
    }
  },
  deactivate: async (request, response, next) => {
    try {

      // we open connection to db and get user id and code activation
      connection = await getConnection();
      const {
        id
      } = request.params;

      // we select user role from id
      const [resultUser] = await connection.query(`
        SELECT role 
        FROM users 
        WHERE id=?`,
        [id]);

      const [user] = resultUser;
      const {
        role
      } = user;

      if (role === 'admin') {
        // we build a SQL query to update and to activate the user account
        const [result] = await connection.query(`
        UPDATE users
        SET isActive=0
        WHERE id=?
        `,
          [id]);

        if (result.affectedRows === 0) {
          return response.status(400).json({
            status: 'error',
            code: 400,
            message: `No se pudo desactivar el usuario`
          });
        }
      } else {
        return response.status(400).json({
          status: 'error',
          code: 400,
          message: `No tienes permisos de administrador`
        });
      }

      return response.status(200).json({
        message: `La cuenta ha sido desactidava`,
      });

    } catch (error) {
      next(error);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }


}

module.exports = {
  usersController
};
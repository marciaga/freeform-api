import Joi from 'joi';
import Boom from 'boom';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const userSchema = Joi.object().keys({
  _id: Joi.string(),
  email: Joi.string().email().required(),
  password: Joi.string(),
  displayName: Joi.string().required(),
  firstName: Joi.string(),
  lastName: Joi.string(),
  role: Joi.string().required(),
});

const getUserById = async (id, db) => {
  try {
    const result = await db.collection('users').findOne({ _id: id });

    return result;
  } catch (e) {
    console.log(e);
    return Boom.create(503, 'Service Unavailble', e);
  }
};


const createToken = (user, expiration = '7d') => {
  const {
    _id, email, role, displayName,
  } = user;
  const secret = process.env.JWT_SECRET_KEY;

  return jwt.sign(
    {
      id: _id,
      email,
      displayName,
      scope: role,
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: expiration,
    },
  );
};

/* Route Handlers */
const loginHandler = (request) => { // eslint-disable-line
  const { db } = request.server.plugins.mongodb;
  const { password } = request.payload;

  if (!request.pre.user.email) {
    return {
      success: false,
      code: 401,
      message: 'User not found',
    };
  }

  db.collection('users').findOne({ email: request.payload.email }, (err, user) => { // eslint-disable-line
    if (err) {
      console.log(err);
      return Boom.create(503, 'Service Unavailble');
    }

    if (!user) {
      return { success: false, message: 'Username/email not found' };
    }

    bcrypt.compare(password, user.password, (error, isValid) => {
      if (isValid) {
        const idToken = createToken(user);
        const {
          _id, email, displayName, role,
        } = user;

        return {
          id: _id,
          email,
          displayName,
          idToken,
          scope: role,
          verified: true,
        };
      }

      return { success: false, message: 'Bad credentials' };
    });
  });
  // TODO do we need to return anything?
};

// Fetch all users
const getUsers = (request) => {
  const { db } = request.server.plugins.mongodb;

  db.collection('users').find({}, {
    projection: {
      password: 0,
    },
  }, async (err, cursor) => {
    if (err) {
      console.log(err);
      return Boom.create(503, 'Service Unavailble');
    }

    const users = await cursor.toArray();

    return users;
  });
};

const hashPassword = (password, callback) => {
  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(password, salt, (error, hash) => callback(error, hash));
  });
};

// CREATE user method
const createUser = (request, h) => {
  const { db } = request.server.plugins.mongodb;

  const { err } = Joi.validate(request.payload, userSchema);

  if (err) {
    console.log(err);

    return {
      success: false,
      message: 'Validation Error',
    };
  }

  const {
    firstName,
    lastName,
    email,
    password,
    role,
    displayName,
  } = request.payload;

  hashPassword(password, (error, hash) => {
    if (error) {
      console.log(error);
      return Boom.badRequest();
    }
    // TODO - INSERT is deprecated
    db.collection('users').insert({
      displayName,
      email,
      password: hash,
      firstName,
      lastName,
      role,
    }, (mongoErr, user) => {
      if (mongoErr) {
        return Boom.serverUnavailable();
      }

      return h.response({ id_token: createToken(user) }).code(201);
    });
  });
};

const verifyToken = (request, h) => {
  const { authorization } = request.headers;

  if (authorization) {
    const token = authorization.split(' ').pop();

    jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
      if (err) {
        console.log('err', err);
        // return error message to client
        /*
                err = {
                    name: 'TokenExpiredError',
                    message: 'jwt expired',
                    expiredAt: 1408621000
                }
                */
        console.log(err);
        return Boom.unauthorized('Token Expired. Please Log In Again.');
      }

      return h.response({ ...decoded, verified: true }).code(201);
    });
  } else {
    return Boom.unauthorized();
  }
};

const verifyCredentials = (request) => {
  const { db } = request.server.plugins.mongodb;
  const { password } = request.payload;

  db.collection('users').findOne({ email: request.payload.email }, (err, user) => {
    if (err) {
      console.log(err);
      return Boom.serverUnavailable();
    }

    if (user) {
      bcrypt.compare(password, user.password, (error, isValid) => {
        if (isValid) {
          return user;
        }

        return { success: false, message: 'Incorrect Password' };
      });
    } else {
      return { success: false, message: 'Username/email not found' };
    }
  });
};

const verifyUniqueUser = (request) => {
  const { db } = request.server.plugins.mongodb;
  const { email } = request.payload;

  db.collection('users').findOne({ $or: [{ email }] }, (err, user) => {
    if (user && (user.email === email)) {
      return Boom.create(401, 'Email already taken!');
    }

    return request.payload;
  });
};

const updateUser = (request) => {
  const { db, ObjectID } = request.server.plugins.mongodb;
  const user = request.payload;

  const { err } = Joi.validate(user, userSchema);

  if (err) {
    return {
      success: false,
      message: 'Validation Failed',
    };
  }

  const userId = new ObjectID(user._id);
  const { _id, ...fieldsToUpdate } = user;
  // TODO - UPDATE is deprecated
  db.collection('users').update({ _id: userId },
    { $set: fieldsToUpdate },
    (e, result) => {
      if (e) {
        console.log('error in mongo', e);
        return Boom.serverUnavailable();
      }
      // response, e.g. { ok: 1, nModified: 1, n: 1 }
      const response = result.toJSON();
      const { ok, nModified } = response;

      if (ok && nModified) {
        return { success: true };
      }

      return { success: false, message: 'Update was not successful' };
    });
};

const deleteUser = (request) => {
  const { db, ObjectID } = request.server.plugins.mongodb;
  const { id } = request.query;
  const userId = new ObjectID(id);
  // TODO - REMOVE is deprecated
  db.collection('users').remove({ _id: userId }, { justOne: true }, (err, result) => {
    if (err) {
      console.log(err);
      return Boom.serverUnavailable();
    }
    // result, e.g. { ok: 1, n: 0 }
    const response = result.toJSON();
    const { ok, n } = response;

    if (ok && n) {
      return { success: true };
    }

    return { success: false, message: 'Update was not successful' };
  });
};

const verifyPassword = async (request, h) => {
  const { db, ObjectID } = request.server.plugins.mongodb;
  const { id } = request.params;
  const { name, fields } = request.payload;
  // if it's not the changePassword request, continue
  if (name !== 'changePassword') {
    return h.continue();
  }

  const { newPasswordFirst, newPasswordSecond } = fields;
  // if it is the changePassword request, verify the relevant fields match
  if (newPasswordFirst !== newPasswordSecond) {
    return {
      success: false,
      message: 'New password entries do not match.',
    };
  }

  const userId = new ObjectID(id);

  try {
    const user = await getUserById(userId, db);
    const { currentPassword } = fields;

    bcrypt.compare(currentPassword, user.password, (e, isValid) => {
      if (e) {
        console.log(e);
        return Boom.internal('Something went wrong with encryption...');
      }
      if (isValid) {
        // hash the password and return it to the route handler
        return hashPassword(newPasswordFirst, (err, hash) => {
          if (err) {
            return {
              success: false,
              message: 'Something went wrong...',
            };
          }
          return {
            success: true,
            password: hash,
          };
        });
      }

      return {
        success: false,
        message: 'Current password is incorrect.',
      };
    });
  } catch (e) {
    console.log(e);
    return Boom.internal('Something went wrong...');
  }
};

const updateField = async (id, fieldName, value, db, ObjectID) => {
  const userId = new ObjectID(id);

  try {
    // TODO - UPDATE is deprecated
    const result = await db.collection('users').update(
      { _id: userId },
      {
        $set: {
          [fieldName]: value,
        },
      },
    );

    return result.toJSON();
  } catch (e) {
    console.log(e);
    return false;
  }
};

const updateUserField = async (request) => {
  const { db, ObjectID } = request.server.plugins.mongodb;
  const { result } = request.pre;
  const { id } = request.params;
  const { name, fields } = request.payload;

  if (result && result.success) {
    try {
      const response = await updateField(
        id,
        'password',
        result.password,
        db,
        ObjectID,
      );
      const { ok, nModified } = response;

      if (ok && nModified) {
        return { success: true };
      }

      return { success: false, message: 'Update was not successful' };
    } catch (e) {
      console.log(e);
      return Boom.internal('Something went wrong');
    }
  }

  if (result && !result.success) {
    return result.message;
  }
  // @ma: currently, this block isn't being used, but it probably will later on
  try {
    const key = Object.keys(fields).find(f => fields[f]);
    const value = fields[key];
    const response = await updateField(
      id,
      name,
      value,
      db,
      ObjectID,
    );
    const { ok, nModified } = response;

    if (ok && nModified) {
      return { success: true };
    }

    return { success: false, message: 'Update was not successful' };
  } catch (e) {
    console.log(e);
    return Boom.internal('Something went wrong');
  }
};

const resetPassword = async (request) => {
  const { db, ObjectID } = request.server.plugins.mongodb;
  const { id } = request.params;
  const resetValue = process.env.TEMPORARY_USER_PASSWORD;

  try {
    const response = await updateField(
      id,
      'password',
      resetValue,
      db,
      ObjectID,
    );

    const { ok, nModified } = response;

    if (ok && nModified) {
      return { success: true };
    }

    return { success: false, message: 'Update was not successful' };
  } catch (e) {
    console.log(e);
    return Boom.internal('Something went wrong');
  }
};

export {
  getUsers,
  createToken,
  verifyToken,
  createUser,
  updateUser,
  deleteUser,
  loginHandler,
  resetPassword,
  verifyCredentials,
  verifyUniqueUser,
  verifyPassword,
  updateUserField,
  updateField,
  hashPassword,
};

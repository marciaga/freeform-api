import Joi from 'joi';
import R from 'ramda';
import Boom from 'boom';
import moment from 'moment-timezone';

moment.tz.setDefault('America/Los_Angeles');

const volunteerFormSchema = Joi.object().keys({
  userId: Joi.string().required(),
  category: Joi.string().required(),
  date: Joi.date().iso().required(),
  type: Joi.string().required(),
  hours: Joi.number().required(),
  comments: Joi.string().optional(),
});

export const postVolunteerForm = (request) => {
  const { db } = request.server.plugins.mongodb;
  const { payload } = request;

  const { error } = Joi.validate(payload, volunteerFormSchema);
  // send to sentry: error.details[0].message
  const handleError = () => Boom.badRequest('Failed validation');

  const addSubmission = async () => {
    try {
      // TODO - INSERT is deprecated
      const { result } = await db.collection('volunteerhours').insert(payload);

      const res = R.ifElse(
        () => result.ok === 1,
        () => ({ success: true }),
        () => ({ success: false }),
      );

      return res(result);
    } catch (e) {
      Boom.badRequest('Failed to insert document');
    }
  };

  const validation = R.ifElse(
    R.isNil,
    addSubmission,
    handleError,
  );

  validation(error);
};

export const getVolunteerReport = async (request) => {
  const { credentials } = request.auth;
  const { db, ObjectID } = request.server.plugins.mongodb;
  const {
    startDate, endDate, userId, type,
  } = request.query;

  const dates = startDate && endDate ? {
    date: {
      $gte: moment(startDate).toISOString(),
      $lte: moment(endDate).toISOString(),
    },
  }
    : false;

  const requestedByDj = credentials.scope === 'dj';
  const includeUserId = requestedByDj ? credentials.id : userId;
  /* eslint-disable no-nested-ternary */
  const criteria = dates && includeUserId ? {
    ...dates,
    userId: includeUserId,
  } : includeUserId ? {
    userId: includeUserId,
  } : dates ? { ...dates } : {};
    /* eslint-enable no-nested-ternary */

  if (type) {
    criteria.type = type;
  }

  try {
    const result = await db.collection('volunteerhours')
      .find(criteria)
      .sort({ date: 1 })
      .toArray();

    if (requestedByDj) {
      return result;
    }

    // query to join user first and last name
    const users = await db.collection('users')
      .find({
        _id: {
          $in: result.map(u => new ObjectID(u.userId)),
        },
      }, {
        projection: {
          firstName: 1,
          lastName: 1,
          email: 1,
        },
      })
      .toArray();

    const u = users.reduce((memo, key) => {
      memo[key._id] = { // eslint-disable-line
        name: `${key.firstName} ${key.lastName}`,
        email: key.email,
      };

      return memo;
    }, {});
    // map userIds and return a full name in the result array
    const transformed = result.map((r) => {
      const { _id, ...rest } = r;

      return {
        name: u[r.userId].name,
        email: u[r.userId].email,
        ...rest,
      };
    });

    return transformed;
  } catch (err) {
    console.log(err);
    return Boom.internal('Failed to generate volunteer report.');
  }
};

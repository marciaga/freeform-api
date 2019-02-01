import Joi from 'joi';
import Boom from 'boom';
import moment from 'moment';

const showSchema = Joi.object().keys({
  _id: Joi.string(),
  showName: Joi.string().required(),
  users: Joi.array().items(Joi.string()).required(),
  dayOfWeek: Joi.string().required(),
  startTime: Joi.number().integer().required(),
  endTime: Joi.number().integer().required(),
  isActive: Joi.boolean().required(),
  slug: Joi.string().required(),
  description: Joi.string().allow(''),
  primaryImage: Joi.string().allow(''),
});

const daysOfWeek = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

const nextDayGenerator = day => moment().day(day).add(1, 'day').format('dddd');

const determineSortOrderByDay = (startDay) => {
  let start = startDay;

  const ary = [start];

  let i = 0;

  for (i; i < daysOfWeek.length - 1;) {
    start = nextDayGenerator(start);
    ary.push(start);
    i += 1;
  }

  return ary.reduce((memo, key, index) => {
    memo[key.toLowerCase()] = index + 1; // eslint-disable-line

    return memo;
  }, {});
};

const determineDayOrder = (start, data) => {
  const sortOrder = determineSortOrderByDay(start);

  const sortedByDay = data.sort((a, b) => {
    const day1 = a.dayOfWeek.toLowerCase();
    const day2 = b.dayOfWeek.toLowerCase();

    return sortOrder[day1] - sortOrder[day2];
  });

  const filteredResults = sortedByDay.filter(d => (d.endTime || d.startTime));

  // create an object keyed according to sortOrder so as to obtain
  daysOfWeek.forEach((day) => {
    sortOrder[day] = filteredResults.filter(d => d.dayOfWeek.toLowerCase() === day)
      .sort((a, b) => a.startTime - b.startTime);
  });

  // then sort within each array by startTime
  const finalSort = Object.keys(sortOrder).reduce((cur, prev) => {
    cur.push(sortOrder[prev]);

    return cur;
  }, []);
    // lastly, flatten the arrays
  return finalSort.reduce((a, b) => [...a, ...b]);
};

const getShows = async (request, h) => {
  const { mongodb } = request.server.plugins;

  if (!mongodb) {
    return { success: false, message: 'No DB connection' };
  }
  const { db, ObjectID } = mongodb;
  const { id } = request.params;
  const queryParams = request.query;
  const { startWeek, ...query } = queryParams;

  /*
    We may, in the future need to address queries with multiple users,
    but MongoDB knows to traverse the users array, looking for a match on a
    single userId, so we can handle this case later if needed

    const userIds = queryParams.users ? queryParams.users.split(',') : null;
    if (userIds) {
        query.users = userIds.map(e => new ObjectID(e.trim()));
    }
    */

  const foundUserParams = !!queryParams.users;

  if (foundUserParams) {
    query.users = new ObjectID(queryParams.users);
  }

  const objId = id ? new ObjectID(id) : null;

  if (objId) {
    query._id = objId;
  }

  try {
    const result = await db.collection('shows').find(query).toArray();
    const transformedResult = result.map(async (doc) => {
      const objectIds = doc.users.map(showId => new ObjectID(showId));

      const users = await db.collection('users').find({
        _id: { $in: objectIds },
      }, {
        projection: {
          _id: 1,
          displayName: 1,
        },
      }).toArray();

      doc.users = users; // eslint-disable-line

      return new Promise(resolve => resolve(doc));
    });

    return Promise.all(transformedResult).then((r) => {
      const returnVal = startWeek ? determineDayOrder(startWeek, r) : r;

      return h.response(returnVal);
    });
  } catch (e) {
    console.log(e);
    return Boom.serverUnavailable();
  }
};

const updateShow = (request, h) => { // eslint-disable-line
  const { db, ObjectID } = request.server.plugins.mongodb;
  const show = request.payload;

  const { err } = Joi.validate(show, showSchema);

  if (err) {
    console.log(err);

    return {
      success: false,
      message: 'Validation Failed',
    };
  }

  const showId = new ObjectID(show._id);
  // non-destructively assigns all properties to variable without _id
  const { _id, ...fieldsToUpdate } = show;

  if (show.users.length) {
    fieldsToUpdate.users = show.users.map(u => new ObjectID(u.trim()));
  }

  db.collection('shows').update({ _id: showId }, fieldsToUpdate, (error, result) => {
    if (error) {
      console.log(error);
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
  // TODO - do we need to return something?
};

const upsertShow = (request, h) => {
  const { db } = request.server.plugins.mongodb;
  const newShow = request.payload;

  db.collection('shows').find({ showName: newShow.showName },
    {
      limit: 1,
    },
    async (e, cursor) => { // eslint-disable-line
      if (e) {
        console.log(e);
        return Boom.serverUnavailable();
      }

      const existingShow = await cursor.toArray();

      if (existingShow.length) {
        return Boom.unauthorized('A record with that show name already exists');
      }

      const { err } = Joi.validate(newShow, showSchema);

      if (err) {
        console.log(err);

        return {
          success: false,
          message: 'Validation Failed',
        };
      }
      // insert the record
      db.collection('shows').insert(newShow, (error, doc) => {
        if (error) {
          console.log(error);
          return Boom.serverUnavailable();
        }

        const { ops } = doc;
        const newDoc = ops.find((o, i) => (
          i === 0
        ));

        return h.response(newDoc).code(201);
      });
    });
  // TODO do we need to return something?
};

const removeShow = (request) => {
  const { db, ObjectID } = request.server.plugins.mongodb;
  const { id } = request.query;
  const showId = new ObjectID(id);

  db.collection('shows').remove({ _id: showId }, { justOne: true }, (err, result) => {
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

export {
  getShows, upsertShow, updateShow, removeShow,
};

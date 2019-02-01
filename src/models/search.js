import Boom from 'boom';

const userSearchHandler = (request) => {
  const { db } = request.server.plugins.mongodb;
  const { text } = request.query;

  db.collection('users').find({
    $or: [{
      email: {
        $regex: `${text}`, $options: '$i',
      },
    }, {
      firstName: {
        $regex: `${text}`, $options: '$i',
      },
    }, {
      lastName: {
        $regex: `${text}`, $options: '$i',
      },
    }],
  },
  {
    projection: {
      password: 0,
    },
  }, async (err, cursor) => {
    if (err) {
      console.log(err);
      return Boom.serverUnavailable();
    }

    const users = await cursor.toArray();

    return users;
  });
};

export default userSearchHandler;

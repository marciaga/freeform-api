import hapiJwt from 'hapi-auth-jwt2';
/*
{
  id: '',
  email: '',
  displayName: ''
  scope: 'admin',
  iat: 1480563674,
  exp: 1481168474
}
*/

const { JWT_SECRET_KEY } = process.env;
const validate = (decoded, request, callback) => callback(null, true);

const authPlugin = (server) => {
  server.register(hapiJwt);

  server.auth.strategy('jwt', 'jwt', {
    key: JWT_SECRET_KEY,
    validate,
    verifyOptions: { algorithms: ['HS256'] },
  });

  return server.auth.default('jwt');
};

exports.plugin = {
  pkg: require('./package.json'), // eslint-disable-line
  register: authPlugin,
};

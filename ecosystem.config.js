const dotenv = require('dotenv');

dotenv.config({ path: `${__dirname}/.env` });

module.exports = {
  apps: [{
    name: 'API',
    script: './usr/app/lib/server.js',
    env_production: {
      NODE_ENV: 'production',
    },
  }],
};

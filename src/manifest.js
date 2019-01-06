// TODO we'll need a Sentry plugin

const manifest = {
  server: {
    port: 8000,
  },
  register: {
    plugins: [{
      plugin: 'good',
      options: {
        ops: false,
        reporters: {
          console: [{
            module: 'good-console',
          }, 'stdout'],
        },
      },
    }, {
      plugin: './modules/mongodb',
      options: {
        settings: {
          db: {
            native_parser: false,
            numberOfRetries: 30,
            retryMiliSeconds: 1000,
          },
        },
      },
    }, {
      plugin: './modules/auth',
    }, {
      plugin: './modules/api',
    }],
  },
};

export default manifest;

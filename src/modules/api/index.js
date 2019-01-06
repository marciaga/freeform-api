import Joi from 'joi';
import { imageUpload, imageRemove } from '../../models';
import userSearchHandler from '../../models/search';
import getSpotifyToken from '../../models/spotify-token';
import showRoutes from './routes/shows';
import userRoutes from './routes/users';
import playlistRoutes from './routes/playlists';
import nowPlayingRoutes from './routes/nowPlaying';
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import volunteerRoutes from './routes/volunteer';
import getReport from './routes/report';
import { API_BASE_URL } from './constants';

const apiPlugin = (server, options, next) => {
  // register routes
  showRoutes.map(r => server.route(r));
  userRoutes.map(r => server.route(r));
  playlistRoutes.map(r => server.route(r));
  nowPlayingRoutes.map(r => server.route(r));
  authRoutes.map(r => server.route(r));
  volunteerRoutes.map(r => server.route(r));
  productRoutes.map(r => server.route(r));

  server.route({
    path: `${API_BASE_URL}/health`,
    method: 'GET',
    config: {
      handler: (request, reply) => {
        reply({ status: 'OK' });
      },
      auth: {
        strategy: 'jwt',
        scope: ['admin'],
        mode: 'optional',
      },
    },
  });
  // generic upload route
  server.route({
    path: `${API_BASE_URL}/upload`,
    method: 'POST',
    config: {
      payload: {
        output: 'stream',
        parse: true,
        allow: 'multipart/form-data',
        maxBytes: 52428800,
      },
      auth: {
        strategy: 'jwt',
        scope: ['admin'],
      },
      handler: imageUpload,
    },
  });
  // upload remove route
  server.route({
    path: `${API_BASE_URL}/upload/{fileName}`,
    method: 'DELETE',
    config: {
      auth: {
        strategy: 'jwt',
        scope: ['admin'],
      },
      handler: imageRemove,
    },
  });
  // users search endpoint for autocomplete
  server.route({
    path: `${API_BASE_URL}/search/users`,
    method: 'GET',
    config: {
      auth: {
        strategy: 'jwt',
        scope: ['admin', 'reports'],
      },
      handler: userSearchHandler,
    },
  });

  server.route({
    path: `${API_BASE_URL}/search/token`,
    method: 'GET',
    config: {
      auth: {
        strategy: 'jwt',
        scope: ['admin', 'dj', 'reports'],
      },
      handler: getSpotifyToken,
    },
  });

  server.route({
    path: `${API_BASE_URL}/report`,
    method: 'GET',
    config: {
      auth: {
        strategy: 'jwt',
        scope: ['admin', 'reports'],
      },
      handler: getReport,
      validate: {
        query: {
          startDate: Joi.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          endDate: Joi.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        },
      },
    },
  });

  next();
};

exports.plugin = {
  pkg: require('./package.json'), // eslint-disable-line
  register: apiPlugin,
};

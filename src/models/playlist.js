import Joi from 'joi';
import Boom from 'boom';
import moment from 'moment';
import shortid from 'shortid';
import { playlistUpdateMessage } from '../utils/helpers/formatters';

const songSchema = {
  id: Joi.string(),
  title: Joi.string().required(),
  artist: Joi.string().required(),
  album: Joi.string().required(),
  label: Joi.string().required(),
  releaseDate: Joi.string(),
  playedAt: Joi.date().iso(),
};

const playlistSchema = Joi.object().keys({
  _id: Joi.string(),
  showId: Joi.string().required(),
  playlistDate: Joi.date().iso().required(),
  playlistId: Joi.string().required(),
  playlistTitle: Joi.string(),
  songs: Joi.array().items(Joi.object(songSchema)),
  isSub: Joi.boolean(),
  djName: Joi.string(),
});

const getPlaylists = async (db, ObjectID, show, playlistId) => {
  const showId = show._id;
  const query = playlistId ? { playlistId } : { showId: new ObjectID(showId) };

  try {
    return await db.collection('playlists').find(query)
      .sort({ playlistDate: -1 })
      .toArray();
  } catch (e) {
    console.log(e);
    return false;
  }
};

const getShow = async (db, ObjectID, slug) => {
  try {
    const show = await db.collection('shows').findOne({ slug });

    const objectIds = show.users.map(id => new ObjectID(id));
    const users = await db.collection('users').find({
      _id: { $in: objectIds },
    }, {
      projection: {
        _id: 0,
        displayName: 1,
      },
    }).toArray();

    show.users = users.map(user => user.displayName);

    return show;
  } catch (e) {
    console.log(e);
    return {};
  }
};

const getPlaylistsByShow = async (request) => {
  const { db, ObjectID } = request.server.plugins.mongodb;
  const { order } = request.query;
  const { slug, playlistId } = request.params;

  try {
    const show = await getShow(db, ObjectID, slug);

    const playlists = await getPlaylists(db, ObjectID, show, playlistId);

    const mergedData = { show };

    switch (order) {
      case 'asc':
        mergedData.playlists = playlists.map(o => ({
          ...o,
          songs: o.songs.slice().reverse(),
        }));
        break;
      default:
        mergedData.playlists = playlists;
    }

    return mergedData;
  } catch (err) {
    console.log(err);
    return Boom.internal('Something went wrong');
  }
};

const createPlaylist = async (request, h) => { // eslint-disable-line
  const { db, ObjectID } = request.server.plugins.mongodb;
  const now = moment();

  const playlistDate = now.toISOString(); // this is set to UTC 0
  const playlistId = shortid.generate();
  const { showId, isSub, djName } = request.payload;

  const newPlaylist = {
    showId,
    isSub,
    djName,
    playlistDate: new Date(playlistDate),
    playlistId,
    songs: [],
  };

  try {
    const result = await db.collection('playlists').find({
      $or: [
        {
          showId: new ObjectID(showId),
          playlistId,
        },
        {
          showId: new ObjectID(showId),
          playlistDate: {
            $gte: new Date(now.startOf('day').toISOString()),
            $lte: new Date(now.endOf('day').toISOString()),
          },
        },
      ],
    }).toArray();

    if (result.length) {
      const msg = playlistUpdateMessage('playlistAlreadyExists');

      return { success: false, message: msg };
    }

    try {
      Joi.validate(newPlaylist, playlistSchema, (err, value) => { // eslint-disable-line
        if (err) {
          console.log(err);
          return Boom.badRequest();
        }
        // if value === null, object is valid
        if (value === null) {
          return true;
        }
      });
      // TODO - do we need to return something here?
    } catch (err) {
      console.log(err);
      return Boom.interval('Something went wrong');
    }

    newPlaylist.showId = new ObjectID(showId);
    // TODO - INSERT is deprecated
    db.collection('playlists').insert(newPlaylist, (err, doc) => {
      if (err) {
        console.log(err);
        return Boom.serverUnavailable();
      }

      const { ops } = doc;
      const newDoc = ops.find((o, i) => (
        i === 0
      ));

      return h.response({ doc: newDoc, success: true }).code(201);
    });
    // TODO do we need to return something here?
  } catch (err) {
    console.log(err);
    return Boom.internal('Something went wrong');
  }
};

const deletePlaylist = async (request) => {
  const { db } = request.server.plugins.mongodb;
  const { playlistId } = request.params;

  try {
    const result = await db.collection('playlists').deleteOne({
      playlistId,
    });
    const response = result.toJSON();
    const { ok } = response;

    if (ok) {
      return { success: true };
    }

    return { success: false, message: playlistUpdateMessage('playlistDeleteFail') };
  } catch (e) {
    console.log(e);
    return Boom.internal('Something went wrong');
  }
};

const addTrack = async (request) => {
  const { db, ObjectID } = request.server.plugins.mongodb;

  try {
    const track = request.payload;
    const { playlistId } = request.params;
    const now = moment();
    const playedAt = now.toISOString(); // this is set to UTC 0

    track.id = new ObjectID();
    // TODO when adding a track, just set the playedAt to the current date.
    // subsequent updates via nowPlaying API may modify this value
    track.playedAt = playedAt;
    // TODO - UPDATE is deprecated
    const result = await db.collection('playlists').update(
      { playlistId },
      {
        $push: {
          songs: {
            $each: [track],
            $position: 0,
          },
        },
      },
    );

    const response = result.toJSON();
    const { ok } = response;

    if (ok) {
      return {
        success: true,
        track,
      };
    }

    return { success: false, message: playlistUpdateMessage('noSuccess') };
  } catch (err) {
    console.log(err);
    return Boom.internal('Something went wrong');
  }
};

const updateTracks = async (request) => {
  const { db, ObjectID } = request.server.plugins.mongodb;

  try {
    const track = request.payload;
    const { playlistId } = request.params;
    // TODO - UPDATE is deprecated
    const result = await db.collection('playlists').update(
      {
        playlistId,
        'songs.id': new ObjectID(track.id),
      },
      {
        $set: {
          'songs.$': {
            ...track,
            id: new ObjectID(track.id),
          },
        },
      },
    );
    const response = result.toJSON();
    const { ok, nModified, n } = response;

    if (ok && nModified) {
      return { success: true, message: playlistUpdateMessage('songUpdated') };
    }

    if (ok && n) {
      return { success: false, message: playlistUpdateMessage('noChange') };
    }

    return { success: false, message: playlistUpdateMessage('noSuccess') };
  } catch (err) {
    console.log(err);
    return Boom.internal('Something went wrong');
  }
};

const updatePlaylistField = async (request) => {
  const { db } = request.server.plugins.mongodb;

  try {
    const data = request.payload;
    const field = data ? Object.keys(data).shift() : '';
    const { playlistId } = request.params;
    const dataToUpdate = field === 'playlistDate'
      ? { [field]: new Date(data[field]) }
      : { [field]: data[field] };
    // TODO - UPDATE is deprecated
    const result = await db.collection('playlists').update(
      { playlistId },
      { $set: dataToUpdate },
    );

    const response = result.toJSON();
    const { ok, n } = response;

    if (ok) {
      return { success: true, message: playlistUpdateMessage(field) };
    }

    if (ok && n) {
      return { success: false, message: playlistUpdateMessage('noChange') };
    }

    return { success: false, message: playlistUpdateMessage('noSuccess') };
  } catch (err) {
    console.log(err);
    return Boom.internal('Something went wrong');
  }
};

const updateTrackOrder = async (request) => {
  const { db, ObjectID } = request.server.plugins.mongodb;

  try {
    const { payload } = request;
    // don't save any airbreaks
    const filteredTracks = payload.filter(o => !o.airBreak);
    const tracks = filteredTracks.map(t => ({
      ...t,
      id: new ObjectID(t.id),
    }));

    const { playlistId } = request.params;
    // TODO - UPDATE is deprecated
    const result = await db.collection('playlists').update(
      { playlistId },
      { $set: { songs: tracks } },
    );

    const response = result.toJSON();
    const { ok } = response;

    if (ok) {
      return { success: true };
    }

    return { success: false, message: playlistUpdateMessage('noSuccess') };
  } catch (err) {
    console.log(err);
    return Boom.internal('Something went wrong');
  }
};

const deleteTrackFromPlaylist = async (request) => {
  const { db, ObjectID } = request.server.plugins.mongodb;

  try {
    const { playlistId, trackId } = request.params;
    // TODO - UPDATE is deprecated
    const result = await db.collection('playlists').update(
      { playlistId }, { $pull: { songs: { id: new ObjectID(trackId) } } },
    );

    const response = result.toJSON();
    // { ok: 1, nModified: 1, n: 1 }
    const { ok } = response;

    if (ok) {
      return { success: true };
    }

    return { success: false, message: playlistUpdateMessage('noSuccess') };
  } catch (err) {
    console.log(err);
    return Boom.internal('Something went wrong');
  }
};

export {
  getPlaylistsByShow,
  createPlaylist,
  addTrack,
  updateTracks,
  updatePlaylistField,
  updateTrackOrder,
  deleteTrackFromPlaylist,
  deletePlaylist,
};

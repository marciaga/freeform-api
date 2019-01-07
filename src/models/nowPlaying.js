import Boom from 'boom';

const getNowPlaying = async (request, h) => {
  const { db } = request.server.plugins.mongodb;

  try {
    const result = await db.collection('nowPlaying').findOne();

    if (!result) {
      return { success: false, message: 'Nothing is playing' };
    }

    return result;
  } catch (e) {
    console.log(e);
    return Boom.serverUnavailable();
  }
};

const updateNowPlaying = async (request, h) => {
  const { playlistId, song, playedAt } = request.payload;
  const playedAtDate = new Date(playedAt);

  try {
    const { db, ObjectID } = request.server.plugins.mongodb;
    const { socket } = request.server.plugins['web-sockets'];
    const { id, ...songData } = song;
    const nowPlayingData = {
      ...songData,
      playedAt: playedAtDate,
      songId: new ObjectID(song.id),
    };

    socket.emit('now-playing', songData);

    const result = await db.collection('nowPlaying').findOneAndReplace({},
      nowPlayingData,
      {
        upsert: true,
        returnNewDocument: true,
      });

    const pid = playlistId;

    const res = await db.collection('playlists').update(
      { playlistId: pid, 'songs.id': nowPlayingData.songId },
      { $set: { 'songs.$.playedAt': playedAtDate } },
    );
    const playlistResult = res.toJSON();
    const { ok, nModified } = playlistResult;

    if (result.ok && ok && nModified) {
      return {
        success: true,
        value: nowPlayingData,
      };
    }

    return { success: false, message: 'Could not set as Now Playing' };
  } catch (e) {
    console.log(e);
    return Boom.internal('Something went wrong');
  }
};

export { updateNowPlaying, getNowPlaying };

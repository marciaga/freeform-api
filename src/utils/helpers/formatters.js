export const dateSortAsc = (ary) => {
  if (!ary.length) {
    return [];
  }

  return [...ary].sort((a, b) => new Date(a.playedAt) - new Date(b.playedAt));
};

export const dateSortDesc = (ary) => {
  if (!ary.length) {
    return [];
  }

  return [...ary].sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt));
};

export const playlistUpdateMessage = (messageKey) => {
  const userMessages = {
    playlistDate: 'The playlist date was updated',
    showId: 'This playlist has been reassigned to a different show',
    playlistAlreadyExists: 'That playlist already exists',
    playlistDeleteFail: 'Playlist delete failed',
    songUpdated: 'Song successfully updated',
    noChange: 'The document was unchanged',
    noSuccess: 'Update was not successful',
  };

  const noMatch = 'The playlist record has been updated';

  const userMessage = userMessages[messageKey] ? userMessages[messageKey] : noMatch;

  return userMessage;
};

/**
 * In-memory playback queue. Items deliberately never enter persisted player state.
 */
export function createTransientQueue({ onChange } = {}) {
  let items = [];

  function emit() {
    onChange?.(items.map((item) => ({ ...item })));
  }

  return {
    add(track) {
      if (!track?.id) return false;
      items.push({ ...track });
      emit();
      return true;
    },
    clear() {
      if (!items.length) return;
      items = [];
      emit();
    },
    getItems() {
      return items.map((item) => ({ ...item }));
    },
    move(trackId, offset) {
      const index = items.findIndex((item) => item.id === trackId);
      const nextIndex = Math.max(0, Math.min(items.length - 1, index + offset));
      if (index < 0 || index === nextIndex) return false;
      const [item] = items.splice(index, 1);
      items.splice(nextIndex, 0, item);
      emit();
      return true;
    },
    remove(trackId) {
      const index = items.findIndex((item) => item.id === trackId);
      if (index < 0) return false;
      items.splice(index, 1);
      emit();
      return true;
    },
    takeNext(availableIds = null) {
      while (items.length) {
        const item = items.shift();
        if (!availableIds || availableIds.has(item.id)) {
          emit();
          return { ...item };
        }
      }
      emit();
      return null;
    },
  };
}

export default createTransientQueue;

import { useState, useCallback, useEffect } from 'react';
import { listAnnotations, createAnnotation, updateAnnotation, deleteAnnotation } from '../api/client';

export function useAnnotations(videoId, configId) {
  const [annotations, setAnnotations] = useState([]);
  const [activeId, setActiveId] = useState(null); // annotation currently being filled via modal

  const refresh = useCallback(async () => {
    if (!videoId) return;
    const rows = await listAnnotations(videoId);
    setAnnotations(rows);
  }, [videoId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addAnnotation = useCallback(
    async ({ timestamp, frame, x, y }) => {
      const row = await createAnnotation({ video_id: videoId, config_id: configId, timestamp, frame, x, y, fields: {} });
      setAnnotations((prev) => [...prev, row]);
      setActiveId(row.id);
      return row;
    },
    [videoId, configId]
  );

  const patchAnnotation = useCallback(async (id, fields) => {
    const row = await updateAnnotation(id, fields);
    setAnnotations((prev) => prev.map((a) => (a.id === id ? row : a)));
    return row;
  }, []);

  const removeAnnotation = useCallback(async (id) => {
    await deleteAnnotation(id);
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const finalizeActive = useCallback(() => setActiveId(null), []);

  return {
    annotations,
    activeId,
    setActiveId,
    addAnnotation,
    patchAnnotation,
    removeAnnotation,
    finalizeActive,
    refresh
  };
}

import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Videos
export const uploadVideo = (file, name) => {
  const form = new FormData();
  form.append('video', file);
  if (name) form.append('name', name);
  return api.post('/videos', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
};
export const importVideoFromUrl = (url) => api.post('/videos/import-url', { url }).then((r) => r.data);
export const listVideos = () => api.get('/videos').then((r) => r.data);
export const getVideo = (id) => api.get(`/videos/${id}`).then((r) => r.data);
export const setVideoDuration = (id, duration) => api.patch(`/videos/${id}/duration`, { duration }).then((r) => r.data);
export const videoStreamUrl = (id) => `/api/videos/${id}/stream`;

// Configs
export const saveConfig = (name, json) => api.post('/configs', { name, json }).then((r) => r.data);
export const listConfigs = () => api.get('/configs').then((r) => r.data);
export const getConfig = (id) => api.get(`/configs/${id}`).then((r) => r.data);

// Annotations
export const listAnnotations = (videoId) => api.get('/annotations', { params: { video_id: videoId } }).then((r) => r.data);
export const createAnnotation = (payload) => api.post('/annotations', payload).then((r) => r.data);
export const updateAnnotation = (id, fields) => api.patch(`/annotations/${id}`, { fields }).then((r) => r.data);
export const deleteAnnotation = (id) => api.delete(`/annotations/${id}`).then((r) => r.data);

// Export
export const exportUrl = (videoId, format) => `/api/export/${videoId}?format=${format}`;

export default api;

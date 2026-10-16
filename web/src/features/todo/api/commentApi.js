import api from "../../../shared/api/axiosInstance.js";


export const fetchComments = (todoId) =>
    api.get(`/comments/${todoId}`);

export const addComment = (payload) =>
    api.post("/comments", payload);

export const deleteComment = (commentId) =>
    api.delete(`/comments/${commentId}`);
import api from "./axiosInstance.js";

export const fetchAllUsers = () => {
    return api.get("/users");
};

export const getMe = () => {
    return api.get("/users/me");
};

export const unlinkKakao = () => {
    return api.delete("/users/me/link-kakao");
};

export const deleteMyAccount = () => {
    return api.delete("/auth/me");
};

export const uploadProfileImage = (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/users/me/profile-image", formData);
};

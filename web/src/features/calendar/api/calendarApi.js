import api from "../../../shared/api/axiosInstance.js";

export const fetchEvents = () => {
    return api.get("/calendar");
};

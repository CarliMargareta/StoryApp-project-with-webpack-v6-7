import CONFIG from "../config";

const API = {
  register: `${CONFIG.BASE_URL}/register`,
  login: `${CONFIG.BASE_URL}/login`,
  stories: `${CONFIG.BASE_URL}/stories`,
  detail: (id) => `${CONFIG.BASE_URL}/stories/${id}`,
};

const getToken = () => {
  const auth = localStorage.getItem(CONFIG.AUTH_KEY);
  if (auth) {
    return JSON.parse(auth).token;
  }
  return null;
};

const putAuthHeader = (headers = {}) => {
  const token = getToken();
  if (token) {
    return {
      ...headers,
      Authorization: `Bearer ${token}`,
    };
  }
  return headers;
};

async function register({ name, email, password }) {
  const response = await fetch(API.register, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      email,
      password,
    }),
  });

  const responseJson = await response.json();

  if (!response.ok) {
    throw new Error(responseJson.message);
  }

  return responseJson;
}

async function login({ email, password }) {
  const response = await fetch(API.login, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const responseJson = await response.json();

  if (!response.ok) {
    throw new Error(responseJson.message);
  }

  return responseJson;
}

async function getStories() {
  const response = await fetch(`${API.stories}?location=1`, {
    headers: putAuthHeader(),
  });

  const responseJson = await response.json();

  if (!response.ok) {
    throw new Error(responseJson.message);
  }

  return responseJson;
}

async function getDetailStory(id) {
  const response = await fetch(API.detail(id), {
    headers: putAuthHeader(),
  });

  const responseJson = await response.json();

  if (!response.ok) {
    throw new Error(responseJson.message);
  }

  return responseJson;
}

async function addStory({ description, photo, lat, lon }) {
  const formData = new FormData();
  formData.append("description", description);
  formData.append("photo", photo);

  if (lat && lon) {
    formData.append("lat", lat);
    formData.append("lon", lon);
  }

  const response = await fetch(API.stories, {
    method: "POST",
    headers: putAuthHeader(),
    body: formData,
  });

  const responseJson = await response.json();

  if (!response.ok) {
    throw new Error(responseJson.message);
  }

  // // Kirim push notification
  // const notificationPayload = {
  //   title: "Story berhasil dibuat",
  //   options: {
  //     body: `Anda telah membuat story baru dengan deskripsi: ${description}`,
  //     icon: "/images/logo.png",s
  //     badge: "/images/logo.png",
  //     image: "/images/logo.png",
  //     actions: [
  //       { action: "open", title: "Buka" },
  //       { action: "close", title: "Tutup" },
  //     ],
  //   },
  // };

  // await fetch("/api/send-notification", {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //   },
  //   body: JSON.stringify(notificationPayload),
  // });

  return responseJson;
}

export { getToken, register, login, getStories, getDetailStory, addStory };

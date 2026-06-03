/** API local (server.js). Sin dependencia de Cloudflare/Vercel. */
const API_URL = "/api";

function cloudinaryUrl(url, w = 800) {
  if (!url || !url.includes("cloudinary.com")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${w}/`);
}

const API_URL = "https://api-agustina.juaniperez1243.workers.dev";

function cloudinaryUrl(url, w = 800) {
  if (!url || !url.includes("cloudinary.com")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${w}/`);
}

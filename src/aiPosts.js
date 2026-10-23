import { API_URL } from "./config";

/** Rewrite localhost media URLs so the phone can load them via LAN/emulator API host. */
export function aiPostImageUri(post) {
  if (!post) return null;
  let url = post.imageUrl || post.imagePath;
  if (!url) return null;
  if (url.startsWith("/")) {
    return `${API_URL.replace(/\/$/, "")}${url}`;
  }
  return url
    .replace(/^https?:\/\/localhost(?::\d+)?/i, API_URL.replace(/\/$/, ""))
    .replace(/^https?:\/\/127\.0\.0\.1(?::\d+)?/i, API_URL.replace(/\/$/, ""));
}

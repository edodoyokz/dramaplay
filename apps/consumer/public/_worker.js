export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      url.hostname = "api.dramaplay.my.id";
      url.pathname = url.pathname.slice(4) || "/";
      return fetch(new Request(url, request));
    }
    return env.ASSETS.fetch(request);
  },
};

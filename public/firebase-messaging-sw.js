// Kept for browsers that registered this worker before: the site's one
// service worker is /sw.js (offline + push). Loading it here makes an old
// registration behave exactly like the current one until it is replaced.
importScripts("/sw.js");

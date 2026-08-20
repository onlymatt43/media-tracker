/**
 * om-track.js — video engagement beacons (play/pause/ended + 25/50/75/100% completion).
 * Targets any <video data-om-uuid="…"> on the page, self-hosted or plugin-embedded.
 * Non-blocking: silently does nothing if sendBeacon or the config are unavailable.
 */
(function () {
  'use strict';

  var cfg = window.OM_TRACK_CFG;
  if (!cfg || !cfg.base || !navigator.sendBeacon) { return; }

  var SESSION_KEY = 'om_track_session';
  var session = sessionStorage.getItem(SESSION_KEY);
  if (!session) {
    session = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, session);
  }

  function send(uuid, eventType, position, duration) {
    var payload = JSON.stringify({
      event: eventType,
      position: position,
      duration: duration,
      session: session,
    });
    navigator.sendBeacon(
      cfg.base.replace(/\/$/, '') + '/api/event/' + encodeURIComponent(uuid),
      new Blob([payload], { type: 'text/plain' })
    );
  }

  function track(video) {
    var uuid = video.getAttribute('data-om-uuid');
    if (!uuid) { return; }
    var fired = {};

    video.addEventListener('play', function () {
      send(uuid, 'play', video.currentTime, video.duration || 0);
    });
    video.addEventListener('pause', function () {
      send(uuid, 'pause', video.currentTime, video.duration || 0);
    });
    video.addEventListener('ended', function () {
      send(uuid, 'ended', video.currentTime, video.duration || 0);
    });
    video.addEventListener('timeupdate', function () {
      if (!video.duration) { return; }
      var pct = (video.currentTime / video.duration) * 100;
      [25, 50, 75, 100].forEach(function (q) {
        if (pct >= q && !fired[q]) {
          fired[q] = true;
          send(uuid, 'q' + q, video.currentTime, video.duration);
        }
      });
    });
  }

  document.querySelectorAll('video[data-om-uuid]').forEach(track);
})();

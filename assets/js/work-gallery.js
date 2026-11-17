/*
 * WORK gallery video lightbox — clicking a .work-gallery__cell[data-video] opens a centered
 * 16:9 modal (#workVid) and plays that cell's video with sound (the click is a user gesture, so
 * autoplay-with-audio is allowed). Close via the ✕ button, a backdrop click, or Escape; closing
 * pauses and unloads the video so it stops downloading/playing in the background.
 */
(function () {
  "use strict";

  var modal = document.getElementById("workVid");
  if (!modal) return;
  var video = modal.querySelector(".workvid__video");
  var closeBtn = modal.querySelector(".workvid__close");
  var cells = [].slice.call(document.querySelectorAll(".work-gallery__cell[data-video]"));
  if (!cells.length || !video) return;

  // Pause the site's heavy background canvases (shader-bg / dandelion / blocks / nav fx) while the
  // video plays — they all listen for this shared event (same one work-detail.js uses for its
  // overlay). Freeing the GPU/CPU keeps playback smooth instead of stuttering behind the modal.
  function signalBg(open) {
    try { window.dispatchEvent(new CustomEvent("work:overlay", { detail: { open: open } })); } catch (e) {}
  }

  function openVid(src) {
    if (!src) return;
    video.src = src;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    signalBg(true);
    var pr = video.play();
    if (pr && pr.catch) pr.catch(function () {});   // ignore autoplay rejections (user can press play)
  }

  function closeVid() {
    if (!modal.classList.contains("open")) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    try { video.pause(); } catch (e) {}
    video.removeAttribute("src");
    try { video.load(); } catch (e) {}             // fully release the buffer
    signalBg(false);                               // resume background animations
  }

  cells.forEach(function (c) {
    var src = c.getAttribute("data-video");
    c.addEventListener("click", function () { openVid(src); });
    c.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") { e.preventDefault(); openVid(src); }
    });
  });

  closeBtn.addEventListener("click", closeVid);
  modal.addEventListener("click", function (e) { if (e.target === modal) closeVid(); });   // backdrop
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeVid(); });
})();

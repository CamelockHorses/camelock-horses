import { auth, platform, onSyncChange, onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail } from "./platform.js";
import { runApp } from "./app.js";

const $ = (s) => document.querySelector(s);
let started = false;

onAuthStateChanged(auth, (u) => {
  $("#login").hidden = !!u;
  $("#shell").hidden = !u;
  if (!u) { if (started) location.reload(); return; }
  if (!started) { started = true; platform.watchPhotos(); runApp(); }
});

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#login-msg"), btn = $("#login-btn");
  btn.disabled = true; msg.textContent = "Signing in…";
  try {
    await signInWithEmailAndPassword(auth, $("#login-email").value.trim(), $("#login-pass").value);
    msg.textContent = "";
  } catch (err) {
    msg.textContent = !navigator.onLine ? "You're offline. Connect to the internet the first time you sign in on this device."
      : err.code === "auth/too-many-requests" ? "Too many attempts. Wait a few minutes and try again."
      : "That email and password don't match. Check them and try again.";
  } finally { btn.disabled = false; }
});
$("#login-reset").addEventListener("click", async () => {
  const email = $("#login-email").value.trim(), msg = $("#login-msg");
  if (!email) { msg.textContent = "Enter your email first, then tap Forgot password."; return; }
  try { await sendPasswordResetEmail(auth, email); msg.textContent = "If that email has an account, a reset link is on its way."; }
  catch { msg.textContent = "Couldn't send the reset email. Check your connection."; }
});

onSyncChange(({ online, pending }) => {
  const el = $("#sync");
  el.textContent = !online ? (pending ? "Offline · will sync" : "Offline") : pending ? "Syncing…" : "Synced";
  el.dataset.state = !online ? "off" : pending ? "busy" : "ok";
});
addEventListener("write-failed", () => {
  const t = $("#toast"); t.textContent = "A change couldn't be saved. Sign out and back in, then try again."; t.hidden = false;
  setTimeout(() => t.hidden = true, 5000);
});

if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));

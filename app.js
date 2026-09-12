import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getFirestore,
  doc,
  onSnapshot,
  collection,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  getAuth,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import { firebaseConfig } from "./firebase-config.js";


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const streamRef = doc(db, "site", "stream");

const streamDateEl = document.getElementById("streamDate");
const countdownEl = document.getElementById("countdown");
const streamStatusEl = document.getElementById("streamStatus");
const mainGameEl = document.getElementById("mainGame");
const pollEl = document.getElementById("poll");
const voteMessageEl = document.getElementById("voteMessage");

let currentData = {};
let currentVotes = [];
let myUid = null;
let countdownTimer = null;
let voted = false;


// Oyunları Firebase'den al
function getGames() {

  if (!currentData || !currentData.games) {
    return [];
  }

  const games = currentData.games;

  // Array ise
  if (Array.isArray(games)) {
    return games.filter(game =>
      game &&
      typeof game === "object" &&
      game.name
    );
  }

  // Map/Object ise
  if (typeof games === "object") {

    return Object.keys(games)
      .sort((a, b) => Number(a) - Number(b))
      .map(key => games[key])
      .filter(game =>
        game &&
        typeof game === "object" &&
        game.name
      );
  }

  return [];
}


// HTML güvenliği
function escapeHtml(value) {

  return String(value ?? "").replace(/[&<>"']/g, character => {

    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[character];

  });

}


// Tarihi al
function getStreamDate(data) {

  if (!data || !data.date || !data.time) {
    return null;
  }

  const dateParts = data.date.split("-").map(Number);
  const timeParts = data.time.split(":").map(Number);

  if (dateParts.length !== 3) {
    return null;
  }

  const year = dateParts[0];
  const month = dateParts[1];
  const day = dateParts[2];

  const hour = timeParts[0] || 0;
  const minute = timeParts[1] || 0;

  return new Date(
    year,
    month - 1,
    day,
    hour,
    minute,
    0
  );
}


// Tarihi ekrana yaz
function formatStreamDate(data) {

  const date = getStreamDate(data);

  if (!date) {
    return "Yayın tarihi henüz ayarlanmadı";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}


// Geri sayım
function startCountdown() {

  clearInterval(countdownTimer);

  function updateCountdown() {

    const target = getStreamDate(currentData);

    if (!target) {

      countdownEl.textContent = "--:--:--";

      streamStatusEl.textContent =
        "Melisa yayın zamanını henüz ayarlamadı 💕";

      return;
    }

    const difference =
      target.getTime() - Date.now();

    if (difference <= 0) {

      countdownEl.textContent =
        "YAYIN ZAMANI! 🎉";

      streamStatusEl.textContent =
        "Melisa şu anda yayında olabilir! 💗";

      return;
    }

    const totalSeconds =
      Math.floor(difference / 1000);

    const days =
      Math.floor(totalSeconds / 86400);

    const hours =
      Math.floor((totalSeconds % 86400) / 3600);

    const minutes =
      Math.floor((totalSeconds % 3600) / 60);

    const seconds =
      totalSeconds % 60;

    let text = "";

    if (days > 0) {
      text += days + "g ";
    }

    text +=
      String(hours).padStart(2, "0") +
      ":" +
      String(minutes).padStart(2, "0") +
      ":" +
      String(seconds).padStart(2, "0");

    countdownEl.textContent = text;

    streamStatusEl.textContent =
      "Yayına kalan süre 💕";
  }

  updateCountdown();

  countdownTimer =
    setInterval(updateCountdown, 1000);
}


// Yayın bilgilerini göster
function renderStream() {

  streamDateEl.textContent =
    formatStreamDate(currentData);

  const games = getGames();

  console.log("Firebase verisi:", currentData);
  console.log("Oyunlar:", games);

  const mainGame =
    games.find(game => game.main === true) ||
    games[0];

  if (mainGame) {

    mainGameEl.textContent =
      `${mainGame.emoji || "🎮"} ${mainGame.name}`;

  } else {

    mainGameEl.textContent =
      "Henüz oyun seçilmedi 🎮";
  }

  startCountdown();
}


// Oyları hesapla
function calculateVotes() {

  const games = getGames();

  const voteCounts =
    games.map(() => 0);

  currentVotes.forEach(vote => {

    const index =
      Number(vote.gameIndex);

    if (
      Number.isInteger(index) &&
      index >= 0 &&
      index < voteCounts.length
    ) {
      voteCounts[index]++;
    }

  });

  return voteCounts;
}


// Anketi göster
function renderPoll() {

  const games = getGames();

  if (games.length === 0) {

    pollEl.innerHTML = `
      <div class="loading">
        Henüz anket seçeneği eklenmedi 💕
      </div>
    `;

    return;
  }

  const voteCounts =
    calculateVotes();

  const totalVotes =
    voteCounts.reduce(
      (total, count) => total + count,
      0
    );

  pollEl.innerHTML =
    games.map((game, index) => {

      const count =
        voteCounts[index];

      const percentage =
        totalVotes > 0
          ? Math.round((count / totalVotes) * 100)
          : 0;

      return `
        <div
          class="poll-option ${voted ? "disabled" : ""}"
          data-index="${index}"
        >

          <div class="game-emoji">
            ${escapeHtml(game.emoji || "🎮")}
          </div>

          <div class="game-name">

            ${escapeHtml(game.name)}

            <div class="bar">
              <span style="width:${percentage}%"></span>
            </div>

          </div>

          <div class="vote-count">
            ${count}
          </div>

        </div>
      `;

    }).join("");


  if (!voted) {

    pollEl
      .querySelectorAll(".poll-option")
      .forEach(option => {

        option.addEventListener(
          "click",
          () => {

            vote(
              Number(option.dataset.index)
            );

          }
        );

      });

  }
}


// Oy ver
async function vote(gameIndex) {

  const games = getGames();

  if (!myUid || voted) {
    return;
  }

  if (!games[gameIndex]) {
    return;
  }

  const streamKey =
    `${currentData.date || "nodate"}_${currentData.time || ""}`;

  const voterRef =
    doc(
      db,
      "site",
      "stream",
      "voters",
      myUid
    );

  try {

    voted = true;

    localStorage.setItem(
      "melisa_voted_" + streamKey,
      "1"
    );

    await setDoc(voterRef, {

      gameIndex: gameIndex,

      streamKey: streamKey,

      createdAt: serverTimestamp()

    });

    voteMessageEl.textContent =
      "Oyununu seçtin! 💗";

    renderPoll();

  } catch (error) {

    console.error(
      "Oy verme hatası:",
      error
    );

    voted = false;

    localStorage.removeItem(
      "melisa_voted_" + streamKey
    );

    voteMessageEl.textContent =
      "Oy verilemedi.";
  }
}


// Firebase anonim giriş
signInAnonymously(auth)

  .then(userCredential => {

    myUid =
      userCredential.user.uid;

    console.log(
      "Firebase bağlantısı başarılı.",
      myUid
    );


    // Yayın verisini dinle
    onSnapshot(

      streamRef,

      snapshot => {

        if (snapshot.exists()) {

          currentData =
            snapshot.data();

        } else {

          currentData = {};

        }

        renderStream();


        const streamKey =
          `${currentData.date || "nodate"}_${currentData.time || ""}`;


        voted =
          localStorage.getItem(
            "melisa_voted_" + streamKey
          ) === "1";


        voteMessageEl.textContent =
          voted
            ? "Bu yayın için daha önce oy verdin 💕"
            : "";


        renderPoll();

      },

      error => {

        console.error(
          "Firestore okuma hatası:",
          error
        );

        streamStatusEl.textContent =
          "Yayın bilgileri alınamadı.";

        voteMessageEl.textContent =
          "Firebase bağlantı hatası: " +
          error.code;

      }

    );


    // Oyları dinle
    onSnapshot(

      collection(
        db,
        "site",
        "stream",
        "voters"
      ),

      snapshot => {

        currentVotes =
          snapshot.docs.map(
            document => document.data()
          );

        renderPoll();

      },

      error => {

        console.error(
          "Oy okuma hatası:",
          error
        );

      }

    );

  })

  .catch(error => {

    console.error(
      "Firebase bağlantı hatası:",
      error
    );

    streamStatusEl.textContent =
      "Firebase bağlantısı kurulamadı.";

    voteMessageEl.textContent =
      "Firebase bağlantı hatası: " +
      error.code;

  });

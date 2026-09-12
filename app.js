```js
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

function getGames() {
  if (!currentData) return [];

  if (!Array.isArray(currentData.games)) {
    return [];
  }

  return currentData.games.filter(game => {
    return game &&
           typeof game === "object" &&
           String(game.name || "").trim() !== "";
  });
}

function getStreamDate(data) {
  if (!data || !data.date || !data.time) {
    return null;
  }

  const [year, month, day] = String(data.date)
    .split("-")
    .map(Number);

  const [hour, minute] = String(data.time)
    .split(":")
    .map(Number);

  if (
    !year ||
    !month ||
    !day ||
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    return null;
  }

  return new Date(
    year,
    month - 1,
    day,
    hour,
    minute,
    0
  );
}

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

    const difference = target.getTime() - Date.now();

    if (difference <= 0) {
      countdownEl.textContent = "YAYIN ZAMANI! 🎉";
      streamStatusEl.textContent =
        "Melisa şu anda yayında olabilir! 💗";
      return;
    }

    const totalSeconds = Math.floor(difference / 1000);

    const days = Math.floor(totalSeconds / 86400);

    const hours = Math.floor(
      (totalSeconds % 86400) / 3600
    );

    const minutes = Math.floor(
      (totalSeconds % 3600) / 60
    );

    const seconds = totalSeconds % 60;

    let countdownText = "";

    if (days > 0) {
      countdownText += days + "g ";
    }

    countdownText +=
      String(hours).padStart(2, "0") +
      ":" +
      String(minutes).padStart(2, "0") +
      ":" +
      String(seconds).padStart(2, "0");

    countdownEl.textContent = countdownText;

    streamStatusEl.textContent =
      "Yayına kalan süre 💕";
  }

  updateCountdown();

  countdownTimer = setInterval(
    updateCountdown,
    1000
  );
}

function renderStream() {
  streamDateEl.textContent =
    formatStreamDate(currentData);

  const games = getGames();

  console.log("Firebase'den gelen veriler:", currentData);
  console.log("Oyunlar:", games);

  if (games.length === 0) {
    mainGameEl.textContent =
      "Henüz oyun seçilmedi 🎮";
  } else {
    const mainGame =
      games.find(game => game.main === true) ||
      games[0];

    mainGameEl.textContent =
      `${mainGame.emoji || "🎮"} ${mainGame.name}`;
  }

  startCountdown();
}

function calculateVotes() {
  const games = getGames();

  const voteCounts = games.map(() => 0);

  currentVotes.forEach(vote => {
    const gameIndex = Number(vote.gameIndex);

    if (
      Number.isInteger(gameIndex) &&
      gameIndex >= 0 &&
      gameIndex < voteCounts.length
    ) {
      voteCounts[gameIndex]++;
    }
  });

  return voteCounts;
}

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

  const voteCounts = calculateVotes();

  const totalVotes =
    voteCounts.reduce(
      (total, count) => total + count,
      0
    );

  pollEl.innerHTML = games.map((game, index) => {
    const count = voteCounts[index];

    const percentage =
      totalVotes > 0
        ? Math.round(
            (count / totalVotes) * 100
          )
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
        option.addEventListener("click", () => {
          vote(
            Number(option.dataset.index)
          );
        });
      });
  }
}

async function vote(gameIndex) {
  const games = getGames();

  if (
    !myUid ||
    voted ||
    games.length === 0
  ) {
    return;
  }

  if (!games[gameIndex]) {
    return;
  }

  const streamKey =
    `${currentData.date || "nodate"}_${currentData.time || ""}`;

  const voterRef = doc(
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
    console.error(error);

    voted = false;

    localStorage.removeItem(
      "melisa_voted_" + streamKey
    );

    voteMessageEl.textContent =
      "Oy verilemedi. Lütfen tekrar dene.";
  }
}

signInAnonymously(auth)

  .then(userCredential => {

    myUid =
      userCredential.user.uid;

    onSnapshot(
      streamRef,
      snapshot => {

        if (snapshot.exists()) {
          currentData = snapshot.data();
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

        if (voted) {
          voteMessageEl.textContent =
            "Bu yayın için daha önce oy verdin 💕";
        } else {
          voteMessageEl.textContent = "";
        }

        renderPoll();
      },

      error => {
        console.error(
          "Firestore stream hatası:",
          error
        );

        streamStatusEl.textContent =
          "Yayın bilgileri alınamadı.";
      }
    );

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
          "Oylar alınamadı:",
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
      "Anket sistemi şu anda kullanılamıyor.";
  });
```

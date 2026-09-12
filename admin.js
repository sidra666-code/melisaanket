import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import { firebaseConfig } from "./firebase-config.js";


const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

const auth = getAuth(app);

const streamRef = doc(
  db,
  "site",
  "stream"
);


const loginCard =
  document.getElementById("loginCard");

const panel =
  document.getElementById("panel");

const loginMsg =
  document.getElementById("loginMsg");

const msg =
  document.getElementById("msg");

const gamesEl =
  document.getElementById("games");


let data = {
  date: "",
  time: "",
  games: []
};


function escapeHtml(value) {

  return String(value ?? "").replace(
    /[&<>"']/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[character])
  );

}


function renderGames() {

  gamesEl.innerHTML =
    data.games.map((game, index) => {

      return `
        <div
          class="game-row"
          data-index="${index}"
        >

          <div class="game-row-grid">

            <input
              class="emoji"
              value="${escapeHtml(game.emoji || "🎮")}"
              maxlength="4"
              placeholder="🎮"
            >

            <input
              class="name"
              value="${escapeHtml(game.name || "")}"
              placeholder="Oyun adı"
            >

          </div>


          <button
            class="danger delete"
            type="button"
          >
            🗑️ Sil
          </button>


          <label class="check">

            <input
              type="radio"
              name="mainGame"
              ${game.main ? "checked" : ""}
            >

            Yayının ana oyunu

          </label>

        </div>
      `;

    }).join("");


  gamesEl
    .querySelectorAll(".delete")
    .forEach(button => {

      button.addEventListener(
        "click",
        event => {

          const row =
            event.target.closest(".game-row");

          const index =
            Number(row.dataset.index);

          data.games.splice(
            index,
            1
          );


          if (
            data.games.length > 0 &&
            !data.games.some(game => game.main)
          ) {
            data.games[0].main = true;
          }


          renderGames();

        }
      );

    });

}


function readGamesFromForm() {

  const rows = [
    ...gamesEl.querySelectorAll(".game-row")
  ];


  data.games = rows.map(row => {

    return {

      emoji:
        row
          .querySelector(".emoji")
          .value
          .trim() || ":)",

      name:
        row
          .querySelector(".name")
          .value
          .trim() || "İsimsiz oyun",

      main:
        row
          .querySelector(
            'input[type="radio"]'
          )
          .checked

    };

  });


  if (
    data.games.length > 0 &&
    !data.games.some(game => game.main)
  ) {
    data.games[0].main = true;
  }

}


/* =========================
   GİRİŞ
========================= */

document
  .getElementById("loginBtn")
  .addEventListener(
    "click",
    async () => {

      loginMsg.textContent =
        "Giriş yapılıyor...";

      const email =
        document
          .getElementById("email")
          .value
          .trim();

      const password =
        document
          .getElementById("password")
          .value;


      if (!email || !password) {

        loginMsg.textContent =
          "E-posta ve şifreyi gir.";

        return;

      }


      try {

        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

        loginMsg.textContent = "";

      } catch (error) {

        console.error(error);

        loginMsg.textContent =
          "E-posta veya şifre hatalı.";

      }

    }
  );


/* =========================
   OTURUM KONTROLÜ
========================= */

onAuthStateChanged(
  auth,
  async user => {

    if (!user) {

      loginCard
        .classList
        .remove("hidden");

      panel
        .classList
        .add("hidden");

      return;

    }


    loginCard
      .classList
      .add("hidden");

    panel
      .classList
      .remove("hidden");


    document
      .getElementById("uid")
      .textContent =
        user.uid;


    try {

      const snapshot =
        await getDoc(streamRef);


      if (snapshot.exists()) {

        const firebaseData =
          snapshot.data();

        data = {

          date:
            firebaseData.date || "",

          time:
            firebaseData.time || "",

          games:
            Array.isArray(
              firebaseData.games
            )
              ? firebaseData.games
              : []

        };

      }


      document
        .getElementById("date")
        .value =
          data.date;


      document
        .getElementById("time")
        .value =
          data.time;


      renderGames();

    } catch (error) {

      console.error(error);

      msg.textContent =
        "Veriler alınamadı. Firestore kurallarını kontrol et.";

    }

  }
);


/* =========================
   YAYIN BİLGİLERİNİ KAYDET
========================= */

document
  .getElementById("saveBtn")
  .addEventListener(
    "click",
    async () => {

      try {

        readGamesFromForm();


        data.date =
          document
            .getElementById("date")
            .value;


        data.time =
          document
            .getElementById("time")
            .value;


        await setDoc(
          streamRef,
          data,
          {
            merge: true
          }
        );


        msg.textContent =
          "Yayın bilgileri kaydedildi! 💗";

      } catch (error) {

        console.error(error);

        msg.textContent =
          "Kaydedilemedi. Firestore güvenlik kurallarını kontrol et.";

      }

    }
  );


/* =========================
   OYUN EKLE
========================= */

document
  .getElementById("addBtn")
  .addEventListener(
    "click",
    () => {

      data.games.push({

        emoji: "🎮",

        name: "",

        main:
          data.games.length === 0

      });


      renderGames();

    }
  );


/* =========================
   OYUNLARI KAYDET
========================= */

document
  .getElementById("saveGamesBtn")
  .addEventListener(
    "click",
    async () => {

      try {

        readGamesFromForm();


        await setDoc(
          streamRef,
          {
            games: data.games
          },
          {
            merge: true
          }
        );


        msg.textContent =
          "Oyunlar kaydedildi! 🎮💗";

      } catch (error) {

        console.error(error);

        msg.textContent =
          "Oyunlar kaydedilemedi.";

      }

    }
  );


/* =========================
   ÇIKIŞ
========================= */

document
  .getElementById("logoutBtn")
  .addEventListener(
    "click",
    async () => {

      await signOut(auth);

    }
  );


/* =========================
   OYLARI SIFIRLA
========================= */

document
  .getElementById("resetBtn")
  .addEventListener(
    "click",
    async () => {

      const confirmed =
        confirm(
          "Tüm oy kayıtları silinsin mi?"
        );


      if (!confirmed) {
        return;
      }


      try {

        const snapshot =
          await getDocs(
            collection(
              db,
              "site",
              "stream",
              "voters"
            )
          );


        for (
          const voter of snapshot.docs
        ) {

          await deleteDoc(
            voter.ref
          );

        }


        msg.textContent =
          "Tüm oylar sıfırlandı! 🧹";

      } catch (error) {

        console.error(error);

        msg.textContent =
          "Oylar sıfırlanamadı.";

      }

    }
  );

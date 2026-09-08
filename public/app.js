const app = document.querySelector("#app");
const state = {
  users: [],
  selectedUser: null,
  route: window.location.pathname === "/admin" ? "admin" : "home",
  currentTime: new Date(),
  cameraStream: null,
  capturedPhoto: null,
  modalPhotoUrl: null,
};

const statusLabels = {
  not_clocked_in: "未出勤",
  clocked_in: "出勤中",
  clocked_out: "本日打刻済み",
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

setInterval(() => {
  state.currentTime = new Date();
  updateClockOnly();
}, 1000);

window.addEventListener("popstate", () => {
  state.route = window.location.pathname === "/admin" ? "admin" : "home";
  cleanupCamera();
  state.selectedUser = null;
  render();
});

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "通信に失敗しました");
  }
  return payload;
}

async function loadUsers() {
  const payload = await api("/api/users");
  state.users = payload.users;
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatTime(iso) {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatDate(isoDate) {
  return isoDate.replaceAll("-", "/");
}

function clockMarkup() {
  return `
    <div class="clock" data-clock>
      <span class="time">${state.currentTime.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
      <span class="date">${state.currentTime.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}</span>
    </div>
  `;
}

function updateClockOnly() {
  const clock = document.querySelector("[data-clock]");
  if (!clock) return;
  clock.innerHTML = `
    <span class="time">${state.currentTime.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
    <span class="date">${state.currentTime.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}</span>
  `;
}

function setRoute(route) {
  cleanupCamera();
  state.route = route;
  history.pushState({}, "", route === "admin" ? "/admin" : "/");
  render();
}

function selectUser(userId) {
  state.selectedUser = state.users.find((user) => user.id === userId);
  state.capturedPhoto = null;
  renderClockScreen();
}

function renderTop() {
  app.innerHTML = `
    <main class="screen">
      <header class="top-bar">
        <div class="brand">
          <h1>出退勤打刻</h1>
          <p>スタッフ名を選択してください</p>
        </div>
        ${clockMarkup()}
      </header>
      <section class="staff-grid">
        ${state.users
          .map(
            (user) => `
              <button class="staff-card" data-select-user="${user.id}">
                <span class="staff-name">${escapeHtml(user.name)}</span>
                <span class="status-badge ${user.attendance_status === "clocked_in" ? "in" : user.attendance_status === "clocked_out" ? "done" : ""}">
                  ${statusLabels[user.attendance_status] || "未出勤"}
                </span>
              </button>
            `
          )
          .join("")}
      </section>
    </main>
  `;
  document.querySelectorAll("[data-select-user]").forEach((button) => {
    button.addEventListener("click", () => selectUser(button.dataset.selectUser));
  });
}

function renderClockScreen(error = "") {
  const user = state.selectedUser;
  const canClockIn = user.attendance_status !== "clocked_in" && user.attendance_status !== "clocked_out";
  const canClockOut = user.attendance_status === "clocked_in";
  app.innerHTML = `
    <main class="screen">
      <header class="top-bar">
        <button class="nav-button" data-back>戻る</button>
        ${clockMarkup()}
      </header>
      <section class="work-panel">
        <div class="selected-staff">
          <h2>${escapeHtml(user.name)}</h2>
          <p class="state-text">${statusLabels[user.attendance_status] || "未出勤"}</p>
          ${error ? `<p class="error-text">${escapeHtml(error)}</p>` : ""}
        </div>
        <div class="action-row">
          <button class="primary-button" data-clock-in ${canClockIn ? "" : "disabled"}>出勤する</button>
          <button class="danger-button" data-clock-out ${canClockOut ? "" : "disabled"}>退勤する</button>
        </div>
        ${user.attendance_status === "clocked_out" ? `<p class="state-text">本日の打刻は完了しています。</p>` : ""}
      </section>
    </main>
  `;
  document.querySelector("[data-back]").addEventListener("click", returnHome);
  document.querySelector("[data-clock-in]").addEventListener("click", startCamera);
  document.querySelector("[data-clock-out]").addEventListener("click", confirmClockOut);
}

async function startCamera() {
  try {
    state.capturedPhoto = null;
    const constraints = {
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 960 },
      },
      audio: false,
    };
    state.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    renderCamera();
  } catch (error) {
    renderClockScreen("カメラを起動できませんでした。ブラウザのカメラ許可とHTTPS/localhost接続を確認してください。");
  }
}

function renderCamera() {
  const user = state.selectedUser;
  app.innerHTML = `
    <main class="screen">
      <header class="top-bar">
        <button class="nav-button" data-cancel-camera>キャンセル</button>
        ${clockMarkup()}
      </header>
      <section class="work-panel camera-layout">
        <div class="selected-staff">
          <h2>${escapeHtml(user.name)}</h2>
          <p class="state-text">出勤写真を撮影してください</p>
        </div>
        <video class="video-frame" data-video autoplay playsinline muted></video>
        <div class="action-row">
          <button class="primary-button" data-capture>撮影する</button>
          <button class="secondary-button" data-cancel-camera>キャンセル</button>
        </div>
      </section>
    </main>
  `;
  document.querySelector("[data-video]").srcObject = state.cameraStream;
  document.querySelector("[data-capture]").addEventListener("click", capturePhoto);
  document.querySelectorAll("[data-cancel-camera]").forEach((button) => {
    button.addEventListener("click", () => {
      cleanupCamera();
      renderClockScreen();
    });
  });
}

function capturePhoto() {
  const video = document.querySelector("[data-video]");
  const canvas = document.createElement("canvas");
  const maxWidth = 960;
  const sourceWidth = video.videoWidth || 960;
  const sourceHeight = video.videoHeight || 720;
  const scale = Math.min(1, maxWidth / sourceWidth);
  canvas.width = Math.round(sourceWidth * scale);
  canvas.height = Math.round(sourceHeight * scale);
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  state.capturedPhoto = canvas.toDataURL("image/jpeg", 0.78);
  cleanupCamera();
  renderPhotoConfirm();
}

function renderPhotoConfirm(error = "") {
  app.innerHTML = `
    <main class="screen">
      <header class="top-bar">
        <button class="nav-button" data-retake>撮り直す</button>
        ${clockMarkup()}
      </header>
      <section class="work-panel camera-layout">
        <div class="selected-staff">
          <h2>${escapeHtml(state.selectedUser.name)}</h2>
          <p class="state-text">写真を確認してください</p>
          ${error ? `<p class="error-text">${escapeHtml(error)}</p>` : ""}
        </div>
        <img class="photo-preview" src="${state.capturedPhoto}" alt="撮影画像のプレビュー" />
        <div class="action-row">
          <button class="primary-button" data-submit-clock-in>この写真で出勤する</button>
          <button class="secondary-button" data-retake>撮り直す</button>
        </div>
      </section>
    </main>
  `;
  document.querySelector("[data-submit-clock-in]").addEventListener("click", submitClockIn);
  document.querySelectorAll("[data-retake]").forEach((button) => button.addEventListener("click", startCamera));
}

async function submitClockIn() {
  try {
    await api("/api/clock-in", {
      method: "POST",
      body: JSON.stringify({
        user_id: state.selectedUser.id,
        photo_data_url: state.capturedPhoto,
      }),
    });
    await loadUsers();
    showCompletion("出勤を記録しました");
  } catch (error) {
    renderPhotoConfirm(error.message);
  }
}

function confirmClockOut() {
  app.innerHTML = `
    <main class="message-screen">
      <section class="message-box">
        <h2>${escapeHtml(state.selectedUser.name)}さんの退勤を記録しますか？</h2>
        <div class="action-row">
          <button class="danger-button" data-submit-clock-out>退勤する</button>
          <button class="secondary-button" data-cancel>キャンセル</button>
        </div>
      </section>
    </main>
  `;
  document.querySelector("[data-submit-clock-out]").addEventListener("click", submitClockOut);
  document.querySelector("[data-cancel]").addEventListener("click", renderClockScreen);
}

async function submitClockOut() {
  try {
    await api("/api/clock-out", {
      method: "POST",
      body: JSON.stringify({ user_id: state.selectedUser.id }),
    });
    await loadUsers();
    showCompletion("退勤を記録しました");
  } catch (error) {
    renderClockScreen(error.message);
  }
}

function showCompletion(message) {
  cleanupCamera();
  app.innerHTML = `
    <main class="message-screen">
      <section class="message-box">
        <h2>${message}</h2>
        <p>数秒後にスタッフ一覧へ戻ります</p>
      </section>
    </main>
  `;
  setTimeout(returnHome, 2500);
}

async function returnHome() {
  cleanupCamera();
  state.selectedUser = null;
  state.capturedPhoto = null;
  await loadUsers();
  state.route = "home";
  history.pushState({}, "", "/");
  renderTop();
}

function cleanupCamera() {
  if (!state.cameraStream) return;
  state.cameraStream.getTracks().forEach((track) => track.stop());
  state.cameraStream = null;
}

async function renderAdmin() {
  const payload = await api("/api/attendance");
  app.innerHTML = `
    <main class="screen">
      <header class="top-bar">
        <div class="brand">
          <h1>勤怠一覧</h1>
          <p>第一段階 管理者用確認画面</p>
        </div>
        <button class="nav-button" data-home>打刻画面へ</button>
      </header>
      <section class="admin-panel">
        ${
          payload.rows.length
            ? `
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>スタッフ</th>
                    <th>出勤</th>
                    <th>退勤</th>
                    <th>写真</th>
                  </tr>
                </thead>
                <tbody>
                  ${payload.rows
                    .map(
                      (row) => `
                        <tr>
                          <td>${formatDate(row.date)}</td>
                          <td>${escapeHtml(row.staff_name)}</td>
                          <td>${formatTime(row.clock_in)}</td>
                          <td>${formatTime(row.clock_out)}</td>
                          <td>${
                            row.photo_url
                              ? `<button class="small-button" data-photo="${escapeHtml(row.photo_url)}">写真を見る</button>`
                              : "-"
                          }</td>
                        </tr>
                      `
                    )
                    .join("")}
                </tbody>
              </table>
            `
            : `<div class="empty">勤怠記録はまだありません。</div>`
        }
      </section>
    </main>
    ${state.modalPhotoUrl ? photoModalMarkup(state.modalPhotoUrl) : ""}
  `;
  document.querySelector("[data-home]").addEventListener("click", () => setRoute("home"));
  document.querySelectorAll("[data-photo]").forEach((button) => {
    button.addEventListener("click", () => {
      state.modalPhotoUrl = button.dataset.photo;
      renderAdmin();
    });
  });
  document.querySelector("[data-close-modal]")?.addEventListener("click", () => {
    state.modalPhotoUrl = null;
    renderAdmin();
  });
}

function photoModalMarkup(url) {
  return `
    <div class="modal-backdrop">
      <div class="modal">
        <img src="${escapeHtml(url)}" alt="出勤時の撮影画像" />
        <div class="modal-actions">
          <button class="small-button" data-close-modal>閉じる</button>
        </div>
      </div>
    </div>
  `;
}

async function render() {
  try {
    if (state.route === "admin") {
      await renderAdmin();
      return;
    }
    await loadUsers();
    renderTop();
  } catch (error) {
    app.innerHTML = `<main class="screen"><p class="error-text">${escapeHtml(error.message)}</p></main>`;
  }
}

render();

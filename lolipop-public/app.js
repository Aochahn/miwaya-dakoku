const app = document.querySelector("#app");
const state = {
  users: [],
  selectedUser: null,
  route: window.location.pathname.endsWith("/admin.php") ? "admin" : "home",
  currentTime: new Date(),
  cameraStream: null,
  capturedPhoto: null,
  modalPhotoUrl: null,
  admin: null,
  adminTab: "attendance",
  attendanceRows: [],
  adminStaff: [],
  archivedStaff: [],
  correctionRequests: [],
  auditLogs: [],
  myShifts: [],
  adminShifts: [],
  shiftPreferences: [],
  generatedShifts: [],
  schedulerWarnings: [],
  shiftRangeFrom: toDateInputValue(),
  shiftRangeTo: toDateInputValue(new Date(Date.now() + 14 * 86400000)),
  schedulerWeekStart: toDateInputValue(),
};

const schedulerDays = ["月", "火", "水", "木", "金", "土", "日"];
const schedulerStart = 17 * 60 + 30;
const schedulerSlot = 30;
const schedulerSlotCount = 13;
const schedulerRoles = { hall: "ホール", kitchen: "キッチン" };

const statusLabels = {
  not_clocked_in: "未出勤",
  clocked_in: "出勤中",
  clocked_in_locked: "出勤中",
  clocked_out: "本日打刻済み",
};

const typeLabels = {
  clock_in: "出勤",
  clock_out: "退勤",
};

const requestStatusLabels = {
  pending: "未処理",
  approved: "承認済み",
  rejected: "却下",
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

function toDateTimeInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function toDateInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDateTimeText(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(String(value).replace(" ", "T")));
}

function formatTime(iso) {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(String(iso).replace(" ", "T")));
}

function formatDate(isoDate) {
  return String(isoDate || "").replace(/-/g, "/");
}

function minutesToTime(minutes) {
  if (minutes === 1440) return "24:00";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function timeToMinutes(time) {
  const [hour, minute] = String(time || "00:00").split(":").map(Number);
  return hour * 60 + minute;
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function roleLabel(role) {
  return schedulerRoles[role] || schedulerRoles.hall;
}

function timeOptions(startMinutes, endMinutes, selected) {
  let html = "";
  for (let minutes = startMinutes; minutes <= endMinutes; minutes += 30) {
    const value = minutesToTime(minutes);
    html += `<option value="${value}" ${selected === value ? "selected" : ""}>${value}</option>`;
  }
  return html;
}

function formatShiftTime(time) {
  return time ? String(time).slice(0, 5) : "-";
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

setInterval(() => {
  state.currentTime = new Date();
  updateClockOnly();
}, 1000);

window.addEventListener("popstate", () => {
  state.route = window.location.pathname.endsWith("/admin.php") ? "admin" : "home";
  cleanupCamera();
  state.selectedUser = null;
  render();
});

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload.error || "通信に失敗しました");
  }
  return payload;
}

async function loadUsers() {
  const payload = await api("./api/users.php");
  state.users = payload.users;
}

async function loadMyShifts() {
  if (!state.selectedUser) {
    state.myShifts = [];
    return;
  }
  const payload = await api(`./api/staff-shifts.php?user_id=${encodeURIComponent(state.selectedUser.id)}`);
  state.myShifts = payload.shifts;
}

function setRoute(route) {
  cleanupCamera();
  state.route = route;
  history.pushState({}, "", route === "admin" ? "./admin.php" : "./");
  render();
}

function renderTop() {
  state.selectedUser = null;
  app.innerHTML = `
    <main class="screen">
      <header class="top-bar">
        <div class="brand">
          <h1>出退勤打刻</h1>
          <p>スタッフ名を選択してPINコードを入力してください</p>
        </div>
        ${clockMarkup()}
      </header>
      <section class="staff-grid">
        ${state.users.map((user) => staffCardMarkup(user)).join("")}
      </section>
    </main>
  `;
  document.querySelectorAll("[data-select-user]").forEach((button) => {
    button.addEventListener("click", () => selectUser(button.dataset.selectUser));
  });
}

function staffCardMarkup(user) {
  const locked = user.locked_until ? `<span class="lock-note">次回打刻 ${formatTime(user.locked_until)} 以降</span>` : "";
  return `
    <button class="staff-card" data-select-user="${escapeHtml(user.id)}">
      <span class="staff-name">${escapeHtml(user.name)}</span>
      <span class="status-badge ${user.attendance_status === "clocked_in" || user.attendance_status === "clocked_in_locked" ? "in" : user.attendance_status === "clocked_out" ? "done" : ""}">
        ${statusLabels[user.attendance_status] || "未出勤"}
      </span>
      ${locked}
    </button>
  `;
}

function selectUser(userId) {
  state.selectedUser = state.users.find((user) => user.id === userId);
  state.capturedPhoto = null;
  renderStaffPin();
}

function renderStaffPin(error = "") {
  const user = state.selectedUser;
  app.innerHTML = `
    <main class="screen">
      <header class="top-bar">
        <button class="nav-button" data-back>戻る</button>
        ${clockMarkup()}
      </header>
      <section class="work-panel compact-panel">
        <div class="selected-staff">
          <h2>${escapeHtml(user.name)}</h2>
          <p class="state-text">PINコードを入力してください</p>
          ${error ? `<p class="error-text">${escapeHtml(error)}</p>` : ""}
        </div>
        <form class="form-grid" data-staff-login>
          <label>
            <span>PINコード</span>
            <input class="text-input pin-input" name="pin" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" required />
          </label>
          <button class="primary-button" type="submit">ログイン</button>
        </form>
      </section>
    </main>
  `;
  document.querySelector("[data-back]").addEventListener("click", returnHome);
  document.querySelector("[data-staff-login]").addEventListener("submit", submitStaffLogin);
  document.querySelector("[name='pin']").focus();
}

async function submitStaffLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("button[type='submit']");
  submit.disabled = true;
  try {
    const payload = await api("./api/staff-login.php", {
      method: "POST",
      body: JSON.stringify({
        user_id: state.selectedUser.id,
        pin: new FormData(form).get("pin"),
      }),
    });
    state.selectedUser = { ...state.selectedUser, ...payload.user };
    await loadMyShifts();
    renderClockScreen();
  } catch (error) {
    renderStaffPin(error.message);
  }
}

function renderClockScreen(error = "") {
  const user = state.selectedUser;
  const locked = Boolean(user.locked_until);
  const canClockIn = user.attendance_status === "not_clocked_in" && !locked;
  const canClockOut = user.attendance_status === "clocked_in" && !locked;
  const lockMessage = locked ? `<p class="state-text">出勤後3時間は打刻できません。次回打刻は ${formatDateTimeText(user.locked_until)} 以降です。</p>` : "";
  app.innerHTML = `
    <main class="screen">
      <header class="top-bar">
        <button class="nav-button" data-back>戻る</button>
        ${clockMarkup()}
      </header>
      <section class="work-panel">
        <div class="selected-staff">
          <p class="page-label">マイページ</p>
          <h2>${escapeHtml(user.name)}</h2>
          <p class="state-text">${statusLabels[user.attendance_status] || "未出勤"}</p>
          ${error ? `<p class="error-text">${escapeHtml(error)}</p>` : ""}
          ${lockMessage}
        </div>
        <div class="action-row">
          <button class="primary-button" data-clock-in ${canClockIn ? "" : "disabled"}>出勤する</button>
          <button class="danger-button" data-clock-out ${canClockOut ? "" : "disabled"}>退勤する</button>
        </div>
        <button class="secondary-button full-button" data-correction>打刻修正を申請する</button>
        ${user.attendance_status === "clocked_out" ? `<p class="state-text">本日の打刻は完了しています。</p>` : ""}
        ${myShiftMarkup()}
      </section>
    </main>
  `;
  document.querySelector("[data-back]").addEventListener("click", returnHome);
  document.querySelector("[data-clock-in]").addEventListener("click", startCamera);
  document.querySelector("[data-clock-out]").addEventListener("click", confirmClockOut);
  document.querySelector("[data-correction]").addEventListener("click", renderCorrectionForm);
}

function myShiftMarkup() {
  return `
    <section class="sub-panel">
      <div class="panel-toolbar inline-toolbar">
        <strong>シフト確認</strong>
      </div>
      ${
        state.myShifts.length
          ? `<div class="shift-list">
              ${state.myShifts.map((shift) => `
                <div class="shift-item">
                  <div>
                    <strong>${formatDate(shift.shift_date)}</strong>
                    <span>${formatShiftTime(shift.start_time)} - ${formatShiftTime(shift.end_time)}</span>
                  </div>
                  <small>休憩 ${Number(shift.break_minutes || 0)}分${shift.note ? ` / ${escapeHtml(shift.note)}` : ""}</small>
                </div>
              `).join("")}
            </div>`
          : `<div class="empty small-empty">登録されている今後のシフトはありません。</div>`
      }
    </section>
  `;
}

function renderCorrectionForm(error = "") {
  const user = state.selectedUser;
  app.innerHTML = `
    <main class="screen">
      <header class="top-bar">
        <button class="nav-button" data-back>戻る</button>
        ${clockMarkup()}
      </header>
      <section class="work-panel compact-panel">
        <div class="selected-staff">
          <h2>${escapeHtml(user.name)}</h2>
          <p class="state-text">管理者へ打刻修正を申請します</p>
          ${error ? `<p class="error-text">${escapeHtml(error)}</p>` : ""}
        </div>
        <form class="form-grid" data-correction-form>
          <label>
            <span>修正種別</span>
            <select class="text-input" name="requested_type">
              <option value="clock_in">出勤</option>
              <option value="clock_out">退勤</option>
            </select>
          </label>
          <label>
            <span>希望日時</span>
            <input class="text-input" name="requested_at" type="datetime-local" value="${toDateTimeInputValue()}" required />
          </label>
          <label>
            <span>申請理由</span>
            <textarea class="text-input" name="reason" rows="4" required></textarea>
          </label>
          <div class="action-row">
            <button class="primary-button" type="submit">申請する</button>
            <button class="secondary-button" type="button" data-cancel>キャンセル</button>
          </div>
        </form>
      </section>
    </main>
  `;
  document.querySelector("[data-back]").addEventListener("click", renderClockScreen);
  document.querySelector("[data-cancel]").addEventListener("click", renderClockScreen);
  document.querySelector("[data-correction-form]").addEventListener("submit", submitCorrectionRequest);
}

async function submitCorrectionRequest(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("button[type='submit']");
  submit.disabled = true;
  const data = new FormData(form);
  try {
    await api("./api/correction-request.php", {
      method: "POST",
      body: JSON.stringify({
        user_id: state.selectedUser.id,
        requested_type: data.get("requested_type"),
        requested_at: data.get("requested_at"),
        reason: data.get("reason"),
      }),
    });
    showCompletion("修正申請を送信しました");
  } catch (error) {
    renderCorrectionForm(error.message);
  }
}

async function startCamera() {
  try {
    state.capturedPhoto = null;
    state.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false,
    });
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

async function submitClockIn(event) {
  const submit = event.currentTarget;
  submit.disabled = true;
  try {
    await api("./api/clock-in.php", {
      method: "POST",
      body: JSON.stringify({
        user_id: state.selectedUser.id,
        photo_data_url: state.capturedPhoto,
      }),
    });
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

async function submitClockOut(event) {
  const submit = event.currentTarget;
  submit.disabled = true;
  try {
    await api("./api/clock-out.php", {
      method: "POST",
      body: JSON.stringify({ user_id: state.selectedUser.id }),
    });
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
        <h2>${escapeHtml(message)}</h2>
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
  await api("./api/staff-logout.php", { method: "POST", body: "{}" }).catch(() => {});
  await loadUsers();
  state.route = "home";
  history.pushState({}, "", "./");
  renderTop();
}

function cleanupCamera() {
  if (!state.cameraStream) return;
  state.cameraStream.getTracks().forEach((track) => track.stop());
  state.cameraStream = null;
}

async function renderAdmin() {
  const session = await api("./api/admin-session.php");
  state.admin = session.authenticated ? session.admin : null;
  if (!state.admin) {
    renderAdminLogin();
    return;
  }
  await loadAdminTab();
  renderAdminShell();
}

function renderAdminLogin(error = "") {
  app.innerHTML = `
    <main class="message-screen">
      <section class="message-box login-box">
        <h2>管理者ログイン</h2>
        ${error ? `<p class="error-text">${escapeHtml(error)}</p>` : ""}
        <form class="form-grid" data-admin-login>
          <label>
            <span>ユーザー名</span>
            <input class="text-input" name="username" autocomplete="username" required />
          </label>
          <label>
            <span>パスワード</span>
            <input class="text-input" name="password" type="password" autocomplete="current-password" required />
          </label>
          <button class="primary-button" type="submit">ログイン</button>
        </form>
      </section>
    </main>
  `;
  document.querySelector("[data-admin-login]").addEventListener("submit", submitAdminLogin);
}

async function submitAdminLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  try {
    await api("./api/admin-login.php", {
      method: "POST",
      body: JSON.stringify({
        username: data.get("username"),
        password: data.get("password"),
      }),
    });
    await renderAdmin();
  } catch (error) {
    renderAdminLogin(error.message);
  }
}

async function loadAdminTab() {
  if (state.adminTab === "attendance") {
    const payload = await api("./api/attendance.php");
    state.attendanceRows = payload.rows;
  }
  if (state.adminTab === "staff") {
    const payload = await api("./api/admin-staff.php");
    state.adminStaff = payload.users;
    state.archivedStaff = payload.archived_users || [];
  }
  if (state.adminTab === "corrections") {
    const payload = await api("./api/admin-correction-requests.php");
    state.correctionRequests = payload.requests;
  }
  if (state.adminTab === "audit") {
    const payload = await api("./api/admin-audit-logs.php");
    state.auditLogs = payload.logs;
  }
  if (state.adminTab === "shifts") {
    const [staffPayload, shiftPayload, preferencePayload] = await Promise.all([
      api("./api/admin-staff.php"),
      api(`./api/admin-shifts.php?from=${encodeURIComponent(state.shiftRangeFrom)}&to=${encodeURIComponent(state.shiftRangeTo)}`),
      api("./api/admin-shift-preferences.php"),
    ]);
    state.adminStaff = staffPayload.users;
    state.archivedStaff = staffPayload.archived_users || [];
    state.adminShifts = shiftPayload.shifts;
    state.shiftPreferences = preferencePayload.preferences;
  }
}

function renderAdminShell() {
  app.innerHTML = `
    <main class="screen">
      <header class="top-bar">
        <div class="brand">
          <h1>管理画面</h1>
          <p>${escapeHtml(state.admin.username)} でログイン中</p>
        </div>
        <div class="header-actions">
          <button class="nav-button" data-home>打刻画面へ</button>
          <button class="nav-button" data-admin-logout>ログアウト</button>
        </div>
      </header>
      <nav class="tabs">
        ${adminTabButton("attendance", "勤怠一覧")}
        ${adminTabButton("staff", "スタッフ管理")}
        ${adminTabButton("shifts", "シフト管理")}
        ${adminTabButton("corrections", "修正申請")}
        ${adminTabButton("audit", "監査ログ")}
        ${adminTabButton("profile", "管理者設定")}
      </nav>
      ${adminTabContent()}
    </main>
    ${state.modalPhotoUrl ? photoModalMarkup(state.modalPhotoUrl) : ""}
  `;
  document.querySelector("[data-home]").addEventListener("click", () => setRoute("home"));
  document.querySelector("[data-admin-logout]").addEventListener("click", submitAdminLogout);
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.adminTab = button.dataset.adminTab;
      await renderAdmin();
    });
  });
  bindAdminTabEvents();
}

function adminTabButton(tab, label) {
  return `<button class="tab-button ${state.adminTab === tab ? "active" : ""}" data-admin-tab="${tab}">${label}</button>`;
}

function adminTabContent() {
  if (state.adminTab === "staff") return adminStaffMarkup();
  if (state.adminTab === "shifts") return adminShiftsMarkup();
  if (state.adminTab === "corrections") return adminCorrectionsMarkup();
  if (state.adminTab === "audit") return adminAuditMarkup();
  if (state.adminTab === "profile") return adminProfileMarkup();
  return adminAttendanceMarkup();
}

function adminShiftsMarkup() {
  return `
    <section class="admin-panel">
      <div class="panel-toolbar">
        <strong>シフト管理</strong>
        <div class="toolbar-form">
          <input class="table-input" type="date" data-shift-from value="${escapeHtml(state.shiftRangeFrom)}" />
          <input class="table-input" type="date" data-shift-to value="${escapeHtml(state.shiftRangeTo)}" />
          <button class="small-button" data-load-shifts>表示</button>
        </div>
      </div>
      <div class="scheduler-panel">
        <div class="scheduler-head">
          <div>
            <strong>週間シフト自動編成</strong>
            <p>営業18:00〜23:00、出勤枠17:30〜24:00、ホール/キッチン各1名を基準に編成します。</p>
          </div>
          <div class="toolbar-form">
            <input class="table-input" type="date" data-scheduler-week-start value="${escapeHtml(state.schedulerWeekStart)}" />
            <button class="small-button" data-save-shift-preferences>条件保存</button>
            <button class="small-button" data-generate-shifts>自動編成</button>
            <button class="small-button" data-save-generated-shifts ${state.generatedShifts.length ? "" : "disabled"}>生成シフトを保存</button>
          </div>
        </div>
        <div class="scheduler-preferences">
          ${state.shiftPreferences.filter((user) => Number(user.active)).map((pref) => shiftPreferenceRowMarkup(pref)).join("") || `<div class="empty">スタッフが登録されていません。</div>`}
        </div>
        ${schedulerPreviewMarkup()}
      </div>
      <form class="shift-form" data-shift-form>
        <select class="text-input" name="user_id" required>
          <option value="">スタッフ選択</option>
          ${state.adminStaff.filter((user) => Number(user.active)).map((user) => `
            <option value="${escapeHtml(user.id)}">${escapeHtml(user.name)}</option>
          `).join("")}
        </select>
        <input class="text-input" name="shift_date" type="date" value="${toDateInputValue()}" required />
        <input class="text-input" name="start_time" type="time" />
        <input class="text-input" name="end_time" type="time" />
        <input class="text-input" name="break_minutes" type="number" min="0" max="1440" step="5" value="0" />
        <input class="text-input" name="note" placeholder="メモ" />
        <button class="primary-button compact-button" type="submit">保存</button>
      </form>
      ${
        state.adminShifts.length
          ? `<table class="admin-table shift-table">
              <thead>
                <tr><th>日付</th><th>スタッフ</th><th>開始</th><th>終了</th><th>休憩</th><th>メモ</th><th>操作</th></tr>
              </thead>
              <tbody>
                ${state.adminShifts.map((shift) => `
                  <tr data-shift-row="${escapeHtml(shift.id)}">
                    <td>${formatDate(shift.shift_date)}</td>
                    <td>${escapeHtml(shift.staff_name)}</td>
                    <td>${formatShiftTime(shift.start_time)}</td>
                    <td>${formatShiftTime(shift.end_time)}</td>
                    <td>${Number(shift.break_minutes || 0)}分</td>
                    <td class="wrap-cell">${escapeHtml(shift.note || "")}</td>
                    <td>
                      <button class="small-button" data-edit-shift="${escapeHtml(shift.id)}">編集</button>
                      <button class="small-button danger-text" data-delete-shift="${escapeHtml(shift.id)}">削除</button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>`
          : `<div class="empty">指定期間のシフトはまだありません。</div>`
      }
    </section>
  `;
}

function shiftPreferenceRowMarkup(pref) {
  const days = String(pref.available_days || "").split(",").filter(Boolean).map(Number);
  return `
    <div class="scheduler-pref-row" data-shift-pref="${escapeHtml(pref.id)}">
      <div class="scheduler-pref-name">${escapeHtml(pref.name)}</div>
      <select class="table-input" name="role">
        <option value="hall" ${pref.role === "hall" ? "selected" : ""}>ホール</option>
        <option value="kitchen" ${pref.role === "kitchen" ? "selected" : ""}>キッチン</option>
      </select>
      <div class="weekday-checks">
        ${schedulerDays.map((day, index) => `
          <label><input type="checkbox" name="available_days" value="${index}" ${days.includes(index) ? "checked" : ""} />${day}</label>
        `).join("")}
      </div>
      <select class="table-input" name="available_start">${timeOptions(schedulerStart, 23 * 60 + 30, String(pref.available_start || "17:30").slice(0, 5))}</select>
      <select class="table-input" name="available_end">${timeOptions(18 * 60, 24 * 60, String(pref.available_end || "24:00").slice(0, 5))}</select>
      <label class="priority-toggle"><input type="checkbox" name="priority" ${Number(pref.priority) ? "checked" : ""} />固定優先</label>
    </div>
  `;
}

function schedulerPreviewMarkup() {
  if (!state.generatedShifts.length && !state.schedulerWarnings.length) {
    return `<div class="scheduler-preview empty">まだ自動編成していません。</div>`;
  }

  const days = Array.from({ length: 7 }, (_, index) => addDays(state.schedulerWeekStart, index));
  return `
    <div class="scheduler-preview">
      ${state.schedulerWarnings.length ? `<div class="warning-box">${state.schedulerWarnings.map(escapeHtml).join("<br>")}</div>` : ""}
      <div class="generated-grid">
        ${days.map((date, index) => {
          const shifts = state.generatedShifts.filter((shift) => shift.shift_date === date);
          return `
            <div class="generated-day">
              <strong>${formatDate(date)}（${schedulerDays[index]}）</strong>
              ${
                shifts.length
                  ? shifts.map((shift) => `
                    <div class="generated-shift">
                      <span>${escapeHtml(shift.staff_name)} / ${roleLabel(shift.role)}</span>
                      <b>${escapeHtml(shift.start_time)}〜${escapeHtml(shift.end_time)}</b>
                    </div>
                  `).join("")
                  : `<div class="small-empty">勤務なし</div>`
              }
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function adminAttendanceMarkup() {
  return `
    <section class="admin-panel">
      <div class="panel-toolbar">
        <strong>勤怠一覧</strong>
        <button class="small-button" data-export-csv>CSV出力</button>
      </div>
      ${
        state.attendanceRows.length
          ? `<table class="admin-table">
              <thead>
                <tr><th>日付</th><th>スタッフ</th><th>出勤</th><th>退勤</th><th>写真</th></tr>
              </thead>
              <tbody>
                ${state.attendanceRows.map((row) => `
                  <tr>
                    <td>${formatDate(row.date)}</td>
                    <td>${escapeHtml(row.staff_name)}</td>
                    <td>${formatTime(row.clock_in)}</td>
                    <td>${formatTime(row.clock_out)}</td>
                    <td>${row.photo_url ? `<button class="small-button" data-photo="${escapeHtml(row.photo_url)}">写真を見る</button>` : "-"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>`
          : `<div class="empty">勤怠記録はまだありません。</div>`
      }
    </section>
  `;
}

function adminStaffMarkup() {
  return `
    <section class="admin-panel">
      <div class="panel-toolbar"><strong>スタッフ管理</strong></div>
      <form class="staff-create-form" data-create-staff-form>
        <input class="text-input" name="name" placeholder="スタッフ名" required />
        <input class="text-input" name="display_order" type="number" min="1" step="1" value="${state.adminStaff.length + 1}" />
        <input class="text-input" name="pin" type="password" inputmode="numeric" placeholder="初期PIN 4〜8桁" />
        <label class="staff-active-toggle"><input name="active" type="checkbox" checked />有効</label>
        <button class="primary-button compact-button" type="submit">スタッフ追加</button>
      </form>
      <table class="admin-table editable-table">
        <thead>
          <tr><th>表示順</th><th>スタッフ名</th><th>PIN変更</th><th>操作</th></tr>
        </thead>
        <tbody>
          ${state.adminStaff.map((user) => `
            <tr data-staff-row="${escapeHtml(user.id)}">
              <td><input class="table-input" name="display_order" type="number" value="${escapeHtml(user.display_order)}" /></td>
              <td><input class="table-input wide" name="name" value="${escapeHtml(user.name)}" /></td>
              <td><input class="table-input pin-small" name="pin" type="password" inputmode="numeric" placeholder="4〜8桁" /></td>
              <td>
                <button class="small-button" data-save-staff="${escapeHtml(user.id)}">保存</button>
                <button class="small-button" data-save-pin="${escapeHtml(user.id)}">PIN保存</button>
                <button class="small-button danger-text" data-archive-staff="${escapeHtml(user.id)}">アーカイブ</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div class="archive-panel">
        <div class="panel-toolbar inline-panel-toolbar"><strong>アーカイブログ</strong></div>
        ${
          state.archivedStaff.length
            ? `<table class="admin-table archive-table">
                <thead>
                  <tr><th>スタッフ</th><th>アーカイブ日時</th><th>特徴・引き継ぎ</th><th>操作</th></tr>
                </thead>
                <tbody>
                  ${state.archivedStaff.map((user) => `
                    <tr data-archived-staff-row="${escapeHtml(user.id)}">
                      <td>${escapeHtml(user.name)}</td>
                      <td>${formatDateTimeText(user.archived_at)}</td>
                      <td><textarea class="table-input archive-note-input" name="archive_note">${escapeHtml(user.archive_note || "")}</textarea></td>
                      <td>
                        <button class="small-button" data-save-archive-note="${escapeHtml(user.id)}">備考保存</button>
                        <button class="small-button" data-restore-staff="${escapeHtml(user.id)}">復帰</button>
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>`
            : `<div class="empty">アーカイブ済みスタッフはいません。</div>`
        }
      </div>
    </section>
  `;
}

function adminCorrectionsMarkup() {
  return `
    <section class="admin-panel">
      <div class="panel-toolbar"><strong>修正申請</strong></div>
      ${
        state.correctionRequests.length
          ? `<table class="admin-table correction-table">
              <thead>
                <tr><th>状態</th><th>スタッフ</th><th>種別</th><th>希望日時</th><th>理由</th><th>管理メモ</th><th>操作</th></tr>
              </thead>
              <tbody>
                ${state.correctionRequests.map((request) => `
                  <tr data-request-row="${escapeHtml(request.id)}">
                    <td>${requestStatusLabels[request.status] || request.status}</td>
                    <td>${escapeHtml(request.staff_name)}</td>
                    <td>${typeLabels[request.requested_type] || request.requested_type}</td>
                    <td>${formatDateTimeText(request.requested_at)}</td>
                    <td class="wrap-cell">${escapeHtml(request.reason)}</td>
                    <td><input class="table-input wide" name="admin_note" value="${escapeHtml(request.admin_note || "")}" ${request.status !== "pending" ? "disabled" : ""} /></td>
                    <td>
                      ${
                        request.status === "pending"
                          ? `<button class="small-button" data-approve-request="${escapeHtml(request.id)}">承認</button>
                             <button class="small-button danger-text" data-reject-request="${escapeHtml(request.id)}">却下</button>`
                          : "-"
                      }
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>`
          : `<div class="empty">修正申請はまだありません。</div>`
      }
    </section>
  `;
}

function adminAuditMarkup() {
  return `
    <section class="admin-panel">
      <div class="panel-toolbar"><strong>監査ログ</strong></div>
      ${
        state.auditLogs.length
          ? `<table class="admin-table">
              <thead>
                <tr><th>日時</th><th>実行者</th><th>操作</th><th>対象</th><th>IP</th></tr>
              </thead>
              <tbody>
                ${state.auditLogs.map((log) => `
                  <tr>
                    <td>${formatDateTimeText(log.created_at)}</td>
                    <td>${escapeHtml(log.actor_type)} ${escapeHtml(log.actor_id || "")}</td>
                    <td>${escapeHtml(log.action)}</td>
                    <td>${escapeHtml(log.target_type || "")} ${escapeHtml(log.target_id || "")}</td>
                    <td>${escapeHtml(log.ip_address || "-")}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>`
          : `<div class="empty">監査ログはまだありません。</div>`
      }
    </section>
  `;
}

function adminProfileMarkup() {
  return `
    <section class="admin-panel">
      <div class="panel-toolbar"><strong>管理者設定</strong></div>
      <form class="form-grid admin-form" data-admin-password-form>
        <label>
          <span>現在のパスワード</span>
          <input class="text-input" name="current_password" type="password" autocomplete="current-password" required />
        </label>
        <label>
          <span>新しいパスワード</span>
          <input class="text-input" name="new_password" type="password" autocomplete="new-password" minlength="8" required />
        </label>
        <button class="primary-button" type="submit">パスワード変更</button>
      </form>
    </section>
  `;
}

function bindAdminTabEvents() {
  document.querySelectorAll("[data-photo]").forEach((button) => {
    button.addEventListener("click", () => {
      state.modalPhotoUrl = button.dataset.photo;
      renderAdminShell();
    });
  });
  document.querySelector("[data-close-modal]")?.addEventListener("click", () => {
    state.modalPhotoUrl = null;
    renderAdminShell();
  });
  document.querySelector("[data-export-csv]")?.addEventListener("click", exportAttendanceCsv);
  document.querySelector("[data-create-staff-form]")?.addEventListener("submit", createStaff);
  document.querySelectorAll("[data-save-staff]").forEach((button) => button.addEventListener("click", () => saveStaff(button.dataset.saveStaff)));
  document.querySelectorAll("[data-save-pin]").forEach((button) => button.addEventListener("click", () => saveStaffPin(button.dataset.savePin)));
  document.querySelectorAll("[data-archive-staff]").forEach((button) => button.addEventListener("click", () => archiveStaff(button.dataset.archiveStaff)));
  document.querySelectorAll("[data-save-archive-note]").forEach((button) => button.addEventListener("click", () => saveArchiveNote(button.dataset.saveArchiveNote)));
  document.querySelectorAll("[data-restore-staff]").forEach((button) => button.addEventListener("click", () => restoreStaff(button.dataset.restoreStaff)));
  document.querySelector("[data-load-shifts]")?.addEventListener("click", reloadShiftRange);
  document.querySelector("[data-shift-form]")?.addEventListener("submit", saveShift);
  document.querySelectorAll("[data-edit-shift]").forEach((button) => button.addEventListener("click", () => fillShiftForm(button.dataset.editShift)));
  document.querySelectorAll("[data-delete-shift]").forEach((button) => button.addEventListener("click", () => deleteShift(button.dataset.deleteShift)));
  document.querySelector("[data-save-shift-preferences]")?.addEventListener("click", saveShiftPreferences);
  document.querySelector("[data-generate-shifts]")?.addEventListener("click", generateShiftSchedule);
  document.querySelector("[data-save-generated-shifts]")?.addEventListener("click", saveGeneratedShifts);
  document.querySelectorAll("[data-approve-request]").forEach((button) => button.addEventListener("click", () => reviewCorrectionRequest(button.dataset.approveRequest, "approve")));
  document.querySelectorAll("[data-reject-request]").forEach((button) => button.addEventListener("click", () => reviewCorrectionRequest(button.dataset.rejectRequest, "reject")));
  document.querySelector("[data-admin-password-form]")?.addEventListener("submit", changeAdminPassword);
}

function collectShiftPreferences() {
  return [...document.querySelectorAll("[data-shift-pref]")].map((row) => ({
    user_id: row.dataset.shiftPref,
    staff_name: row.querySelector(".scheduler-pref-name")?.textContent || "",
    role: row.querySelector("[name='role']").value,
    available_days: [...row.querySelectorAll("[name='available_days']:checked")].map((input) => Number(input.value)),
    available_start: row.querySelector("[name='available_start']").value,
    available_end: row.querySelector("[name='available_end']").value,
    priority: row.querySelector("[name='priority']").checked,
  }));
}

async function saveShiftPreferences() {
  await api("./api/admin-shift-preferences.php", {
    method: "POST",
    body: JSON.stringify({ preferences: collectShiftPreferences() }),
  });
  await renderAdmin();
}

function schedulerAvailable(person, day, slot) {
  const slotStart = schedulerStart + slot * schedulerSlot;
  const slotEnd = slotStart + schedulerSlot;
  return person.available_days.includes(day)
    && slotStart >= timeToMinutes(person.available_start)
    && slotEnd <= timeToMinutes(person.available_end);
}

function schedulerRoleCounts(people, work, day, slot) {
  return people.reduce((counts, person, index) => {
    if (!work[index][day][slot]) return counts;
    counts[person.role] += 1;
    counts.total += 1;
    return counts;
  }, { hall: 0, kitchen: 0, total: 0 });
}

function generateShiftSchedule() {
  const weekStart = document.querySelector("[data-scheduler-week-start]")?.value || toDateInputValue();
  state.schedulerWeekStart = weekStart;
  const people = collectShiftPreferences()
    .filter((person) => person.available_days.length > 0)
    .map((person) => ({ ...person, weeklyHours: 0, dailyHours: Array(7).fill(0) }));
  const warnings = [];

  if (!people.length) {
    state.generatedShifts = [];
    state.schedulerWarnings = ["出勤可能なスタッフ条件がありません。"];
    renderAdminShell();
    return;
  }

  const work = people.map(() => Array.from({ length: 7 }, () => Array(schedulerSlotCount).fill(false)));

  function blocksFor(person, day) {
    const blocks = [];
    for (let start = 0; start < schedulerSlotCount; start += 1) {
      for (let end = start + 5; end <= schedulerSlotCount; end += 1) {
        let ok = true;
        for (let slot = start; slot < end; slot += 1) {
          if (!schedulerAvailable(person, day, slot)) {
            ok = false;
            break;
          }
        }
        if (ok) blocks.push({ start, end, hours: (end - start) * 0.5 });
      }
    }
    return blocks;
  }

  function tripleSlotsAfter(index, day, block) {
    let count = 0;
    for (let slot = 0; slot < schedulerSlotCount; slot += 1) {
      let assigned = 0;
      for (let personIndex = 0; personIndex < people.length; personIndex += 1) {
        assigned += work[personIndex][day][slot] ? 1 : 0;
      }
      if (slot >= block.start && slot < block.end) assigned += 1;
      if (assigned >= 3) count += 1;
    }
    return count;
  }

  for (let day = 0; day < 7; day += 1) {
    people.forEach((person, index) => {
      if (!person.priority || person.dailyHours[day] > 0) return;
      const slots = [];
      for (let slot = 0; slot < schedulerSlotCount; slot += 1) {
        if (schedulerAvailable(person, day, slot)) slots.push(slot);
      }
      if (!slots.length) return;
      slots.forEach((slot) => { work[index][day][slot] = true; });
      person.weeklyHours += slots.length * 0.5;
      person.dailyHours[day] = slots.length * 0.5;
    });

    const candidates = [];
    people.forEach((person, index) => {
      if (person.priority) return;
      blocksFor(person, day).forEach((block) => candidates.push({ index, block }));
    });

    while (true) {
      let missing = 0;
      for (let slot = 0; slot < schedulerSlotCount; slot += 1) {
        const slotStart = schedulerStart + slot * schedulerSlot;
        if (slotStart < 18 * 60 || slotStart >= 23 * 60) continue;
        const counts = schedulerRoleCounts(people, work, day, slot);
        if (counts.hall < 1) missing += 1;
        if (counts.kitchen < 1) missing += 1;
      }
      if (missing === 0) break;

      let best = null;
      let bestScore = -Infinity;
      for (const candidate of candidates) {
        const person = people[candidate.index];
        if (person.dailyHours[day] > 0 || person.weeklyHours + candidate.block.hours > 20) continue;
        if (tripleSlotsAfter(candidate.index, day, candidate.block) > 2) continue;

        let roleGain = 0;
        let businessGain = 0;
        let overlap = 0;
        for (let slot = candidate.block.start; slot < candidate.block.end; slot += 1) {
          const slotStart = schedulerStart + slot * schedulerSlot;
          const counts = schedulerRoleCounts(people, work, day, slot);
          if (counts[person.role] < 1) roleGain += 1;
          if (slotStart >= 18 * 60 && slotStart < 23 * 60 && counts[person.role] < 1) businessGain += 1;
          if (counts.total >= 2) overlap += 1;
        }
        if (businessGain === 0) continue;

        const score = roleGain * 100000 + businessGain * 1000 - overlap * 10000 + (20 - person.weeklyHours) * 10 - person.weeklyHours;
        if (score > bestScore) {
          bestScore = score;
          best = candidate;
        }
      }

      if (!best) break;

      const person = people[best.index];
      for (let slot = best.block.start; slot < best.block.end; slot += 1) {
        work[best.index][day][slot] = true;
      }
      person.weeklyHours += best.block.hours;
      person.dailyHours[day] = best.block.hours;
      candidates.splice(candidates.indexOf(best), 1);
    }
  }

  const generated = [];
  for (let day = 0; day < 7; day += 1) {
    for (let index = 0; index < people.length; index += 1) {
      const slots = work[index][day].map((active, slot) => (active ? slot : null)).filter((slot) => slot !== null);
      if (!slots.length) continue;
      generated.push({
        user_id: people[index].user_id,
        staff_name: people[index].staff_name,
        shift_date: addDays(weekStart, day),
        start_time: minutesToTime(schedulerStart + slots[0] * schedulerSlot),
        end_time: minutesToTime(schedulerStart + (slots[slots.length - 1] + 1) * schedulerSlot),
        break_minutes: 0,
        note: `自動編成: ${roleLabel(people[index].role)}`,
        role: people[index].role,
      });
    }

    for (let slot = 1; slot < 11; slot += 1) {
      const counts = schedulerRoleCounts(people, work, day, slot);
      if (counts.hall < 1 || counts.kitchen < 1) {
        warnings.push(`${schedulerDays[day]} ${minutesToTime(schedulerStart + slot * schedulerSlot)}: ${counts.hall < 1 ? "ホール不足 " : ""}${counts.kitchen < 1 ? "キッチン不足" : ""}`.trim());
      }
    }
  }

  people.forEach((person) => {
    if (person.weeklyHours > 20) warnings.push(`${person.staff_name}: 週20時間を超過しています。`);
  });

  state.generatedShifts = generated;
  state.schedulerWarnings = warnings;
  renderAdminShell();
}

async function saveGeneratedShifts() {
  if (!state.generatedShifts.length) return;
  if (!window.confirm("生成したシフトを保存しますか？同じスタッフ・日付の既存シフトは上書きされます。")) return;

  await api("./api/admin-shifts.php", {
    method: "POST",
    body: JSON.stringify({ action: "bulk_save", shifts: state.generatedShifts }),
  });
  state.shiftRangeFrom = state.schedulerWeekStart;
  state.shiftRangeTo = addDays(state.schedulerWeekStart, 6);
  state.generatedShifts = [];
  state.schedulerWarnings = [];
  await renderAdmin();
}

async function reloadShiftRange() {
  state.shiftRangeFrom = document.querySelector("[data-shift-from]").value || toDateInputValue();
  state.shiftRangeTo = document.querySelector("[data-shift-to]").value || state.shiftRangeFrom;
  await renderAdmin();
}

async function saveShift(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  await api("./api/admin-shifts.php", {
    method: "POST",
    body: JSON.stringify({
      user_id: data.get("user_id"),
      shift_date: data.get("shift_date"),
      start_time: data.get("start_time"),
      end_time: data.get("end_time"),
      break_minutes: data.get("break_minutes"),
      note: data.get("note"),
    }),
  });
  form.reset();
  form.querySelector("[name='shift_date']").value = toDateInputValue();
  form.querySelector("[name='break_minutes']").value = "0";
  await renderAdmin();
}

function fillShiftForm(shiftId) {
  const shift = state.adminShifts.find((item) => item.id === shiftId);
  const form = document.querySelector("[data-shift-form]");
  if (!shift || !form) return;
  form.querySelector("[name='user_id']").value = shift.user_id;
  form.querySelector("[name='shift_date']").value = shift.shift_date;
  form.querySelector("[name='start_time']").value = String(shift.start_time || "").slice(0, 5);
  form.querySelector("[name='end_time']").value = String(shift.end_time || "").slice(0, 5);
  form.querySelector("[name='break_minutes']").value = shift.break_minutes || 0;
  form.querySelector("[name='note']").value = shift.note || "";
}

async function deleteShift(shiftId) {
  if (!window.confirm("このシフトを削除しますか？")) return;
  await api("./api/admin-shifts.php", {
    method: "POST",
    body: JSON.stringify({ action: "delete", shift_id: shiftId }),
  });
  await renderAdmin();
}

function findDataRow(attribute, value) {
  return [...document.querySelectorAll(`[${attribute}]`)].find((row) => row.getAttribute(attribute) === value);
}

async function submitAdminLogout() {
  await api("./api/admin-logout.php", { method: "POST", body: "{}" });
  state.admin = null;
  renderAdminLogin();
}

async function createStaff(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  await api("./api/admin-staff.php", {
    method: "POST",
    body: JSON.stringify({
      action: "create_staff",
      name: data.get("name"),
      display_order: data.get("display_order"),
      pin: data.get("pin"),
      active: data.get("active") === "on",
    }),
  });
  form.reset();
  await loadUsers();
  await renderAdmin();
}

async function saveStaff(userId) {
  const row = findDataRow("data-staff-row", userId);
  await api("./api/admin-staff.php", {
    method: "POST",
    body: JSON.stringify({
      action: "update_staff",
      user_id: userId,
      name: row.querySelector("[name='name']").value,
      display_order: row.querySelector("[name='display_order']").value,
    }),
  });
  await loadUsers();
  await renderAdmin();
}

async function saveStaffPin(userId) {
  const row = findDataRow("data-staff-row", userId);
  const pin = row.querySelector("[name='pin']").value;
  if (!/^\d{4,8}$/.test(pin)) {
    alert("PINは4〜8桁の数字で入力してください");
    return;
  }
  await api("./api/admin-staff.php", {
    method: "POST",
    body: JSON.stringify({ action: "update_pin", user_id: userId, pin }),
  });
  await renderAdmin();
}

async function archiveStaff(userId) {
  const row = findDataRow("data-staff-row", userId);
  const name = row?.querySelector("[name='name']")?.value || "このスタッフ";
  const note = window.prompt(`${name} をアーカイブします。特徴や引き継ぎがあれば入力してください。`, "");
  if (note === null) return;

  await api("./api/admin-staff.php", {
    method: "POST",
    body: JSON.stringify({ action: "archive_staff", user_id: userId, archive_note: note }),
  });
  await loadUsers();
  await renderAdmin();
}

async function saveArchiveNote(userId) {
  const row = findDataRow("data-archived-staff-row", userId);
  await api("./api/admin-staff.php", {
    method: "POST",
    body: JSON.stringify({
      action: "update_archive_note",
      user_id: userId,
      archive_note: row.querySelector("[name='archive_note']").value,
    }),
  });
  await renderAdmin();
}

async function restoreStaff(userId) {
  if (!window.confirm("このスタッフを在籍スタッフへ復帰しますか？")) return;
  await api("./api/admin-staff.php", {
    method: "POST",
    body: JSON.stringify({ action: "restore_staff", user_id: userId }),
  });
  await loadUsers();
  await renderAdmin();
}

async function reviewCorrectionRequest(requestId, action) {
  const row = findDataRow("data-request-row", requestId);
  await api("./api/admin-correction-requests.php", {
    method: "POST",
    body: JSON.stringify({
      request_id: requestId,
      action,
      admin_note: row.querySelector("[name='admin_note']").value,
    }),
  });
  await renderAdmin();
}

async function changeAdminPassword(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  await api("./api/admin-profile.php", {
    method: "POST",
    body: JSON.stringify({
      current_password: data.get("current_password"),
      new_password: data.get("new_password"),
    }),
  });
  alert("管理者パスワードを変更しました");
  form.reset();
}

function exportAttendanceCsv() {
  const header = ["日付", "スタッフ", "出勤", "退勤", "写真URL"];
  const rows = state.attendanceRows.map((row) => [
    row.date,
    row.staff_name,
    row.clock_in || "",
    row.clock_out || "",
    row.photo_url || "",
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `attendance-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
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

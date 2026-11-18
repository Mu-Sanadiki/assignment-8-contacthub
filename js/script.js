/* ============================================================
   ContactHub — Smart Contact Manager
   Features: CRUD + Search + Favorites + Emergency + Validation
             + LocalStorage + SweetAlert2
   ============================================================ */
"use strict";

/* ==================== State ==================== */
const STORAGE_KEY = "contacts";
let contacts = []; // all contacts (loaded from LocalStorage)
let editingId = null; // null => Add mode | id => Edit mode
let currentAvatar = ""; // avatar (dataURL) currently inside the modal

/* ==================== DOM Helpers ==================== */
const $ = (id) => document.getElementById(id);

/* ==================== LocalStorage ==================== */
function loadContacts() {
  try {
    contacts = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    if (!Array.isArray(contacts)) contacts = [];
  } catch {
    contacts = [];
  }
}

function saveContacts() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
  } catch (err) {
    console.warn("Could not save to LocalStorage:", err);
  }
}

/* ==================== Helpers ==================== */
function uid() {
  return `contact_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

// Prevent XSS: escape any user-entered text before putting it in HTML
function escapeHTML(str = "") {
  return String(str).replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[ch],
  );
}

function getInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/);
  if (!parts[0]) return "?";
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0][0].toUpperCase();
}

// Canonical Egyptian phone: 01xxxxxxxxx (used for duplicate check & search)
function normalizePhone(phone) {
  let d = String(phone).replace(/\D/g, "");
  if (d.startsWith("0020")) d = d.slice(4);
  else if (d.startsWith("20") && d.length === 12) d = d.slice(2);
  if (d.length === 10 && d.startsWith("1")) d = "0" + d;
  return d;
}

function telHref(phone) {
  return "tel:" + String(phone).replace(/[^\d+]/g, "");
}

/* ==================== Validation ==================== */
const NAME_RE = /^[a-zA-Z\u0600-\u06FF\s]{2,50}$/; // letters (EN/AR) + spaces, 2-50
const PHONE_RE = /^(\+20|0020|20)?0?1[0125][0-9]{8}$/; // Egyptian number
const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

function flagField(inputId, errorId, invalid) {
  $(inputId).classList.toggle("invalid", invalid);
  $(errorId).classList.toggle("show", invalid);
}

// Live inline validation while typing (only when the field is not empty)
function liveValidate(inputId, errorId, regex) {
  const value = $(inputId).value.trim();
  flagField(inputId, errorId, value !== "" && !regex.test(value));
}

function clearErrors() {
  ["contactName", "contactPhone", "contactEmail"].forEach((id) =>
    $(id).classList.remove("invalid"),
  );
  ["nameError", "phoneError", "emailError"].forEach((id) =>
    $(id).classList.remove("show"),
  );
}

/* ==================== SweetAlert2 Helpers ==================== */
function swalError(title, text) {
  if (window.Swal) Swal.fire({ icon: "error", title, text });
  else alert(`${title}\n${text}`);
}

function swalSuccess(title, text) {
  if (window.Swal)
    Swal.fire({
      icon: "success",
      title,
      text,
      timer: 1500,
      showConfirmButton: false,
    });
}

function formError(title, text, inputId, errorId) {
  if (errorId) flagField(inputId, errorId, true);
  swalError(title, text);
  $(inputId).focus();
}

/* ==================== CRUD ==================== */
function findContact(id) {
  return contacts.find((c) => c.id === id);
}

function addContact(data) {
  contacts.push({
    id: uid(),
    name: data.name,
    phone: data.phone,
    email: data.email || "",
    address: data.address || "",
    notes: data.notes || "",
    group: data.group || "",
    avatar: data.avatar || "",
    isFavorite: !!data.isFavorite,
    isEmergency: !!data.isEmergency,
    createdAt: new Date().toISOString(),
  });
  saveContacts();
}

function updateContact(id, data) {
  const c = findContact(id);
  if (!c) return;
  Object.assign(c, {
    name: data.name,
    phone: data.phone,
    email: data.email || "",
    address: data.address || "",
    notes: data.notes || "",
    group: data.group || "",
    avatar: data.avatar || "",
    isFavorite: !!data.isFavorite,
    isEmergency: !!data.isEmergency,
  });
  saveContacts();
}

function removeContact(id) {
  contacts = contacts.filter((c) => c.id !== id);
  saveContacts();
}

function toggleFavorite(id) {
  const c = findContact(id);
  if (!c) return;
  c.isFavorite = !c.isFavorite;
  saveContacts();
  render();
}

function toggleEmergency(id) {
  const c = findContact(id);
  if (!c) return;
  c.isEmergency = !c.isEmergency;
  saveContacts();
  render();
}

// Delete with a SweetAlert2 confirmation — nothing is deleted before "Yes, delete it!"
function confirmDelete(id) {
  const c = findContact(id);
  if (!c) return;

  const doDelete = () => {
    removeContact(id);
    render();
    swalSuccess("Deleted!", "Contact has been deleted.");
  };

  if (window.Swal) {
    Swal.fire({
      title: "Delete Contact?",
      text: `Are you sure you want to delete ${c.name}? This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (result.isConfirmed) doDelete();
    });
  } else if (confirm(`Are you sure you want to delete ${c.name}?`)) {
    doDelete();
  }
}

/* ==================== Form Submit (Add / Update) ==================== */
function handleSubmit(e) {
  e.preventDefault();

  const data = {
    name: $("contactName").value.trim(),
    phone: $("contactPhone").value.trim(),
    email: $("contactEmail").value.trim(),
    address: $("contactAddress").value.trim(),
    notes: $("contactNotes").value.trim(),
    group: $("contactGroup").value,
    isFavorite: $("contactFavorite").checked,
    isEmergency: $("contactEmergency").checked,
    avatar: currentAvatar,
  };

  // ---- Validation (with SweetAlert2 errors) ----
  if (!data.name) {
    return formError(
      "Missing Name",
      "Please enter a name for the contact!",
      "contactName",
      "nameError",
    );
  }
  if (!NAME_RE.test(data.name)) {
    return formError(
      "Invalid Name",
      "Name should contain only letters and spaces (2-50 characters)",
      "contactName",
      "nameError",
    );
  }
  if (!data.phone) {
    return formError(
      "Missing Phone",
      "Please enter a phone number!",
      "contactPhone",
      "phoneError",
    );
  }
  if (!PHONE_RE.test(data.phone)) {
    return formError(
      "Invalid Phone",
      "Please enter a valid Egyptian phone number (e.g., 01012345678 or +201012345678)",
      "contactPhone",
      "phoneError",
    );
  }
  const duplicate = contacts.find(
    (c) =>
      c.id !== editingId &&
      normalizePhone(c.phone) === normalizePhone(data.phone),
  );
  if (duplicate) {
    return formError(
      "Duplicate Phone Number",
      `A contact with this phone number already exists: ${duplicate.name}`,
      "contactPhone",
      "phoneError",
    );
  }
  if (data.email && !EMAIL_RE.test(data.email)) {
    return formError(
      "Invalid Email",
      "Please enter a valid email address",
      "contactEmail",
      "emailError",
    );
  }

  // ---- Save ----
  if (editingId) {
    updateContact(editingId, data);
    swalSuccess("Updated!", "Contact has been updated successfully.");
  } else {
    addContact(data);
    swalSuccess("Added!", "Contact has been added successfully.");
  }

  closeModal();
  render();
}

/* ==================== Rendering ==================== */
function avatarHTML(c, size) {
  const cls = `avatar avatar-${size}`;
  if (c.avatar) {
    return `<img src="${escapeHTML(c.avatar)}" alt="${escapeHTML(c.name)}" class="${cls} avatar-img" />`;
  }
  const grad = "grad-" + (c.name.length % 8);
  return `<div class="${cls} ${grad}">${escapeHTML(getInitials(c.name))}</div>`;
}

function contactCardHTML(c) {
  const favIcon = c.isFavorite
    ? '<i class="fa-solid fa-star"></i>'
    : '<i class="fa-regular fa-star"></i>';
  const emgIcon = c.isEmergency
    ? '<i class="fa-solid fa-heart-pulse"></i>'
    : '<i class="fa-regular fa-heart"></i>';

  const favDot = c.isFavorite
    ? '<span class="avatar-dot dot-fav"><i class="fa-solid fa-star"></i></span>'
    : "";
  const emgDot = c.isEmergency
    ? '<span class="avatar-dot dot-emg"><i class="fa-solid fa-heart-pulse"></i></span>'
    : "";

  const emailRow = c.email
    ? `
    <div class="info-row">
      <span class="info-icon big icon-violet"><i class="fa-solid fa-envelope"></i></span>
      <span class="info-text">${escapeHTML(c.email)}</span>
    </div>`
    : "";

  const addressRow = c.address
    ? `
    <div class="info-row">
      <span class="info-icon big icon-emerald"><i class="fa-solid fa-location-dot"></i></span>
      <span class="info-text">${escapeHTML(c.address)}</span>
    </div>`
    : "";

  const details =
    emailRow || addressRow
      ? `<div class="card-details">${emailRow}${addressRow}</div>`
      : "";

  const groupBadge = c.group
    ? `<span class="badge badge-${escapeHTML(c.group)}">${escapeHTML(c.group)}</span>`
    : "";
  const emgBadge = c.isEmergency
    ? '<span class="badge badge-emergency"><i class="fa-solid fa-heart-pulse"></i>Emergency</span>'
    : "";
  const badges =
    groupBadge || emgBadge
      ? `<div class="card-badges">${groupBadge}${emgBadge}</div>`
      : "";

  // ✉️ mailto button (only when the contact has an email)
  const emailBtn = c.email
    ? `
    <a class="act act-email" href="mailto:${escapeHTML(c.email)}" title="Email">
      <i class="fa-solid fa-envelope"></i>
    </a>`
    : "";

  return `
  <article class="contact-card">
    <div class="card-body">
      <div class="card-top">
        <div class="avatar-wrap">
          ${avatarHTML(c, "lg")}
          ${favDot}
          ${emgDot}
        </div>
        <div class="card-id">
          <h3 class="card-name">${escapeHTML(c.name)}</h3>
          <div class="info-row">
            <span class="info-icon icon-blue"><i class="fa-solid fa-phone"></i></span>
            <span class="info-text muted">${escapeHTML(c.phone)}</span>
          </div>
        </div>
      </div>
      ${details}
      ${badges}
    </div>

    <footer class="card-actions">
      <div class="actions-left">
        <!-- 📞 Call -->
        <a class="act act-call" href="${telHref(c.phone)}" title="Call">
          <i class="fa-solid fa-phone"></i>
        </a>
        ${emailBtn}
      </div>
      <div class="actions-right">
        <button class="act act-fav ${c.isFavorite ? "active" : ""}" data-action="favorite" data-id="${c.id}" title="Favorite">${favIcon}</button>
        <button class="act act-emg ${c.isEmergency ? "active" : ""}" data-action="emergency" data-id="${c.id}" title="Emergency">${emgIcon}</button>
        <button class="act act-edit" data-action="edit" data-id="${c.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
        <button class="act act-del" data-action="delete" data-id="${c.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </div>
    </footer>
  </article>`;
}

function getFilteredContacts() {
  const q = $("searchInput").value.trim().toLowerCase();
  if (!q) return contacts;
  const qDigits = q.replace(/\D/g, "");
  return contacts.filter((c) => {
    const nameHit = c.name.toLowerCase().includes(q);
    const emailHit = c.email && c.email.toLowerCase().includes(q);
    const phoneHit =
      c.phone.toLowerCase().includes(q) ||
      (qDigits.length >= 3 && normalizePhone(c.phone).includes(qDigits));
    return nameHit || emailHit || phoneHit;
  });
}

function renderGrid() {
  const list = getFilteredContacts();
  const grid = $("contactsGrid");

  if (list.length === 0) {
    const searching = $("searchInput").value.trim() !== "";
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fa-solid fa-address-book"></i></div>
        <p class="empty-title">${searching ? "No matching contacts" : "No contacts found"}</p>
        <p class="empty-sub">${searching ? "Try a different name, phone, or email" : 'Click "Add Contact" to get started'}</p>
      </div>`;
    return;
  }

  grid.innerHTML = list.map(contactCardHTML).join("");
}

function sideRowHTML(c, type) {
  return `
  <div class="side-row ${type}">
    ${avatarHTML(c, "sm")}
    <div class="side-info">
      <h4>${escapeHTML(c.name)}</h4>
      <p>${escapeHTML(c.phone)}</p>
    </div>
    <a class="side-call" href="${telHref(c.phone)}" title="Call ${escapeHTML(c.name)}">
      <i class="fa-solid fa-phone"></i>
    </a>
  </div>`;
}

function sideRowMiniHTML(c, type) {
  return `
  <a class="side-row-mini ${type}" href="${telHref(c.phone)}" title="Call ${escapeHTML(c.name)}">
    ${avatarHTML(c, "xs")}
    <div class="side-info">
      <h4>${escapeHTML(c.name)}</h4>
      <p>${escapeHTML(c.phone)}</p>
    </div>
  </a>`;
}

function renderSideLists() {
  const favorites = contacts.filter((c) => c.isFavorite);
  const emergency = contacts.filter((c) => c.isEmergency);

  $("favoritesList").innerHTML = favorites.length
    ? favorites.map((c) => sideRowHTML(c, "fav")).join("")
    : '<p class="side-empty">No favorites yet</p>';

  $("emergencyList").innerHTML = emergency.length
    ? emergency.map((c) => sideRowHTML(c, "emg")).join("")
    : '<p class="side-empty">No emergency contacts</p>';

  $("favoritesListMobile").innerHTML = favorites.length
    ? favorites.map((c) => sideRowMiniHTML(c, "fav")).join("")
    : '<p class="side-empty">No favorites yet</p>';

  $("emergencyListMobile").innerHTML = emergency.length
    ? emergency.map((c) => sideRowMiniHTML(c, "emg")).join("")
    : '<p class="side-empty">No emergency contacts</p>';
}

function renderStats() {
  $("statTotal").textContent = contacts.length;
  $("statFavorites").textContent = contacts.filter((c) => c.isFavorite).length;
  $("statEmergency").textContent = contacts.filter((c) => c.isEmergency).length;
  $("contactsSubtitle").textContent =
    `Manage and organize your ${contacts.length} contacts`;
}

function render() {
  renderStats();
  renderGrid();
  renderSideLists();
}

/* ==================== Modal ==================== */
function renderAvatarPreview() {
  const box = $("avatarPreview");
  box.innerHTML = currentAvatar
    ? `<img src="${escapeHTML(currentAvatar)}" alt="Avatar" />`
    : '<i class="fa-solid fa-user"></i>';
}

function openModal(contact = null) {
  editingId = contact ? contact.id : null;
  currentAvatar = contact ? contact.avatar || "" : "";

  $("contactForm").reset();
  clearErrors();

  $("modalTitle").textContent = contact ? "Edit Contact" : "Add New Contact";
  $("saveBtnText").textContent = contact ? "Save Changes" : "Save Contact";

  if (contact) {
    $("contactName").value = contact.name;
    $("contactPhone").value = contact.phone;
    $("contactEmail").value = contact.email;
    $("contactAddress").value = contact.address;
    $("contactNotes").value = contact.notes;
    $("contactGroup").value = contact.group;
    $("contactFavorite").checked = contact.isFavorite;
    $("contactEmergency").checked = contact.isEmergency;
  }

  renderAvatarPreview();
  $("contactModal").classList.add("open");
  document.body.classList.add("modal-open");
  setTimeout(() => $("contactName").focus(), 60);
}

function closeModal() {
  $("contactModal").classList.remove("open");
  document.body.classList.remove("modal-open");
  $("avatarInput").value = "";
  editingId = null;
  currentAvatar = "";
}

/* ==================== Avatar Upload ==================== */
// Reads the image, resizes it to max 256px (keeps LocalStorage small),
// and stores it as a dataURL so it survives page reloads.
function handleAvatarChange(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    swalError("Invalid File", "Please choose an image file.");
    e.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const MAX = 256;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      currentAvatar = canvas.toDataURL("image/jpeg", 0.85);
      renderAvatarPreview();
    };
    img.onerror = () =>
      swalError("Invalid Image", "Could not read this image file.");
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

/* ==================== Events ==================== */
function bindEvents() {
  // Header / Modal
  $("addContactBtn").addEventListener("click", () => openModal());
  $("closeModalBtn").addEventListener("click", closeModal);
  $("cancelModalBtn").addEventListener("click", closeModal);
  $("modalBackdrop").addEventListener("click", closeModal);
  // Click outside the dialog (on the dimmed area) also closes the modal
  document.querySelector(".modal-center").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  $("contactForm").addEventListener("submit", handleSubmit);
  $("avatarInput").addEventListener("change", handleAvatarChange);

  // Close modal with Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $("contactModal").classList.contains("open")) {
      if (!window.Swal || !Swal.isVisible()) closeModal();
    }
  });

  // Search (live filtering by name / phone / email)
  $("searchInput").addEventListener("input", renderGrid);

  // Live inline validation
  $("contactName").addEventListener("input", () =>
    liveValidate("contactName", "nameError", NAME_RE),
  );
  $("contactPhone").addEventListener("input", () =>
    liveValidate("contactPhone", "phoneError", PHONE_RE),
  );
  $("contactEmail").addEventListener("input", () =>
    liveValidate("contactEmail", "emailError", EMAIL_RE),
  );

  // Card actions (event delegation: one listener for all cards)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === "favorite") toggleFavorite(id);
    else if (action === "emergency") toggleEmergency(id);
    else if (action === "edit") openModal(findContact(id));
    else if (action === "delete") confirmDelete(id);
  });
}

/* ==================== Init ==================== */
loadContacts();
bindEvents();
render();

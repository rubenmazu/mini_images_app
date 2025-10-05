/* script.js
   - English comments (project preference)
   - Implements OAuth2 token flow for Google Drive (client-side)
*/

const CLIENT_ID = "115891282859-5dnqs72l6r4pcfk5tphjm46n17t880kr.apps.googleusercontent.com";
const FOLDER_ID = "1N7lsQ-mJH5qrfa-J7uMcKwKbCpA_udp1";

// global state
let accessToken = null;
let tokenClient = null;
let filesList = []; // local list of files (for modal navigation)
let currentModalIndex = -1;

/* Utility: update status text shown to user */
function updateStatus(msg) {
  const status = document.getElementById("status");
  if (status) status.textContent = msg;
}

/* Initialize after Google script loads and DOM ready */
window.onload = () => {
  // prepare UI elements
  const loginBtn = document.getElementById("loginBtn");
  const uploadBtn = document.getElementById("uploadBtn");
  const fileInput = document.getElementById("fileInput");
  const logoutBtn = document.getElementById("logoutBtn");

  // initialize token client only after gsi lib loaded
  // guard: google must be available
  if (typeof google === "undefined" || !google.accounts || !google.accounts.oauth2) {
    updateStatus("Google Identity Services library failed to load.");
    console.error("google.accounts not available");
    return;
  }

  // create the token client (will request an OAuth access token)
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly",
    prompt: '', // empty -> no immediate consent prompt until requestAccessToken called
    callback: (tokenResponse) => {
      // tokenResponse: { access_token, expires_in, token_type, scope }
      if (tokenResponse && tokenResponse.access_token) {
        accessToken = tokenResponse.access_token;
        afterLoginUI();
        updateStatus("Conectat(ă) cu succes 💙");
        listImages();
      } else {
        updateStatus("Autentificare eșuată.");
        console.error("Token response:", tokenResponse);
      }
    }
  });

  // when login button is clicked, request access token
  loginBtn.addEventListener("click", () => {
    // Request access token (will open consent popup if needed)
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });

  // upload button
  uploadBtn.addEventListener("click", async () => {
    const files = fileInput.files;
    if (!files || files.length === 0) {
      updateStatus("Alege niște poze mai întâi 📷");
      return;
    }
    updateStatus("Se încarcă...");
    try {
      for (const f of files) {
        await uploadFile(f);
      }
      updateStatus("Upload complet 💙");
      await listImages();
    } catch (err) {
      console.error(err);
      updateStatus("Eroare la upload: " + (err.message || err));
    }
  });

  logoutBtn.addEventListener("click", () => {
    // revoke token locally and update UI
    if (accessToken) {
      // revoke token via Google endpoint (best effort)
      fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
        method: "POST",
        headers: { "Content-type": "application/x-www-form-urlencoded" }
      }).catch(err => console.warn("Revoke failed:", err));
    }
    accessToken = null;
    filesList = [];
    currentModalIndex = -1;
    document.getElementById("gallery").innerHTML = "";
    document.getElementById("afterLogin").style.display = "none";
    document.getElementById("loginBtn").style.display = "inline-block";
    updateStatus("Deconectat(ă)");
  });

  // Modal handlers
  document.getElementById("modalClose").onclick = () => closeModal();
  document.getElementById("modalPrev").onclick = () => showModalByOffset(-1);
  document.getElementById("modalNext").onclick = () => showModalByOffset(1);
  document.getElementById("modal").onclick = (e) => {
    if (e.target.id === "modal") closeModal();
  };
};

/* Show UI changes after login */
function afterLoginUI() {
  document.getElementById("loginBtn").style.display = "none";
  const after = document.getElementById("afterLogin");
  if (after) after.style.display = "flex";
}

/* Upload file to Drive into specified folder */
async function uploadFile(file) {
  if (!accessToken) throw new Error("No access token");
  // metadata
  const metadata = {
    name: file.name,
    parents: [FOLDER_ID]
  };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", file);

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken
    },
    body: form
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${res.status} ${res.statusText} — ${text}`);
  }
  const data = await res.json();
  return data.id;
}

/* List images in the folder and build the gallery */
async function listImages() {
  if (!accessToken) return;
  const galleryDiv = document.getElementById("gallery");
  galleryDiv.innerHTML = "";
  updateStatus("Se încarcă galeria...");

  // Query: files in folder and image mime
  const q = encodeURIComponent(`'${FOLDER_ID}' in parents and mimeType contains 'image/' and trashed=false`);
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,thumbnailLink,iconLink,webContentLink,webViewLink)&pageSize=1000`, {
      headers: { Authorization: "Bearer " + accessToken }
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`List failed: ${res.status} ${res.statusText} — ${txt}`);
    }
    const data = await res.json();
    if (!data.files || data.files.length === 0) {
      galleryDiv.innerHTML = "<p>No images found yet 💙</p>";
      updateStatus("Nicio imagine găsită.");
      filesList = [];
      return;
    }

    filesList = []; // reset
    // create cards
    for (const file of data.files) {
      filesList.push(file); // store for modal navigation

      const card = document.createElement("div");
      card.className = "image-card";

      const img = document.createElement("img");
      img.alt = file.name;
      img.style.borderRadius = "10px";
      img.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
      img.style.transition = "transform 0.2s ease";
      img.style.cursor = "pointer";

      // fetch binary blob from files.get alt=media
      try {
        const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
          headers: { Authorization: "Bearer " + accessToken }
        });
        if (!resp.ok) throw new Error(`Could not download file ${file.name}`);
        const blob = await resp.blob();
        img.src = URL.createObjectURL(blob);
      } catch (err) {
        console.error(err);
        // fallback: if webContentLink exists and CORS allows, set src to it
        if (file.webContentLink) img.src = file.webContentLink;
        else {
          img.alt = "Error loading image";
        }
      }

      // mouse effects
      img.onmouseenter = () => (img.style.transform = "scale(1.05)");
      img.onmouseleave = () => (img.style.transform = "scale(1)");

      // click => open modal and set current index
      img.onclick = () => {
        const idx = filesList.findIndex(f => f.id === file.id);
        openModalByIndex(idx);
      };

      card.appendChild(img);
      galleryDiv.appendChild(card);
    }

    updateStatus("Galeria actualizată 💙");
  } catch (err) {
    console.error(err);
    updateStatus("Eroare la listare: " + (err.message || err));
  }
}

/* Modal functions */
function openModalByIndex(index) {
  if (index < 0 || index >= filesList.length) return;
  currentModalIndex = index;
  const file = filesList[index];
  const modal = document.getElementById("modal");
  const modalImg = document.getElementById("modalImg");

  // try to fetch full-size image
  if (accessToken) {
    fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
      headers: { Authorization: "Bearer " + accessToken }
    }).then(r => {
      if (!r.ok) throw new Error("Could not fetch modal image");
      return r.blob();
    }).then(b => {
      modalImg.src = URL.createObjectURL(b);
      modal.style.display = "block";
      modal.setAttribute("aria-hidden", "false");
    }).catch(err => {
      console.warn(err);
      if (file.webContentLink) {
        modalImg.src = file.webContentLink;
        modal.style.display = "block";
        modal.setAttribute("aria-hidden", "false");
      } else {
        updateStatus("Nu pot afișa imaginea mare.");
      }
    });
  } else {
    updateStatus("Token lipsă pentru a descărca imaginea.");
  }
}

function showModalByOffset(offset) {
  if (currentModalIndex === -1) return;
  let next = currentModalIndex + offset;
  if (next < 0) next = filesList.length - 1;
  if (next >= filesList.length) next = 0;
  openModalByIndex(next);
}

function closeModal() {
  const modal = document.getElementById("modal");
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
  const modalImg = document.getElementById("modalImg");
  modalImg.src = "";
}

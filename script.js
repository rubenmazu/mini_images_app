// ====== CONFIGURATION ======
const CLIENT_ID   = "115891282859-5dnqs72l6r4pcfk5tphjm46n17t880kr";
const SCOPES      = "https://www.googleapis.com/auth/drive.file";
const FOLDER_ID   = "1N7lsQ-mJH5qrfa-J7uMcKwKbCpA_udp1";

// ====== UI ELEMENTS ======
const loginBtn   = document.getElementById("loginBtn");
const uploadBtn  = document.getElementById("uploadBtn");
const fileInput  = document.getElementById("fileInput");
const statusDiv  = document.getElementById("status");
const galleryDiv = document.getElementById("gallery");

// ====== GLOBAL VARIABLES ======
let tokenClient;
let accessToken = null;

// ====== HELPERS ======
function updateStatus(msg) {
  statusDiv.innerText = msg;
}

// ====== AUTHENTICATION ======
function handleAuthClick() {
  // triggers Google login popup
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

// ====== UPLOAD FILES ======
function uploadFiles() {
  if (!accessToken) {
    return alert("You must log in first.");
  }

  const files = fileInput.files;
  if (!files.length) {
    return alert("Select at least one file.");
  }

  Array.from(files).forEach(file => {
    const metadata = {
      name:     file.name,
      mimeType: file.type,
      parents:  [FOLDER_ID]
    };

    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", file);

    fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType",
      {
        method:  "POST",
        headers: { "Authorization": "Bearer " + accessToken },
        body:    form
      }
    )
    .then(res => res.json())
    .then(data => {
      updateStatus(`File "${data.name}" uploaded!`);
      listImages();
    })
    .catch(err => updateStatus("Upload error: " + (err.message || JSON.stringify(err))));
  });
}

// ====== LIST GALLERY ======
function listImages() {
  if (!accessToken) return;

  const q = encodeURIComponent(`'${FOLDER_ID}' in parents and mimeType contains 'image/'`);
  fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
    { headers: { "Authorization": "Bearer " + accessToken } }
  )
  .then(res => res.json())
  .then(data => {
    galleryDiv.innerHTML = "";
    if (!data.files || !data.files.length) {
      galleryDiv.innerHTML = "<p>No images found in Drive folder.</p>";
      return;
    }

    data.files.forEach(file => {
      const card = document.createElement("div");
      card.className = "image-card";

      const img = document.createElement("img");
      img.src = `https://drive.google.com/uc?export=view&id=${file.id}`;
      img.alt = file.name;

      const caption = document.createElement("p");
      caption.innerText = file.name;

      card.appendChild(img);
      card.appendChild(caption);
      galleryDiv.appendChild(card);
    });
  })
  .catch(err => updateStatus("List error: " + (err.message || JSON.stringify(err))));
}

// ====== INIT ======
window.addEventListener("load", () => {
  // 1) Initialize token client
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope:     SCOPES,
    callback:  (resp) => {
      if (resp.error) {
        updateStatus("Auth error: " + resp.error);
        return;
      }
      accessToken = resp.access_token;
      updateStatus("Logged in with Google Drive!");
      listImages();
    }
  });

  // 2) Attach events
  loginBtn.onclick  = handleAuthClick;
  uploadBtn.onclick = uploadFiles;
});

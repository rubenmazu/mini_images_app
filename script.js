// ====== CONFIGURAȚIE ======
const CLIENT_ID   = "115891282859-5dnqs72l6r4pcfk5tphjm46n17t880kr";
const SCOPES      = "https://www.googleapis.com/auth/drive.file";
const FOLDER_ID   = "1N7lsQ-mJH5qrfa-J7uMcKwKbCpA_udp1";

// ====== ELEMENTE UI ======
const loginBtn   = document.getElementById("loginBtn");
const uploadBtn  = document.getElementById("uploadBtn");
const fileInput  = document.getElementById("fileInput");
const statusDiv  = document.getElementById("status");
const galleryDiv = document.getElementById("gallery");

// ====== VARIABILE GLOBALE ======
let tokenClient;
let accessToken = null;

// ====== HELPERS ======
function updateStatus(msg) {
  statusDiv.innerText = msg;
}

// ====== AUTENTIFICARE ======
function handleAuthClick() {
  // va declanșa popup-ul Google
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

// ====== UPLOAD ======
function uploadFiles() {
  if (!accessToken) {
    return alert("Trebuie să te autentifici mai întâi.");
  }

  const files = fileInput.files;
  if (!files.length) {
    return alert("Selectează cel puțin un fișier.");
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
      updateStatus(`Fișierul "${data.name}" a fost încărcat!`);
      listImages();
    })
    .catch(err => updateStatus("Eroare la upload: " + (err.message || JSON.stringify(err))));
  });
}

// ====== LISTARE GALERIE ======
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
    data.files.forEach(file => {
      const img = document.createElement("img");
      img.src = `https://drive.google.com/uc?export=view&id=${file.id}`;
      img.alt = file.name;
      galleryDiv.appendChild(img);
    });
  })
  .catch(err => updateStatus("Eroare la listare: " + (err.message || JSON.stringify(err))));
}

// ====== INITIALIZĂRI ======
window.addEventListener("load", () => {
  // 1) Setez client-ul GIS de token
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope:     SCOPES,
    callback:  (resp) => {
      if (resp.error) {
        updateStatus("Auth error: " + resp.error);
        return;
      }
      accessToken = resp.access_token;
      updateStatus("Te-ai logat cu Google Drive!");
      listImages();
    }
  });

  // 2) Atașez evenimente
  loginBtn.onclick  = handleAuthClick;
  uploadBtn.onclick = uploadFiles;
});

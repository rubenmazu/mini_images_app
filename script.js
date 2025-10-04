// ====== CONFIGURATION ======
const CLIENT_ID   = "115891282859-5dnqs72l6r4pcfk5tphjm46n17t880kr.apps.googleusercontent.com"; 
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
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

// ====== UPLOAD FILES ======
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
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
      {
        method:  "POST",
        headers: { "Authorization": "Bearer " + accessToken },
        body:    form
      }
    )
    .then(res => res.json())
    .then(data => {
      if (!data.id) {
        updateStatus("Upload eșuat: " + JSON.stringify(data));
        return;
      }

      // Make file public
      return fetch(
        `https://www.googleapis.com/drive/v3/files/${data.id}/permissions`,
        {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + accessToken,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            role: "reader",
            type: "anyone"
          })
        }
      ).then(() => {
        updateStatus(`Fișierul "${data.name}" a fost încărcat și partajat!`);
        listImages();
      });
    })
    .catch(err => updateStatus("Eroare la upload: " + (err.message || JSON.stringify(err))));
  });
}

// ====== LIST GALLERY (fetch + blob) ======
function listImages() {
  if (!accessToken) return;

  const q = encodeURIComponent(`'${FOLDER_ID}' in parents and mimeType contains 'image/'`);
  fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
    headers: { "Authorization": "Bearer " + accessToken }
  })
  .then(res => res.json())
  .then(async data => {
    galleryDiv.innerHTML = "";
    if (!data.files || !data.files.length) {
      galleryDiv.innerHTML = "<p>Nu s-au găsit imagini în folderul Drive.</p>";
      return;
    }

    for (const file of data.files) {
      const card = document.createElement("div");
      card.className = "image-card";

      const img = document.createElement("img");
      img.alt = file.name;
      img.style.maxWidth = "200px";

      // Fetch image content cu token
      try {
        const resp = await fetch(
          `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
          { headers: { "Authorization": "Bearer " + accessToken } }
        );
        if (!resp.ok) throw new Error(`Nu s-a putut descărca fișierul ${file.name}`);
        const blob = await resp.blob();
        img.src = URL.createObjectURL(blob);
      } catch (err) {
        img.alt = "Eroare la încărcarea imaginii";
        console.error(err);
      }

      const caption = document.createElement("p");
      caption.innerText = file.name;

      card.appendChild(img);
      card.appendChild(caption);
      galleryDiv.appendChild(card);
    }
  })
  .catch(err => updateStatus("Eroare la listare: " + (err.message || JSON.stringify(err))));
}

// ====== INIT ======
window.addEventListener("load", () => {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope:     SCOPES,
    callback:  (resp) => {
      if (resp.error) {
        updateStatus("Eroare autentificare: " + resp.error);
        return;
      }
      accessToken = resp.access_token;
      updateStatus("Autentificat cu Google Drive!");
      listImages();
    }
  });

  loginBtn.onclick  = handleAuthClick;
  uploadBtn.onclick = uploadFiles;
});

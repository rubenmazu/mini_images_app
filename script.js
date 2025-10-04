const CLIENT_ID   = "115891282859-5dnqs72l6r4pcfk5tphjm46n17t880kr.apps.googleusercontent.com"; 
const SCOPES      = "https://www.googleapis.com/auth/drive.file";
const FOLDER_ID   = "1N7lsQ-mJH5qrfa-J7uMcKwKbCpA_udp1"; 

const loginBtn   = document.getElementById("loginBtn");
const uploadBtn  = document.getElementById("uploadBtn");
const fileInput  = document.getElementById("fileInput");
const statusDiv  = document.getElementById("status");
const galleryDiv = document.getElementById("gallery");

let tokenClient;
let accessToken = null;
let imagesList = []; // lista imaginilor pentru slider

function updateStatus(msg) {
  statusDiv.innerText = msg;
}

function handleAuthClick() {
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

function uploadFiles() {
  if (!accessToken) return alert("Trebuie să te autentifici mai întâi.");
  const files = fileInput.files;
  if (!files.length) return alert("Selectează cel puțin un fișier.");

  Array.from(files).forEach(file => {
    const metadata = { name: file.name, mimeType: file.type, parents: [FOLDER_ID] };
    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", file);

    fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
      { method: "POST", headers: { "Authorization": "Bearer " + accessToken }, body: form }
    )
    .then(res => res.json())
    .then(data => {
      if (!data.id) { updateStatus("Upload eșuat: " + JSON.stringify(data)); return; }
      // make public
      fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
        method: "POST",
        headers: { "Authorization": "Bearer " + accessToken, "Content-Type": "application/json" },
        body: JSON.stringify({ role: "reader", type: "anyone" })
      }).then(() => { updateStatus(`Fișierul "${data.name}" încărcat și partajat!`); listImages(); });
    })
    .catch(err => updateStatus("Eroare la upload: " + (err.message || JSON.stringify(err))));
  });
}

async function listImages() {
  if (!accessToken) return;

  const q = encodeURIComponent(`'${FOLDER_ID}' in parents and mimeType contains 'image/'`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
    headers: { "Authorization": "Bearer " + accessToken }
  });
  const data = await res.json();

  galleryDiv.innerHTML = "";
  imagesList = [];

  if (!data.files || !data.files.length) {
    galleryDiv.innerHTML = "<p>Nu s-au găsit imagini în folderul Drive.</p>";
    return;
  }

  const modal = document.getElementById("modal");
  const modalImg = document.getElementById("modalImg");
  const modalClose = document.getElementById("modalClose");
  const modalPrev = document.getElementById("modalPrev");
  const modalNext = document.getElementById("modalNext");

  for (const file of data.files) {
    const card = document.createElement("div");
    card.className = "image-card";

    const img = document.createElement("img");
    img.alt = file.name;
    img.loading = "lazy"; // lazy load

    try {
      const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { "Authorization": "Bearer " + accessToken } });
      const blob = await resp.blob();
      img.src = URL.createObjectURL(blob);
      imagesList.push(img.src);
    } catch(err) { img.alt="Eroare"; console.error(err); }

    img.style.cursor = "pointer";
    img.onclick = () => {
      modal.style.display = "block";
      currentIndex = imagesList.indexOf(img.src);
      modalImg.src = imagesList[currentIndex];
    }

    card.appendChild(img);
    galleryDiv.appendChild(card);
  }

  // Modal navigation
  let currentIndex = 0;
  modalClose.onclick = () => { modal.style.display = "none"; }
  modalPrev.onclick = () => { currentIndex = (currentIndex-1+imagesList.length)%imagesList.length; modalImg.src=imagesList[currentIndex]; }
  modalNext.onclick = () => { currentIndex = (currentIndex+1)%imagesList.length; modalImg.src=imagesList[currentIndex]; }
  modal.onclick = (e) => { if(e.target===modal) modal.style.display="none"; }
}

// INIT
window.addEventListener("load", () => {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: resp => {
      if (resp.error) { updateStatus("Eroare autentificare: "+resp.error); return; }
      accessToken = resp.access_token;
      updateStatus("Autentificat cu Google Drive!");
      listImages();
    }
  });

  loginBtn.onclick = handleAuthClick;
  uploadBtn.onclick = uploadFiles;

  // Drag & Drop Upload
  galleryDiv.ondragover = (e) => e.preventDefault();
  galleryDiv.ondrop = (e) => {
    e.preventDefault();
    fileInput.files = e.dataTransfer.files;
    uploadFiles();
  };
});

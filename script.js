const CLIENT_ID = "115891282859-5dnqs72l6r4pcfk5tphjm46n17t880kr.apps.googleusercontent.com";
const FOLDER_ID = "1N7lsQ-mJH5qrfa-J7uMcKwKbCpA_udp1";
const SCOPES = "https://www.googleapis.com/auth/drive.readonly";

let accessToken = null;
let tokenClient;

const loginBtn = document.getElementById("loginBtn");
const statusP = document.getElementById("status");
const galleryDiv = document.getElementById("gallery");

window.onload = () => {
  if (!window.google) {
    statusP.textContent = "Google API not loaded yet.";
    return;
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (tokenResponse) => {
      accessToken = tokenResponse.access_token;
      if (accessToken) {
        loginBtn.style.display = "none";
        statusP.textContent = "Welcome, Ruben 💙 Marta!";
        listImages();
      }
    },
  });

  loginBtn.onclick = () => {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  };
};

function updateStatus(msg) {
  statusP.textContent = msg;
}

async function listImages() {
  if (!accessToken) return;

  const q = encodeURIComponent(`'${FOLDER_ID}' in parents and mimeType contains 'image/'`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
    headers: { "Authorization": "Bearer " + accessToken }
  });

  const data = await res.json();
  galleryDiv.innerHTML = "";

  if (!data.files || !data.files.length) {
    galleryDiv.innerHTML = "<p>No images found 💔</p>";
    return;
  }

  const modal = document.getElementById("modal");
  const modalImg = document.getElementById("modalImg");
  const modalClose = document.getElementById("modalClose");

  for (const file of data.files) {
    const card = document.createElement("div");
    card.className = "image-card";
    const img = document.createElement("img");

    try {
      const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
        headers: { "Authorization": "Bearer " + accessToken }
      });
      if (!resp.ok) throw new Error(`Cannot download ${file.name}`);
      const blob = await resp.blob();
      img.src = URL.createObjectURL(blob);
    } catch (err) {
      console.error(err);
      continue;
    }

    img.alt = file.name;
    img.onclick = () => {
      modal.style.display = "block";
      modalImg.src = img.src;
    };

    card.appendChild(img);
    galleryDiv.appendChild(card);
  }

  modalClose.onclick = () => modal.style.display = "none";
  modal.onclick = (e) => { if (e.target === modal) modal.style.display = "none"; };
}

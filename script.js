const CLIENT_ID = "115891282859-5dnqs72l6r4pcfk5tphjm46n17t880kr.apps.googleusercontent.com";
const FOLDER_ID = "1N7lsQ-mJH5qrfa-J7uMcKwKbCpA_udp1";
let accessToken = null;

// Google login
function handleCredentialResponse(response) {
  console.log("Login successful!");

  // Acces token
  accessToken = response.credential;

  // Ascunde butonul de login
  const loginBtn = document.getElementById("loginBtn");
  if (loginBtn) {
    loginBtn.style.opacity = "0";
    loginBtn.style.pointerEvents = "none";
    setTimeout(() => {
      loginBtn.style.display = "none";
      const uploadArea = document.getElementById("upload-section");
      if (uploadArea) {
        uploadArea.style.display = "flex";
        uploadArea.style.opacity = "1";
      }
    }, 400);
  }

  updateStatus("Logged in successfully 💙");
  listImages();
}

// Update status text
function updateStatus(msg) {
  document.getElementById("status").textContent = msg;
}

// Upload images to Drive
async function uploadFile(file) {
  const metadata = {
    name: file.name,
    parents: [FOLDER_ID]
  };

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  form.append("file", file);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: new Headers({ Authorization: "Bearer " + accessToken }),
      body: form
    }
  );

  const data = await res.json();
  return data.id;
}

document.getElementById("uploadBtn").addEventListener("click", async () => {
  const files = document.getElementById("fileInput").files;
  if (!files.length) return updateStatus("Please choose some photos first 📷");

  updateStatus("Uploading...");
  for (const file of files) {
    await uploadFile(file);
  }

  updateStatus("Upload complete 💙");
  listImages();
});

// List all images from Drive folder
async function listImages() {
  if (!accessToken) return;
  const galleryDiv = document.getElementById("gallery");

  const q = encodeURIComponent(`'${FOLDER_ID}' in parents and mimeType contains 'image/'`);
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
      {
        headers: { Authorization: "Bearer " + accessToken }
      }
    );
    const data = await res.json();

    galleryDiv.innerHTML = "";
    if (!data.files || !data.files.length) {
      galleryDiv.innerHTML = "<p>No images found yet 💙</p>";
      return;
    }

    for (const file of data.files) {
      const card = document.createElement("div");
      card.className = "image-card";

      const img = document.createElement("img");
      img.alt = file.name;
      img.style.maxWidth = "120px"; // mai mic
      img.style.borderRadius = "10px";
      img.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
      img.style.transition = "transform 0.2s ease";

      try {
        const resp = await fetch(
          `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
          { headers: { Authorization: "Bearer " + accessToken } }
        );
        if (!resp.ok) throw new Error(`Could not download file ${file.name}`);
        const blob = await resp.blob();
        img.src = URL.createObjectURL(blob);
      } catch (err) {
        img.alt = "Error loading image";
        console.error(err);
      }

      // Hover effect
      img.onmouseenter = () => (img.style.transform = "scale(1.05)");
      img.onmouseleave = () => (img.style.transform = "scale(1)");

      // Click → open in modal
      img.style.cursor = "pointer";
      img.onclick = () => openModal(img.src);

      card.appendChild(img);
      galleryDiv.appendChild(card);
    }
  } catch (err) {
    updateStatus("Error listing images: " + err.message);
  }
}

// Open image in fullscreen modal
function openModal(src) {
  const modal = document.getElementById("modal");
  const modalImg = document.getElementById("modalImg");
  modal.style.display = "block";
  modalImg.src = src;
}

// Close modal
document.getElementById("modalClose").onclick = () => {
  document.getElementById("modal").style.display = "none";
};

// Close modal when clicking outside image
document.getElementById("modal").onclick = (e) => {
  if (e.target.id === "modal") {
    document.getElementById("modal").style.display = "none";
  }
};

const btn = document.getElementById("toggle");
const logBtn = document.getElementById("logBtn");
const logDiv = document.getElementById("log");

chrome.storage.local.get("enabled", (data) => {
  const enabled = data.enabled || false;
  updateButton(enabled);
});

btn.addEventListener("click", () => {
  chrome.storage.local.get("enabled", (data) => {
    const enabled = !data.enabled;
    chrome.storage.local.set({ enabled });
    updateButton(enabled);
  });
});

function updateButton(enabled) {
  btn.classList.toggle("on", enabled);
  btn.classList.toggle("off", !enabled);
  btn.textContent = enabled ? "Автораффлер: ВКЛ." : "Автораффлер: ВЫКЛ.";
}

logBtn.addEventListener("click", () => {
  chrome.storage.local.get("wins", (data) => {
    const wins = data.wins || [];
    if (logDiv.style.display === "block") {
      logDiv.style.display = "none";
    } else {
      logDiv.innerHTML = wins.length
  ? wins.map(w => {
      const match = w.match(/^(\d{2}\.\d{2}\.\d{4}) Вы победили в розыгрыше "(.*?)": "(.*?)"$/);
      if (match) {
        const date = `<span style="color:#0047AB;">${match[1]}</span>`;
        const raffle = match[2];
        const item = `<span style="color:#B00000;">${match[3]}</span>`;
        return `<div>${date} Вы победили в розыгрыше "${raffle}":<br>${item}</div>`;
      }
      return `<div>${w}</div>`;
    }).join("")
  : "<em>Нет записей</em>";
      logDiv.style.display = "block";
    }
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const creatorsBtn = document.getElementById('creatorsLink');
  const githubBtn = document.getElementById('githubLink');
  const overlay = document.getElementById('overlay');
  const modal = document.getElementById('creatorsModal');
  const closeBtn = document.getElementById('closeCreators');

  if (creatorsBtn && overlay && modal && closeBtn) {
    creatorsBtn.addEventListener('click', () => {
      overlay.style.display = 'block';
      modal.style.display = 'block';
    });

    closeBtn.addEventListener('click', () => {
      overlay.style.display = 'none';
      modal.style.display = 'none';
    });
  }

  if (githubBtn) {
    githubBtn.addEventListener('click', () => {
      window.open('https://github.com/Dalarcsis/ScrapTF-Auto-Raffler', '_blank');
    });
  }
});

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
  chrome.storage.local.get("winsHistory", (data) => {
    const wins =
    data.winsHistory ?? [];
    if (logDiv.style.display === "block") {
      logDiv.style.display = "none";
    } else {
if (!wins.length) {

    logDiv.innerHTML =
        "<em>Нет записей</em>";

} else {

    logDiv.innerHTML =
        wins.map(w => {

            if (
                typeof w === "string"
            ) {

                return `<div>${w}</div>`;

            }

            return `
                <div style="
                    margin-bottom:10px;
                    padding-bottom:8px;
                    border-bottom:1px solid #333;
                ">

                    <span style="color:#0047AB;">
                        ${w.date}
                    </span>

                    <br>

                    Вы победили в розыгрыше

                    <br>

                    <b>${w.raffle}</b>

                    <br>

                    <span style="color:#B00000;">
                        ${w.item}
                    </span>

                </div>
            `;

        }).join("");

}
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

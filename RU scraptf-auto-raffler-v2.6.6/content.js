chrome.storage?.local?.get(["enabled", "wins", "winsHistory"], (data) => {
    const enabled = data.enabled ?? false;
    if (!enabled) {
        console.log('[AutoRaffler] ❌ Скрипт выключен — завершение.');
        return;
    }
    runAutoRaffler();
});

function runAutoRaffler() {
    const SCROLL_COUNT = 2;
    const SCROLL_DELAY_MS = 1500;
    const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000;
    const WAIT_AFTER_CLICK_MS = 2500;
    const ENTERING_CHECK_INTERVAL_MS = 250;

    function isCaptchaVisible() {
        const captcha = document.querySelector("#raffle-captcha-holder, #turnstile-container");
        return captcha && Array.from(captcha.children).some(el => el.offsetParent !== null);
    }

    function isPasswordRaffle() {
        return document.querySelector("#raffle-password") !== null;
    }

    function isPuzzleRaffle() {
        return window.location.pathname === "/raffles/puzzle";
    }

    async function autoScrollAndCollectRaffles() {
        console.log("[AutoRaffler] 🔍 Поиск раздач...");

        const initialRaffles = Array.from(document.querySelectorAll(".panel-raffle"));
        const lastVisible = initialRaffles.at(-1);
        const alreadyJoined = lastVisible?.classList.contains("raffle-entered");

        if (!alreadyJoined) {
            for (let i = 0; i < SCROLL_COUNT; i++) {
                window.scrollTo(0, document.body.scrollHeight);
                await new Promise(r => setTimeout(r, SCROLL_DELAY_MS));
            }
        }

        const raffles = Array.from(document.querySelectorAll(".panel-raffle"))
            .filter(panel =>
                !panel.classList.contains("raffle-entered") &&
                !panel.innerHTML.includes("Withdraw Items")
            )
            .map(panel => {
                const link = panel.querySelector("a[href^='/raffles/']");
                return link ? "https://scrap.tf" + link.getAttribute("href") : null;
            })
            .filter(Boolean);

        if (raffles.length === 0) {
            console.log("[AutoRaffler] ❌ Раздачи не найдены. ⏳ Перезагрузка через 5 минут...");
            setTimeout(() => window.location.reload(), AUTO_REFRESH_INTERVAL);
            return;
        }

        localStorage.setItem("raffleQueue", JSON.stringify(raffles));
        localStorage.setItem("raffleIndex", "0");
        console.log(`[AutoRaffler] ✅ Найдено раздач: ${raffles.length}`);
        window.location.href = raffles[0];
    }

    function handleSingleRaffle() {
        let queue = JSON.parse(localStorage.getItem("raffleQueue") || "[]");
        let index = parseInt(localStorage.getItem("raffleIndex") || "0");
        console.log(`[AutoRaffler] 🎫 Обработка раздачи ${index + 1} из ${queue.length}`);

        const leaveBtn = document.querySelector("#raffle-leave");
        if (leaveBtn) {
            console.log("[AutoRaffler] 🚪 Уже участвуешь — переход к следующей.");
            goToNextRaffle();
            return;
        }

        function checkAndClick() {
            let waited = 0;
            let alreadyWaiting = false;
            let captchaWaiting = false;

            const interval = setInterval(() => {
                if (isCaptchaVisible()) {
                    if (!captchaWaiting) {
                        captchaWaiting = true;
                        console.log("[AutoRaffler] 🧩 Капча обнаружена после нажатия — ожидание решения...");
                        chrome.runtime.sendMessage({
                            type: "notify",
                            title: "🤖 Требуется внимание",
                            message: "Появилась капча. Пожалуйста, решите ее вручную."
                        });
                    }
                    return;
                }

                if (captchaWaiting) {
                    console.log("[AutoRaffler] ✅ Капча решена. Продолжение...");
                    clearInterval(interval);
                    goToNextRaffle();
                    return;
                }

                const confirm = document.querySelector(".raffle-entered-msg");
                const leaveAfterClick = document.querySelector("#raffle-leave");

                if ((confirm && confirm.style.display !== "none") || leaveAfterClick) {
                    clearInterval(interval);
                    console.log("[AutoRaffler] ✅ Вступление подтверждено.");
                    goToNextRaffle();
                    return;
                }

                const entering = Array.from(document.querySelectorAll("button.btn-info.btn-lg[disabled]"))
                    .find(b => b.textContent.includes("Entering"));
                if (entering) {
                    if (!alreadyWaiting) {
                        console.log("[AutoRaffler] ⏳ Ожидание завершения 'Entering...'");
                        alreadyWaiting = true;
                    }
                    waited = 0;
                    return;
                }

                waited += ENTERING_CHECK_INTERVAL_MS;
                if (waited >= WAIT_AFTER_CLICK_MS) {
                    clearInterval(interval);
                    console.log("[AutoRaffler] ⏱ Время ожидания истекло.");
                    goToNextRaffle();
                }
            }, ENTERING_CHECK_INTERVAL_MS);

            const buttons = document.querySelectorAll("button.btn.btn-embossed.btn-info.btn-lg");
            for (const btn of buttons) {
                if (btn.offsetParent === null) continue;
                if (btn.textContent.trim().includes("Enter Raffle")) {
                    console.log("[AutoRaffler] 🔘 Нажимаю Enter Raffle...");
                    btn.click();
                    setTimeout(() => {
                        if (isCaptchaVisible()) {
                            captchaWaiting = true;
                            console.log("[AutoRaffler] 🧩 Капча появилась после клика — в режим ожидания.");
                            chrome.runtime.sendMessage({
                                type: "notify",
                                title: "🤖 Требуется внимание!",
                                message: "Появилась капча. Пожалуйста, решите ее вручную."
                            });
                        }
                    }, 1000);
                    return;
                }
            }

            if (isPasswordRaffle() || isPuzzleRaffle()) {
                console.log("[AutoRaffler] 🔒 Это раздачи с паролем или пазлом — остановка сканирования.");
                clearInterval(interval);
                return;
            }

            console.log("[AutoRaffler] ❓ Кнопка не найдена — повторная попытка.");
            setTimeout(checkAndClick, 3000);
        }

        checkAndClick();
    }

    function goToNextRaffle() {
        if (isPasswordRaffle() || isPuzzleRaffle()) {
            console.log("[AutoRaffler] 🧠 Это раздачи с паролем или пазлом — переход отменён.");
            return;
        }

        const queue = JSON.parse(localStorage.getItem("raffleQueue") || "[]");
        let index = parseInt(localStorage.getItem("raffleIndex") || "0");
        index += 1;
        localStorage.setItem("raffleIndex", index.toString());

        if (index >= queue.length) {
            setTimeout(() => {
                window.location.replace("https://scrap.tf/raffles");
            }, 2000);
        } else {
            window.location.href = queue[index];
        }
    }

    if (window.location.pathname === "/raffles") {
        autoScrollAndCollectRaffles();
    }
    if (window.location.pathname.startsWith("/raffles/")) {
        handleSingleRaffle();
    }
}

// 👑 Уникальные уведомления о победах с сохранением истории
(function () {
    const panel = document.querySelector('div.panel.panel-info .panel-heading');

    if (!panel || !panel.textContent.includes('Raffles you won')) {
        chrome.storage.local.set({ wins: [] }, () => {
            console.log("[AutoRaffler] 🧹 Побед нет — текущий журнал очищен.");
        });
        return;
    }

    const raffleBlocks = document.querySelectorAll('.panel.panel-info .panel-raffle');
    if (!raffleBlocks.length) {
        chrome.storage.local.set({ wins: [] }, () => {
            console.log("[AutoRaffler] 🧹 Блоков побед нет — текущий журнал очищен.");
        });
        return;
    }

    const currentWins = [];

    raffleBlocks.forEach(block => {
        const titleEl = block.querySelector('.raffle-name a');
        const dateEl = block.querySelector('.raffle-start-time');
        const itemEl = block.querySelector('.panel-raffle-items .item');
        if (!titleEl || !dateEl || !itemEl) return;

        const title = titleEl.textContent.trim();
        const date = new Date(dateEl.textContent.trim()).toLocaleDateString('ru-RU');
        const item = itemEl.getAttribute('data-title');
        const entry = `${date} Вы победили в розыгрыше "${title}": "${item}"`;

        currentWins.push(entry);
    });

    chrome.storage.local.get({ wins: [], winsHistory: [] }, data => {
        const oldHistory = data.winsHistory || [];
        const updatedHistory = [...oldHistory];

        currentWins.forEach(entry => {
            if (!oldHistory.includes(entry)) {
                chrome.runtime.sendMessage({
                    type: "notify",
                    title: "🎉 Победа!",
                    message: entry
                });
                console.log("🏆 Новая победа:", entry);
                updatedHistory.push(entry);
            }
        });

        chrome.storage.local.set({
            wins: currentWins,
            winsHistory: updatedHistory
        });
    });
})();

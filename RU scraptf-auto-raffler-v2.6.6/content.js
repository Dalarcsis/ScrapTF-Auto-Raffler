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
    const WAIT_AFTER_CLICK_MS = 10;
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
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 3000;
    const WAIT_AFTER_CLICK_MS = 100;
    const CHECK_INTERVAL_MS = 300;

    let queue = JSON.parse(localStorage.getItem("raffleQueue") || "[]");
    let index = parseInt(localStorage.getItem("raffleIndex") || "0");

    console.log(`[AutoRaffler] 🎫 Обработка раздачи ${index + 1} из ${queue.length}`);

    if (isPasswordRaffle() || isPuzzleRaffle()) {
        console.log("[AutoRaffler] 🔒 Раздача с паролем/пазлом — пропуск.");
        goToNextRaffle();
        return;
    }

    const leaveBtn = document.querySelector("#raffle-leave");
    if (leaveBtn) {
        console.log("[AutoRaffler] 🚪 Уже участвуешь — дальше.");
        goToNextRaffle();
        return;
    }

    function isCaptchaError() {
        const alerts = document.querySelectorAll(".alert");
        return Array.from(alerts).some(el =>
            el.textContent.includes("Captcha did not complete")
        );
    }

    function clickEnterButton() {
        const buttons = document.querySelectorAll("button.btn.btn-embossed.btn-info.btn-lg");
        for (const btn of buttons) {
            if (btn.offsetParent === null) continue;
            if (btn.textContent.trim().includes("Enter Raffle")) {
                console.log("[AutoRaffler] 🔘 Нажимаю Enter Raffle...");
                btn.click();
                return true;
            }
        }
        return false;
    }

    function attemptJoin(retryCount = 0) {
        if (retryCount > MAX_RETRIES) {
            console.log("[AutoRaffler] ❌ Превышен лимит попыток — дальше.");
            goToNextRaffle();
            return;
        }

        if (!clickEnterButton()) {
            console.log("[AutoRaffler] ❓ Кнопка не найдена — повтор...");
            setTimeout(() => attemptJoin(retryCount + 1), RETRY_DELAY_MS);
            return;
        }

        let waited = 0;
        let captchaDetected = false;

        const interval = setInterval(() => {
            // ❌ Ошибка капчи (самое важное)
            if (isCaptchaError()) {
                console.log("[AutoRaffler] ❌ Ошибка капчи — повтор попытки...");
                clearInterval(interval);
                setTimeout(() => attemptJoin(retryCount + 1), RETRY_DELAY_MS);
                return;
            }

            // 🧩 Капча появилась
            if (isCaptchaVisible()) {
                if (!captchaDetected) {
                    captchaDetected = true;
                    console.log("[AutoRaffler] 🧩 Капча обнаружена — жду решения...");
                    chrome.runtime.sendMessage({
                        type: "notify",
                        title: "🤖 Требуется внимание",
                        message: "Появилась капча. Решите её вручную."
                    });
                }
                return;
            }

            // ✅ Капча была и исчезла
            if (captchaDetected && !isCaptchaVisible()) {
                console.log("[AutoRaffler] ✅ Капча решена.");
                clearInterval(interval);
                goToNextRaffle();
                return;
            }

            // ✅ Успешное вступление
            const confirm = document.querySelector(".raffle-entered-msg");
            const leaveAfter = document.querySelector("#raffle-leave");

            if ((confirm && confirm.style.display !== "none") || leaveAfter) {
                console.log("[AutoRaffler] ✅ Участие подтверждено.");
                clearInterval(interval);
                goToNextRaffle();
                return;
            }

            // ⏳ Кнопка "Entering..."
            const entering = Array.from(document.querySelectorAll("button[disabled]"))
                .find(b => b.textContent.includes("Entering"));

            if (entering) {
                waited = 0;
                return;
            }

            // ⏱ Таймаут
            waited += CHECK_INTERVAL_MS;
            if (waited >= WAIT_AFTER_CLICK_MS) {
                console.log("[AutoRaffler] ⏱ Таймаут — пробую снова...");
                clearInterval(interval);
                setTimeout(() => attemptJoin(retryCount + 1), RETRY_DELAY_MS);
            }

        }, CHECK_INTERVAL_MS);
    }

    attemptJoin();
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

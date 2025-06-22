chrome.storage?.local?.get(["enabled", "wins"], (data) => {
    const enabled = data.enabled ?? false;
    const wins = data.wins ?? [];

    if (!enabled) {
        console.log('[AutoRaffler] ❌ Скрипт выключен — завершение.');
        return;
    }

    runAutoRaffler(wins);
});

function runAutoRaffler(winsStorage) {
    const SCROLL_COUNT = 2;
    const SCROLL_DELAY_MS = 1500;
    const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000;
    const WAIT_AFTER_CLICK_MS = 2500;
    const ENTERING_CHECK_INTERVAL_MS = 250;

    function isCaptchaVisible() {
        const captcha = document.querySelector("#raffle-captcha-holder, #turnstile-container");
        if (!captcha) return false;
        return Array.from(captcha.children).some(el => el.offsetParent !== null);
    }

    function notifyWin(title, item) {
        chrome.runtime.sendMessage({ type: 'win', title, item });
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
            console.log("[AutoRaffler] ❌ Раздачи не найдены.");
            console.log("[AutoRaffler] ⏳ Перезагрузка через 5 минут...");
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

        const withdrawButton = document.querySelector("button.btn.btn-embossed.btn-info[onclick*='WithdrawRaffle']");
        if (withdrawButton) {
            const raffleTitle = document.querySelector(".panel-title")?.textContent?.trim() || "(Без названия)";
            const prize = document.querySelector(".raffle-item-entry .item-name")?.textContent?.trim() || "(Без названия)";
            chrome.storage.local.get({ wins: [] }, data => {
                const updated = [...data.wins, `${new Date().toLocaleDateString('ru-RU')} Вы победили в розыгрыше "${raffleTitle}": "${prize}"`];
                chrome.storage.local.set({ wins: updated });
                notifyWin(raffleTitle, prize);
            });
            return;
        }

        const leaveBtn = document.querySelector("#raffle-leave");
        if (leaveBtn) {
            console.log("[AutoRaffler] 🚪 Уже участвуешь (Leave Raffle найден) — переход к следующей.");
            goToNextRaffle();
            return;
        }

        function checkAndClick() {
            if (isCaptchaVisible()) return setTimeout(checkAndClick, 2000);

            const confirmation = document.querySelector(".raffle-entered-msg");
            const leaveNow = document.querySelector("#raffle-leave");
            if ((confirmation && confirmation.style.display !== "none") || leaveNow) return goToNextRaffle();

            const buttons = document.querySelectorAll("button.btn.btn-embossed.btn-info.btn-lg");
            for (const btn of buttons) {
                if (btn.offsetParent === null) continue;
                const text = btn.textContent.trim();
                if (text.includes("Enter Raffle")) {
                    console.log("[AutoRaffler] 🔘 Кликаю Enter Raffle...");
                    btn.click();

                    let waited = 0;
                    let alreadyWaitingEntering = false;
                    const interval = setInterval(() => {
                        waited += ENTERING_CHECK_INTERVAL_MS;
                        const confirm = document.querySelector(".raffle-entered-msg");
                        const leaveAfterClick = document.querySelector("#raffle-leave");

                        if ((confirm && confirm.style.display !== "none") || leaveAfterClick) {
                            clearInterval(interval);
                            console.log("[AutoRaffler] ✅ Подтверждение или Leave Raffle — идём дальше.");
                            goToNextRaffle();
                            return;
                        }

                        const enteringButton = Array.from(document.querySelectorAll("button.btn-info.btn-lg[disabled]"))
                            .find(btn => btn.textContent.includes("Entering"));
                        if (enteringButton) {
                            if (!alreadyWaitingEntering) {
                                console.log("[AutoRaffler] ⏳ Всё ещё происходит вступление (Entering...) — продолжаем ждать...");
                                alreadyWaitingEntering = true;
                            }
                            waited = 0;
                            return;
                        }

                        if (waited >= WAIT_AFTER_CLICK_MS) {
                            clearInterval(interval);
                            console.log("[AutoRaffler] ⏱ Время ожидания истекло — идём дальше.");
                            goToNextRaffle();
                        }
                    }, ENTERING_CHECK_INTERVAL_MS);
                    return;
                }
            }

            console.log("[AutoRaffler] ❓ Кнопка не найдена — повторим позже.");
            setTimeout(checkAndClick, 3000);
        }

        checkAndClick();
    }

    function goToNextRaffle() {
        const queue = JSON.parse(localStorage.getItem("raffleQueue") || "[]");
        let index = parseInt(localStorage.getItem("raffleIndex") || "0");
        index += 1;
        localStorage.setItem("raffleIndex", index.toString());

        if (index >= queue.length) {
            const meta = document.createElement("meta");
            meta.httpEquiv = "refresh";
            meta.content = "2; url=https://scrap.tf/raffles";
            document.head.appendChild(meta);
            setTimeout(() => {
                window.location.replace("https://scrap.tf/raffles");
            }, 2000);
        } else {
            const next = queue[index];
            window.location.href = next;
        }
    }

    if (window.location.pathname === "/raffles") {
        autoScrollAndCollectRaffles();
    }

    if (window.location.pathname.startsWith("/raffles/")) {
        handleSingleRaffle();
    }
}

// 👑 Победа на странице профиля (https://scrap.tf/profile)
(function () {
    const panel = document.querySelector('div.panel.panel-info .panel-heading');
    if (!panel || !panel.textContent.includes('Raffles you won')) return;

    const raffleBlock = document.querySelector('.panel.panel-info .panel-raffle');
    if (!raffleBlock) return;

    const titleEl = raffleBlock.querySelector('.raffle-name a');
    const dateEl = raffleBlock.querySelector('.raffle-start-time');
    const itemEl = raffleBlock.querySelector('.panel-raffle-items .item');

    if (!titleEl || !dateEl || !itemEl) return;

    const title = titleEl.textContent.trim();
    const dateText = dateEl.textContent.trim();
    const itemName = itemEl.getAttribute('data-title');

    const parsedDate = new Date(dateText);
    const dateFormatted = parsedDate.toLocaleDateString('ru-RU');

    const entry = `${dateFormatted} Вы победили в розыгрыше "${title}": "${itemName}"`;

    chrome.storage.local.get({ wins: [] }, data => {
        const log = data.wins;
        if (!log.includes(entry)) {
            log.push(entry);
            chrome.storage.local.set({ wins: log });

            chrome.runtime.sendMessage({
                type: "notify",
                title: "🎉 Победа!",
                message: `Вы выиграли в розыгрыше "${title}": "${itemName}"`
            });

            console.log("🏆 Победа записана в журнал:", entry);
        }
    });
})();

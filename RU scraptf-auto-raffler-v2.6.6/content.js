/*
==================================================
 ScrapTF AutoRaffler v3.0.0 FINAL
 PART 9.1 — CORE / BOOTLOADER / STORAGE
==================================================
*/


// --------------------------------------------------
// BOOT PROTECTION
// --------------------------------------------------

if (window.__SCRAPTF_AUTORAFFLER_RUNNING__) {

    console.warn(
        "[AutoRaffler] Второй запуск остановлен."
    );

    throw new Error(
        "AutoRaffler already running"
    );

}


window.__SCRAPTF_AUTORAFFLER_RUNNING__ = true;



// --------------------------------------------------
// VERSION
// --------------------------------------------------

const AUTORAFFLER_VERSION = "3.0.0";



// --------------------------------------------------
// CONFIG
// --------------------------------------------------

const AutoRafflerConfig = {

    scrollDelay: 1500,


    maxRetries: 5,


    retryDelay: 3000,


    checkInterval: 500,


    refreshInterval:
        5 * 60 * 1000,


    nextRaffleDelay:
        2000,


    watchdogTimeout:
        60000,

    enterCooldown: 
	    5100
};



// --------------------------------------------------
// STORAGE
// --------------------------------------------------

const AutoRafflerStorage = {


    get(keys) {


        return new Promise(resolve => {


            chrome.storage.local.get(
                keys,
                data => resolve(data)
            );


        });


    },



    set(data) {


        return new Promise(resolve => {


            chrome.storage.local.set(
                data,
                () => resolve()
            );


        });


    },



    async isEnabled() {


        const data =
            await this.get([
                "enabled"
            ]);



        return data.enabled ?? false;


    }


};



// --------------------------------------------------
// LOGGER
// --------------------------------------------------

const AutoRafflerLog = {


    info(text) {


        console.log(
            `%c[AutoRaffler] ${text}`,
            "color:#00aa00"
        );


    },



    warn(text) {


        console.log(
            `[AutoRaffler] ⚠️ ${text}`
        );


    },



    error(text) {


        console.error(
            `[AutoRaffler] ❌ ${text}`
        );


    }


};



// --------------------------------------------------
// PAGE DETECTOR
// --------------------------------------------------

const AutoRafflerPage = {


    isScrapTF() {


        return (
            location.hostname ===
            "scrap.tf"
        );


    },



    isRafflesList() {


        return (
            location.pathname ===
            "/raffles"
        );


    },



    isRafflePage() {


        return (
            location.pathname.startsWith(
                "/raffles/"
            )
        );


    }


};



// --------------------------------------------------
// GLOBAL STATE
// --------------------------------------------------

const AutoRafflerState = {

    running: false,


    queue: [],


    index: 0,



    async load() {


        const data =
            await AutoRafflerStorage.get([

                "raffleQueue",

                "raffleIndex",

            ]);



        this.queue =
            data.raffleQueue ?? [];



this.index =
    Number(
        data.raffleIndex ?? 0
    );


    },



    async save() {


        await AutoRafflerStorage.set({


            raffleQueue:
                this.queue,


            raffleIndex:
                this.index,
		
        });


    }


};



// --------------------------------------------------
// MAIN BOOTLOADER
// --------------------------------------------------

(async function AutoRafflerBoot(){



    if (
        !AutoRafflerPage.isScrapTF()
    ) {


        return;


    }



    const enabled =
        await AutoRafflerStorage.isEnabled();



    if (!enabled) {


        AutoRafflerLog.warn(
            "AutoRaffler выключен."
        );


        return;


    }



    await AutoRafflerState.load();



    AutoRafflerState.running =
        true;
		
    window.AutoRafflerReady = true;


    AutoRafflerLog.info(
        `🚀 ScrapTF AutoRaffler v${AUTORAFFLER_VERSION} запущен`
    );


    window.AutoRafflerInitialized = true;


})();

/*
==================================================
 PART 9.2 — QUEUE MANAGER + SCANNER
==================================================
*/


// --------------------------------------------------
// QUEUE MANAGER
// --------------------------------------------------

const AutoRafflerQueue = {


    async get() {


        const data =
            await AutoRafflerStorage.get([

                "raffleQueue",

                "raffleIndex",

                "raffleAttempts"

            ]);



        return {


            queue:
                data.raffleQueue ?? [],


            index:
                Number(
                    data.raffleIndex ?? 0
                ),


            attempts:
                data.raffleAttempts ?? {}

        };


    },



    async save(data) {


        await AutoRafflerStorage.set({


            raffleQueue:
                data.queue,


            raffleIndex:
                data.index,


            raffleAttempts:
                data.attempts


        });


    },



    async current() {


        const data =
            await this.get();



        return (
            data.queue[data.index]
            ??
            null
        );


    },



    async next() {


        const data =
            await this.get();



        data.index++;



        await this.save(
            data
        );



        if (
            data.index >=
            data.queue.length
        ) {


            AutoRafflerLog.info(
                "🎯 Очередь закончена."
            );



            await this.clear();



            setTimeout(
                ()=>{


                    location.href =
                        "https://scrap.tf/raffles";


                },

                AutoRafflerConfig.nextRaffleDelay
            );



            return null;


        }



        return data.queue[data.index];


    },



    async clear() {


        await AutoRafflerStorage.set({


            raffleQueue: [],


            raffleIndex: 0,


            raffleAttempts: {},

            nextEnterAllowedAt: 0
	
        });


    }



};



// --------------------------------------------------
// SCANNER
// --------------------------------------------------

const AutoRafflerScanner = {


    wait(ms) {


        return new Promise(
            resolve =>
                setTimeout(resolve, ms)
        );


    },

    async waitForStats(timeout = 5000) {

        const start = Date.now();


        while (
            Date.now() - start < timeout
        ) {


            if (
                document.querySelector(
                    ".raffle-list-stat h2"
                )
            ) {

                return true;

            }


            await this.wait(100);

        }


        return false;

    },



    getDynamicScrollCount() {


        const stats =
            document.querySelectorAll(
                ".raffle-list-stat"
            );


        for (
            const stat of stats
        ) {


            const title =
                stat.querySelector("h2");


            if (
                title &&
                title.textContent.includes(
                    "Open Raffles Entered"
                )
            ) {


                const value =
                    stat.querySelector("h1");


                if (!value) {

                    return 0;

                }


                const match =
                    value.textContent
                    .trim()
                    .match(
                        /(\d+)\/(\d+)/
                    );


                if (!match) {

                    return 0;

                }


                const entered =
                    Number(match[1]);


                const total =
                    Number(match[2]);


                const notEntered =
                    total - entered;



                const scrolls =
                    Math.max(
                        0,
                        Math.ceil(notEntered / 60) - 1
                    );


                AutoRafflerLog.info(
                    `📊 Всего: ${total}, вступлено: ${entered}, осталось: ${notEntered}. Прокруток: ${scrolls}`
                );


                return scrolls;


            }


        }


        AutoRafflerLog.warn(
            "Не найден Open Raffles Entered"
        );


        return 0;


    },

async scroll() {


    AutoRafflerLog.info(
        "🔍 Поиск раздач..."
    );


    await this.waitForStats();


    const scrollCount =
        this.getDynamicScrollCount();



    for (
        let i = 0;
        i < scrollCount;
        i++
    ) {


        window.scrollTo(
            0,
            document.body.scrollHeight
        );


        AutoRafflerLog.info(
            `⬇ Прокрутка ${i + 1}/${scrollCount}`
        );


        await this.wait(
            AutoRafflerConfig.scrollDelay
        );


    }


},



    getPanels() {


        return Array.from(
            document.querySelectorAll(
                ".panel-raffle"
            )
        );


    },



    invalid(panel) {


        if (
            panel.classList.contains(
                "raffle-entered"
            )
        ) {

            return true;

        }



        if (
            panel.innerHTML.includes(
                "Withdraw Items"
            )
        ) {

            return true;

        }



        return false;


    },



    getLink(panel) {


        const link =
            panel.querySelector(
                "a[href^='/raffles/']"
            );



        if (!link) {

            return null;

        }



        return (
            "https://scrap.tf" +
            link.getAttribute("href")
        );


    },



    collect() {


        const result = [];



        for (
            const panel of this.getPanels()
        ) {



            if (
                this.invalid(panel)
            ) {

                continue;

            }



            const link =
                this.getLink(panel);



            if (
                link &&
                !result.includes(link)
            ) {


                result.push(link);


            }


        }



        return result;


    },



    async start() {


        await this.scroll();



        const raffles =
            this.collect();



        if (
            !raffles.length
        ) {


            AutoRafflerLog.warn(
                "Раздачи не найдены. Обновление через 5 минут."
            );



            setTimeout(
                ()=>location.reload(),
                AutoRafflerConfig.refreshInterval
            );



            return;

        }



        await AutoRafflerStorage.set({


            raffleQueue:
                raffles,


            raffleIndex:
                0,


            raffleAttempts:
                {}


        });



        AutoRafflerLog.info(
            `✅ Найдено раздач: ${raffles.length}`
        );



        location.href =
            raffles[0];


    }


};

/*
==================================================
 PART 9.3 — EXECUTOR + CAPTCHA HANDLER
==================================================
*/


// --------------------------------------------------
// CAPTCHA HANDLER
// --------------------------------------------------

const AutoRafflerCaptcha = {


    detected:false,



    isVisibleElement(el) {


        return (
            el &&
            el.offsetParent !== null &&
            el.offsetWidth > 0 &&
            el.offsetHeight > 0
        );


    },



    isVisible() {


        const selectors = [

            "#raffle-captcha-holder",

            "#turnstile-container",

            ".cf-turnstile",

            "[data-sitekey]"

        ];



        for (
            const selector of selectors
        ) {


            const elements =
                document.querySelectorAll(
                    selector
                );



            for (
                const el of elements
            ) {


                if (
                    this.isVisibleElement(el)
                ) {

                    return true;

                }


            }


        }



        return false;


    },



    hasError() {


        return Array.from(
            document.querySelectorAll(
                ".alert"
            )
        )
        .some(el =>
            el.textContent.includes(
                "Captcha did not complete"
            )
        );


    },



    notify() {


        try {


            chrome.runtime.sendMessage({

                type:"notify",

                title:
                    "🤖 Требуется внимание",

                message:
                    "Появилась капча ScrapTF."

            });


        }
        catch(e){}



    },



    async waitForSolve() {


        if (
            !this.isVisible()
        ) {


            return;


        }



        if (
            !this.detected
        ) {


            this.detected = true;


            AutoRafflerLog.warn(
                "🧩 Ожидание капчи..."
            );



            this.notify();


        }



        return new Promise(resolve=>{


            const timer =
                setInterval(()=>{


                    if (
                        !this.isVisible()
                    ) {


                        clearInterval(timer);



                        this.detected=false;



                        AutoRafflerLog.info(
                            "✅ Капча решена."
                        );



                        resolve();


                    }


                },
                AutoRafflerConfig.checkInterval
            );


        });


    }


};

// --------------------------------------------------
// ENTER WAITER
// --------------------------------------------------

const AutoRafflerWaiter = {

async waitForGlobalCooldown() {

    const data =
        await AutoRafflerStorage.get([
            "nextEnterAllowedAt"
        ]);

    const nextAllowed =
        data.nextEnterAllowedAt ?? 0;

    const remaining =
        nextAllowed - Date.now();

    if (remaining <= 0) {

        return;

    }

    AutoRafflerLog.info(
        `⌛ Глобальный кулдаун: ${Math.ceil(remaining / 1000)} сек.`
    );

    await this.wait(remaining);

},

    state: "",

    wait(ms) {

        return new Promise(resolve =>
            setTimeout(resolve, ms)
        );

    },

    logOnce(state, text) {

        if (this.state !== state) {

            this.state = state;
            AutoRafflerLog.info(text);

        }

    },

    findCooldown() {

        const text = document.body.innerText;

        const match = text.match(
            /Please wait\s+(\d+)\s+more second/i
        );

        return match ? Number(match[1]) : null;

    },

    getButton() {

        return Array.from(
            document.querySelectorAll("button")
        ).find(btn =>
            btn.textContent.trim().includes("Enter Raffle")
        );

    },

    async ready() {

        while (true) {

            // Cloudflare
            if (AutoRafflerCaptcha.isVisible()) {

                this.logOnce(
                    "cloudflare",
                    "🧩 Ожидание Cloudflare..."
                );

                await AutoRafflerCaptcha.waitForSolve();
                continue;
            }

            const button = this.getButton();

            if (!button) {

                this.logOnce(
                    "button",
                    "⏳ Ожидание появления кнопки..."
                );

                await this.wait(500);
                continue;
            }

            if (button.disabled) {

                this.logOnce(
                    "disabled",
                    "⏳ Кнопка пока недоступна..."
                );

                await this.wait(500);
                continue;
            }

            const cooldown = this.findCooldown();

            if (cooldown !== null) {

                this.logOnce(
                    "cooldown",
                    `⏳ Cooldown ScrapTF: ${cooldown} сек.`
                );

                await this.wait(cooldown * 1000 + 300);
                continue;
            }

            this.state = "";

            AutoRafflerLog.info(
                "✅ Можно вступать."
            );

            return;

        }

    }

};

// --------------------------------------------------
// RAFFLE EXECUTOR
// --------------------------------------------------

const AutoRafflerExecutor = {


    isPassword() {


        return !!document.querySelector(
            "#raffle-password"
        );


    },



    isPuzzle() {


        return (
            location.pathname ===
            "/raffles/puzzle"
        );


    },



    alreadyJoined() {


        return !!document.querySelector(
            "#raffle-leave"
        );


    },



    findButton() {


        return Array.from(
            document.querySelectorAll(
                "button"
            )
        )
        .find(btn=>{


            if (
                btn.offsetParent === null
            ) {

                return false;

            }



            return btn.textContent
                .trim()
                .includes(
                    "Enter Raffle"
                );


        });


    },



    async clickEnter() {


        const btn =
            this.findButton();



        if (!btn) {


            AutoRafflerLog.warn(
                "Кнопка Enter Raffle не найдена."
            );


            return false;


        }


        await AutoRafflerWaiter.waitForGlobalCooldown();

        AutoRafflerLog.info(
            "🔘 Enter Raffle"
        );



        btn.click();



        return true;


    },



isSuccess() {


    // Основной способ ScrapTF
    if (
        document.querySelector(
            "#raffle-leave"
        )
    ) {

        return true;

    }



    // Дополнительные варианты
    const body =
        document.body.innerText;



    if (
        body.includes("Leave Raffle") ||
        body.includes("You have entered") ||
        body.includes("Withdraw Items")
    ) {

        return true;

    }



    return false;


},



async waitResult() {


    return new Promise(resolve=>{


        let time = 0;



        const timer =
            setInterval(async()=>{


                // Сначала проверяем капчу
                await AutoRafflerCaptcha.waitForSolve();



                // Потом проверяем вход
                if(
                    this.isSuccess()
                ){


                    clearInterval(timer);



                    AutoRafflerLog.info(
                        "✅ Участие подтверждено."
                    );

const nextAllowed =
    Date.now() + AutoRafflerConfig.enterCooldown;

await AutoRafflerStorage.set({

    nextEnterAllowedAt: nextAllowed

});

AutoRafflerLog.info(
    `⏳ Следующий вход возможен через 5 сек.`
);

resolve(true);


                    return;

                }



                time += 500;



                if(
                    time >= 5000
                ){


                    clearInterval(timer);



                    AutoRafflerLog.warn(
                        "⌛ Не дождался подтверждения входа."
                    );



                    resolve(false);


                }



            },
            500);


    });


},



    async next() {


        const next =
            await AutoRafflerQueue.next();



        if (
            next
        ) {


            location.href =
                next;


        }


    },



    async start() {


        const current =
            await AutoRafflerQueue.current();



        if (
            !current
        ) {


            AutoRafflerLog.warn(
                "Очередь пустая."
            );


            return;


        }



        AutoRafflerLog.info(
            "🎫 Обработка раздачи."
        );



        if (
            this.isPassword() ||
            this.isPuzzle()
        ) {


            AutoRafflerLog.info(
                "🔒 Пропуск закрытой раздачи."
            );


            await this.next();


            return;

        }



        if (
            this.alreadyJoined()
        ) {


            AutoRafflerLog.info(
                "🚪 Уже участвуешь."
            );


            await this.next();


            return;

        }

        await AutoRafflerWaiter.ready();

        const clicked =
            await this.clickEnter();



        if (!clicked) {


            await this.next();


            return;


        }



        const success =
            await this.waitResult();



        if (
            success
        ) {


            await this.next();


        }
        else {


            AutoRafflerLog.warn(
                "Не удалось войти. Повтор."
            );


            setTimeout(
                ()=>this.start(),
                AutoRafflerConfig.retryDelay
            );


        }


    }


};

/*
==================================================
 PART 9.4 — WINS + WATCHDOG + OPTIMIZER
==================================================
*/


// --------------------------------------------------
// WIN TRACKER
// --------------------------------------------------

const AutoRafflerWins = {


    create(block) {


        const title =
            block.querySelector(
                ".raffle-name a"
            );


        const date =
            block.querySelector(
                ".raffle-start-time"
            );


        const item =
            block.querySelector(
                ".panel-raffle-items .item"
            );



        if (
            !title ||
            !date ||
            !item
        ) {

            return null;

        }



        const text =
            `${new Date(
                date.textContent.trim()
            ).toLocaleDateString("ru-RU")} Вы победили в розыгрыше "${title.textContent.trim()}": "${item.getAttribute("data-title")}"`;



        return {

            id:
                btoa(text),

            text

        };


    },



    collect() {


        const blocks =
            document.querySelectorAll(
                ".panel.panel-info .panel-raffle"
            );



        const wins = [];



        blocks.forEach(block=>{


            const win =
                this.create(block);



            if(win){

                wins.push(win);

            }


        });



        return wins;


    },



    async check() {


        const current =
            this.collect();



        if(
            !current.length
        ){

            return;

        }



        const data =
            await AutoRafflerStorage.get([

                "winsHistory"

            ]);



        const history =
            data.winsHistory ?? [];



        const updated =
            [...history];



        for(
            const win of current
        ){


            if(
                !history.some(
                    old =>
                        old.id === win.id
                )
            ){


                AutoRafflerLog.info(
                    "🏆 Новая победа!"
                );



                try{


                    chrome.runtime.sendMessage({

                        type:"notify",

                        title:"🎉 Победа!",

                        message:
                            win.text

                    });


                }
                catch(e){}



                updated.push(win);


            }


        }



        await AutoRafflerStorage.set({

            wins:
                current,


            winsHistory:
                updated


        });


    }


};



// --------------------------------------------------
// WATCHDOG
// --------------------------------------------------

const AutoRafflerWatchdog = {


    started:
        Date.now(),



    lastActivity:
        Date.now(),



    touch(reason="") {


        this.lastActivity =
            Date.now();



        if(reason){

            AutoRafflerLog.info(
                `🔄 ${reason}`
            );

        }


    },



    start(){


        AutoRafflerLog.info(
            "👁 Watchdog активирован."
        );



        setInterval(()=>{


            const idle =
                Date.now()
                -
                this.lastActivity;



            if(
                idle >
                AutoRafflerConfig.watchdogTimeout
            ){


                AutoRafflerLog.warn(
                    "Зависание обнаружено."
                );



                location.reload();


            }


        },
        5000);



    }


};



// --------------------------------------------------
// FINAL OPTIMIZER
// --------------------------------------------------

const AutoRafflerOptimizer = {


    async start(){


        AutoRafflerLog.info(
            "⚙ Финальная проверка."
        );



        await AutoRafflerWins.check();



        AutoRafflerWatchdog.start();



        console.log(
            "%c========== ScrapTF AutoRaffler ==========",
            "color:#0088ff;font-weight:bold"
        );


        console.table({

            version:
                AUTORAFFLER_VERSION,


            page:
                location.pathname,


            queue:
                AutoRafflerState.queue.length,


            index:
                AutoRafflerState.index,


            running:
                AutoRafflerState.running

        });


        console.log(
            "%c==========================================",
            "color:#0088ff;font-weight:bold"
        );


    }


};

/*
==================================================
 FINAL START ROUTER
==================================================
*/

setTimeout(async ()=>{


    if(
        !window.AutoRafflerInitialized
    ){

        AutoRafflerLog.warn(
            "Ожидание инициализации..."
        );

        return;

    }



    if(
        AutoRafflerPage.isRafflesList()
    ){

        AutoRafflerLog.info(
            "📋 Запуск сканера."
        );


        await AutoRafflerScanner.start();


    }



    if(
        AutoRafflerPage.isRafflePage()
    ){

        AutoRafflerLog.info(
            "🎫 Запуск входа в раздачу."
        );


        await AutoRafflerExecutor.start();


    }



},1500);

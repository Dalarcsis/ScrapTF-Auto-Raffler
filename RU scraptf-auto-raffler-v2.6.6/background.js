chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "notify") {
        chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/icon128.png",
            title: request.title,
            message: request.message
        });
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url.includes("scrap.tf/raffles")) {
    chrome.storage.local.get("enabled", (data) => {
      if (data.enabled) {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ["content.js"]
        });
      }
    });
  }
});